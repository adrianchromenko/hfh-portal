import { useState, useEffect } from 'react'
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp
} from 'firebase/firestore'
import { db } from '../firebase'
import { geocodeAddress } from '../utils/geocode'
import {
  subscribeBookingSettings,
  DEFAULT_BOOKING_SETTINGS
} from '../utils/bookingSettings'
import { regenerateFutureBookings } from '../utils/customerBookings'
import { X, Save, Repeat } from 'lucide-react'
import { format } from 'date-fns'

const DAYS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 0, label: 'Sunday' }
]

export default function CustomerModal({ customer, onClose }) {
  const isEdit = Boolean(customer?.id)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [bookingSettings, setBookingSettings] = useState(DEFAULT_BOOKING_SETTINGS)

  useEffect(() => {
    const unsub = subscribeBookingSettings(setBookingSettings)
    return () => unsub()
  }, [])

  const [formData, setFormData] = useState({
    name: customer?.name || '',
    email: customer?.email || '',
    phone: customer?.phone || '',
    address: customer?.address || '',
    apartment: customer?.apartment || '',
    city: customer?.city || 'Sault Ste. Marie',
    state: customer?.state || 'ON',
    zip: customer?.zip || '',
    notes: customer?.notes || '',
    scheduleActive: customer?.schedule?.active ?? true,
    frequency: customer?.schedule?.frequency || 'weekly',
    dayOfWeek: customer?.schedule?.dayOfWeek ?? 1,
    type: customer?.schedule?.type || 'pickup',
    defaultItems: customer?.schedule?.defaultItems || '',
    startDate: customer?.schedule?.startDate || format(new Date(), 'yyyy-MM-dd')
  })

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const required = ['name', 'phone', 'address', 'city', 'state', 'zip']
    for (const field of required) {
      if (!String(formData[field] || '').trim()) {
        setError(`Please fill in the ${field} field.`)
        return
      }
    }

    if (formData.scheduleActive && !formData.defaultItems.trim()) {
      setError('Please list the default items for this recurring pickup/delivery.')
      return
    }

    setSubmitting(true)

    try {
      let coords = { lat: customer?.lat ?? null, lng: customer?.lng ?? null }
      const addressChanged =
        !isEdit ||
        customer?.address !== formData.address ||
        customer?.city !== formData.city ||
        customer?.state !== formData.state ||
        customer?.zip !== formData.zip

      if (addressChanged) {
        try {
          const result = await geocodeAddress(
            formData.address,
            formData.city,
            formData.state,
            formData.zip
          )
          if (result) coords = result
        } catch (geoErr) {
          console.warn('Geocoding failed:', geoErr)
        }
      }

      const customerData = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        address: formData.address.trim(),
        apartment: formData.apartment.trim(),
        city: formData.city.trim(),
        state: formData.state.trim(),
        zip: formData.zip.trim(),
        notes: formData.notes.trim(),
        lat: coords.lat,
        lng: coords.lng,
        schedule: {
          active: formData.scheduleActive,
          frequency: formData.frequency,
          dayOfWeek: Number(formData.dayOfWeek),
          type: formData.type,
          defaultItems: formData.defaultItems.trim(),
          startDate: formData.startDate
        },
        updatedAt: serverTimestamp()
      }

      let customerId
      if (isEdit) {
        customerId = customer.id
        await updateDoc(doc(db, 'customers', customerId), customerData)
      } else {
        const docRef = await addDoc(collection(db, 'customers'), {
          ...customerData,
          createdAt: serverTimestamp()
        })
        customerId = docRef.id
      }

      await regenerateFutureBookings(customerData, customerId, bookingSettings)

      onClose()
    } catch (err) {
      console.error('Error saving customer:', err)
      setError('Failed to save customer. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4"
      style={{ zIndex: 9999 }}
    >
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {isEdit ? 'Edit Customer' : 'Add Customer'}
            </h2>
            <p className="text-sm text-gray-500">
              Recurring pickups or deliveries will be generated automatically.
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
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
                  placeholder="Customer or business name"
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

          {/* Recurring Schedule */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Repeat className="h-4 w-4 text-purple-600" />
              <h3 className="text-sm font-semibold text-gray-700">Recurring Schedule</h3>
            </div>

            <label className="flex items-center gap-3 cursor-pointer mb-4">
              <input
                type="checkbox"
                name="scheduleActive"
                checked={formData.scheduleActive}
                onChange={handleChange}
                className="h-5 w-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <span className="text-sm font-medium text-gray-700">
                Schedule is active (bookings will be generated indefinitely)
              </span>
            </label>

            {formData.scheduleActive && (
              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-purple-800 mb-1">
                      Frequency
                    </label>
                    <select
                      name="frequency"
                      value={formData.frequency}
                      onChange={handleChange}
                      className="input-field"
                    >
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Every 2 Weeks</option>
                      <option value="monthly">Monthly (every 4 weeks)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-purple-800 mb-1">
                      Day of Week
                    </label>
                    <select
                      name="dayOfWeek"
                      value={formData.dayOfWeek}
                      onChange={handleChange}
                      className="input-field"
                    >
                      {DAYS.map((d) => (
                        <option key={d.value} value={d.value}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-purple-800 mb-1">Type</label>
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
                    <label className="block text-sm font-medium text-purple-800 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      name="startDate"
                      value={formData.startDate}
                      onChange={handleChange}
                      className="input-field"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-purple-800 mb-1">
                    Default Items <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="defaultItems"
                    value={formData.defaultItems}
                    onChange={handleChange}
                    rows={2}
                    className="input-field"
                    placeholder="e.g. Weekly store donation pickup — boxes, furniture"
                  />
                </div>

                <p className="text-xs text-purple-700">
                  Bookings will be generated for 52 weeks ahead and auto-extended as needed.
                  Blocked dates in Settings will be skipped.
                </p>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={2}
              className="input-field"
              placeholder="Access instructions, gate codes, contact preferences, etc."
            />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}

          <div className="flex items-center justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {isEdit ? 'Save Changes' : 'Add Customer'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
