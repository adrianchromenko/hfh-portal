import { useEffect, useState } from 'react'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { geocodeAddress } from '../utils/geocode'
import {
  subscribeBookingSettings,
  isDateBlocked,
  countBookingsOnDate,
  getMaxForDate,
  DEFAULT_BOOKING_SETTINGS
} from '../utils/bookingSettings'
import { X, Plus, Repeat, AlertTriangle, Briefcase } from 'lucide-react'
import { format, addWeeks } from 'date-fns'

export default function AddBookingModal({ onClose }) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [capacityWarning, setCapacityWarning] = useState('')
  const [overrideCapacity, setOverrideCapacity] = useState(false)
  const [bookingSettings, setBookingSettings] = useState(DEFAULT_BOOKING_SETTINGS)

  useEffect(() => {
    const unsub = subscribeBookingSettings(setBookingSettings)
    return () => unsub()
  }, [])

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    apartment: '',
    city: 'Sault Ste. Marie',
    state: 'ON',
    zip: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '',
    items: '',
    notes: '',
    status: 'pending',
    type: 'pickup',
    isBusiness: false,
    recurring: false,
    recurringFrequency: 'weekly',
    recurringWeeks: '8'
  })

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (name === 'date') {
      setCapacityWarning('')
      setOverrideCapacity(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    // Validate required fields
    const required = ['name', 'phone', 'address', 'city', 'state', 'zip', 'date', 'items']
    for (const field of required) {
      if (!formData[field].trim()) {
        setError(`Please fill in the ${field} field.`)
        return
      }
    }

    // Note: blocked dates are intentionally allowed for manual bookings —
    // staff override the public booking form restrictions when needed
    // (e.g. recurring business pickups on otherwise blocked weekdays).

    const cap = getMaxForDate(formData.date, bookingSettings)
    if (cap > 0 && !overrideCapacity) {
      try {
        const existing = await countBookingsOnDate(formData.date)
        if (existing >= cap) {
          setCapacityWarning(`This date is full for customers (${existing}/${cap} bookings). Click "Add Booking" again to override and add anyway.`)
          setOverrideCapacity(true)
          return
        }
      } catch (capErr) {
        console.warn('Capacity check failed, allowing submit:', capErr)
      }
    }

    setSubmitting(true)

    try {
      // Geocode address
      let coords = null
      try {
        coords = await geocodeAddress(formData.address, formData.city, formData.state, formData.zip)
      } catch (geoErr) {
        console.warn('Geocoding failed:', geoErr)
      }

      // Build base booking data (exclude UI-only fields)
      const { recurring, recurringFrequency, recurringWeeks, ...bookingFields } = formData
      const recurringId = recurring ? `recurring_${Date.now()}` : null
      const frequencyWeeks = recurringFrequency === 'weekly' ? 1 : recurringFrequency === 'biweekly' ? 2 : 4

      const baseData = {
        ...bookingFields,
        lat: coords?.lat || null,
        lng: coords?.lng || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        manualEntry: true,
        ...(recurring && {
          recurring: true,
          recurringId,
          recurringFrequency
        })
      }

      // Create the first booking
      await addDoc(collection(db, 'bookings'), baseData)

      // Create future recurring bookings
      if (recurring) {
        const totalWeeks = parseInt(recurringWeeks) || 8
        const totalOccurrences = Math.floor(totalWeeks / frequencyWeeks)
        for (let i = 1; i < totalOccurrences; i++) {
          const futureDate = addWeeks(new Date(formData.date + 'T12:00:00'), i * frequencyWeeks)
          await addDoc(collection(db, 'bookings'), {
            ...baseData,
            date: format(futureDate, 'yyyy-MM-dd'),
            status: 'confirmed'
          })
        }
      }

      onClose()
    } catch (err) {
      console.error('Error adding booking:', err)
      setError('Failed to add booking. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Add Manual Booking</h2>
            <p className="text-sm text-gray-500">Create a new pickup or delivery booking</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Type and Status Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
              <select
                name="type"
                value={formData.type}
                onChange={handleChange}
                className="input-field"
              >
                <option value="pickup">Pickup</option>
                <option value="delivery">Delivery</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="input-field"
              >
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer p-3 bg-pink-50 rounded-lg border border-pink-200">
            <input
              type="checkbox"
              checked={formData.isBusiness}
              onChange={(e) => setFormData(prev => ({ ...prev, isBusiness: e.target.checked }))}
              className="h-5 w-5 rounded border-gray-300 text-pink-600 focus:ring-pink-500"
            />
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-pink-600" />
              <span className="text-sm font-medium text-gray-700">
                This is a business pickup (shown in a distinct color on the map)
              </span>
            </div>
          </label>

          {/* Customer Info */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Customer Information</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="Customer name"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="(705) 555-0123"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="customer@email.com"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Schedule */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Schedule</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  name="date"
                  type="date"
                  value={formData.date}
                  onChange={handleChange}
                  className="input-field"
                />
                {(() => {
                  const check = isDateBlocked(formData.date, bookingSettings)
                  if (!check.blocked) return null
                  return (
                    <p className="mt-1 flex items-center gap-1 text-xs text-amber-600">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {check.reason} Manual bookings can still be added.
                    </p>
                  )
                })()}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Time (optional)
                </label>
                <input
                  name="time"
                  type="time"
                  value={formData.time}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="Leave empty for default window"
                />
              </div>
            </div>
          </div>

          {/* Recurring */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Recurring Pickup</h3>
            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.recurring}
                  onChange={(e) => setFormData(prev => ({ ...prev, recurring: e.target.checked }))}
                  className="h-5 w-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <div className="flex items-center gap-2">
                  <Repeat className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-medium text-gray-700">This is a recurring pickup (e.g. business)</span>
                </div>
              </label>

              {formData.recurring && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <div>
                    <label className="block text-sm font-medium text-purple-800 mb-1">Frequency</label>
                    <select
                      name="recurringFrequency"
                      value={formData.recurringFrequency}
                      onChange={handleChange}
                      className="input-field"
                    >
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Every 2 Weeks</option>
                      <option value="monthly">Monthly (every 4 weeks)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-purple-800 mb-1">Generate for how many weeks?</label>
                    <select
                      name="recurringWeeks"
                      value={formData.recurringWeeks}
                      onChange={handleChange}
                      className="input-field"
                    >
                      <option value="4">4 weeks</option>
                      <option value="8">8 weeks</option>
                      <option value="12">12 weeks</option>
                      <option value="26">26 weeks (6 months)</option>
                      <option value="52">52 weeks (1 year)</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Address */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Address</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Street Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="123 Main Street"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Apt / Unit #
                  </label>
                  <input
                    name="apartment"
                    value={formData.apartment}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="Apt 4, Unit B, etc."
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    City <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="Sault Ste. Marie"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Province <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="ON"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Postal Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="zip"
                    value={formData.zip}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="P6A 1A1"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Items and Notes */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Details</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Items <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="items"
                  value={formData.items}
                  onChange={handleChange}
                  rows={3}
                  className="input-field"
                  placeholder={formData.type === 'delivery' ? 'Items to deliver' : 'Items to pick up (e.g., couch, dresser, boxes of clothes)'}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  rows={2}
                  className="input-field"
                  placeholder="Access instructions, special notes, etc."
                />
              </div>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>
          )}

          {capacityWarning && (
            <p className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 p-3 rounded-lg">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{capacityWarning}</span>
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn-primary flex items-center gap-2">
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Add Booking
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}