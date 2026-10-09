import { useEffect, useMemo, useState } from 'react'
import {
  collection,
  addDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp
} from 'firebase/firestore'
import { db } from '../firebase'
import { geocodeAddress } from '../utils/geocode'
import {
  subscribeBookingSettings,
  isDateBlocked,
  countBookingsOnDate,
  getMaxForDate,
  DEFAULT_BOOKING_SETTINGS
} from '../utils/bookingSettings'
import {
  computeScheduleDates,
  FREQUENCY_OPTIONS,
  WEEK_OF_MONTH_OPTIONS
} from '../utils/customerBookings'
import {
  X,
  Plus,
  Repeat,
  AlertTriangle,
  Briefcase,
  Search,
  Contact,
  Check,
  MapPin
} from 'lucide-react'
import { format, addWeeks } from 'date-fns'
import { TRUCKS } from '../utils/trucks'

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function emptyForm(initialDate) {
  return {
    name: '',
    email: '',
    phone: '',
    address: '',
    apartment: '',
    city: 'Sault Ste. Marie',
    state: 'ON',
    zip: '',
    date: initialDate || format(new Date(), 'yyyy-MM-dd'),
    time: '',
    items: '',
    notes: '',
    status: 'pending',
    type: 'pickup',
    truck: '',
    isBusiness: false,
    recurring: false,
    recurringFrequency: 'weekly',
    recurringWeekOfMonth: '1',
    recurringWeeks: '8'
  }
}

// Copies a saved customer's details into the booking form.
function formFromCustomer(customer, prev) {
  return {
    ...prev,
    name: customer.name || '',
    email: customer.email || '',
    phone: customer.phone || '',
    address: customer.address || '',
    apartment: customer.apartment || '',
    city: customer.city || 'Sault Ste. Marie',
    state: customer.state || 'ON',
    zip: customer.zip || '',
    items: prev.items || customer.schedule?.defaultItems || '',
    notes: prev.notes || customer.notes || '',
    type: customer.schedule?.type || prev.type || 'pickup',
    isBusiness: Boolean(customer.isBusiness)
  }
}

function sameAddress(a, b) {
  const norm = (v) => String(v || '').trim().toLowerCase()
  return (
    norm(a.address) === norm(b.address) &&
    norm(a.city) === norm(b.city) &&
    norm(a.state) === norm(b.state) &&
    norm(a.zip) === norm(b.zip)
  )
}

export default function AddBookingModal({ onClose, initialCustomer = null, initialDate = null }) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [capacityWarning, setCapacityWarning] = useState('')
  const [overrideCapacity, setOverrideCapacity] = useState(false)
  const [bookingSettings, setBookingSettings] = useState(DEFAULT_BOOKING_SETTINGS)

  // Saved-customer picker
  const [customers, setCustomers] = useState([])
  const [customersLoading, setCustomersLoading] = useState(true)
  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerResults, setShowCustomerResults] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState(initialCustomer)
  const [saveAsCustomer, setSaveAsCustomer] = useState(false)

  useEffect(() => {
    const unsub = subscribeBookingSettings(setBookingSettings)
    return () => unsub()
  }, [])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'customers'), orderBy('name', 'asc')))
        if (cancelled) return
        const rows = []
        snap.forEach((d) => rows.push({ id: d.id, ...d.data() }))
        setCustomers(rows)
      } catch (err) {
        console.warn('Failed to load saved customers:', err)
      } finally {
        if (!cancelled) setCustomersLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const [formData, setFormData] = useState(() => {
    const base = emptyForm(initialDate)
    return initialCustomer ? formFromCustomer(initialCustomer, base) : base
  })

  const customerMatches = useMemo(() => {
    const t = customerSearch.trim().toLowerCase()
    if (!t) return customers.slice(0, 8)
    return customers
      .filter(
        (c) =>
          c.name?.toLowerCase().includes(t) ||
          c.phone?.toLowerCase().includes(t) ||
          c.email?.toLowerCase().includes(t) ||
          c.address?.toLowerCase().includes(t)
      )
      .slice(0, 8)
  }, [customers, customerSearch])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (name === 'date') {
      setCapacityWarning('')
      setOverrideCapacity(false)
    }
  }

  const pickCustomer = (customer) => {
    setSelectedCustomer(customer)
    setFormData((prev) => formFromCustomer(customer, prev))
    setCustomerSearch('')
    setShowCustomerResults(false)
    setSaveAsCustomer(false)
  }

  const clearCustomer = () => {
    setSelectedCustomer(null)
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
      // Reuse the saved customer's pin when the address hasn't changed,
      // otherwise geocode the address.
      let coords = null
      if (
        selectedCustomer &&
        selectedCustomer.lat != null &&
        selectedCustomer.lng != null &&
        sameAddress(selectedCustomer, formData)
      ) {
        coords = { lat: selectedCustomer.lat, lng: selectedCustomer.lng }
      } else {
        try {
          coords = await geocodeAddress(formData.address, formData.city, formData.state, formData.zip)
        } catch (geoErr) {
          console.warn('Geocoding failed:', geoErr)
        }
      }

      // Build base booking data (exclude UI-only fields)
      const {
        recurring,
        recurringFrequency,
        recurringWeekOfMonth,
        recurringWeeks,
        ...bookingFields
      } = formData
      const recurringId = recurring ? `recurring_${Date.now()}` : null
      const firstDate = new Date(formData.date + 'T12:00:00')
      const dayOfWeek = firstDate.getDay()

      let customerId = selectedCustomer?.id || null

      // Optionally save a brand-new customer so they can be booked again
      // later without re-typing everything.
      if (!customerId && saveAsCustomer) {
        const customerRef = await addDoc(collection(db, 'customers'), {
          name: formData.name.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim(),
          address: formData.address.trim(),
          apartment: formData.apartment.trim(),
          city: formData.city.trim(),
          state: formData.state.trim(),
          zip: formData.zip.trim(),
          notes: formData.notes.trim(),
          isBusiness: Boolean(formData.isBusiness),
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
          schedule: {
            active: false,
            frequency: 'weekly',
            dayOfWeek,
            weekOfMonth: 1,
            type: formData.type,
            defaultItems: formData.items.trim(),
            startDate: formData.date
          },
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        })
        customerId = customerRef.id
      }

      const baseData = {
        ...bookingFields,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        manualEntry: true,
        ...(customerId && {
          customerId,
          customerName: formData.name.trim()
        }),
        ...(recurring && {
          recurring: true,
          recurringId,
          recurringFrequency,
          recurringDayOfWeek: dayOfWeek,
          recurringWeekOfMonth: Number(recurringWeekOfMonth) || 1
        })
      }

      // Create the first booking
      await addDoc(collection(db, 'bookings'), baseData)

      // Create future recurring bookings
      if (recurring) {
        const totalWeeks = parseInt(recurringWeeks) || 8
        const through = addWeeks(firstDate, totalWeeks)
        const dates = computeScheduleDates(
          {
            startDate: formData.date,
            dayOfWeek,
            frequency: recurringFrequency,
            weekOfMonth: Number(recurringWeekOfMonth) || 1
          },
          firstDate,
          through
        ).filter((d) => d !== formData.date)

        for (const dateStr of dates) {
          await addDoc(collection(db, 'bookings'), {
            ...baseData,
            date: dateStr,
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

  const bookingDayLabel = (() => {
    const d = new Date(formData.date + 'T12:00:00')
    return isNaN(d.getTime()) ? 'day' : DAY_LABELS[d.getDay()]
  })()

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
          {/* Saved customer picker */}
          <div className="p-4 bg-habitat-green/5 rounded-lg border border-habitat-green/30">
            <div className="flex items-center gap-2 mb-2">
              <Contact className="h-4 w-4 text-habitat-green" />
              <h3 className="text-sm font-semibold text-gray-700">Saved Customer</h3>
            </div>

            {selectedCustomer ? (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 flex items-center gap-2">
                    <Check className="h-4 w-4 text-habitat-green" />
                    {selectedCustomer.name}
                  </p>
                  <p className="text-xs text-gray-500 truncate flex items-center gap-1 mt-0.5">
                    <MapPin className="h-3 w-3" />
                    {selectedCustomer.address}
                    {selectedCustomer.city ? `, ${selectedCustomer.city}` : ''}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Details filled in below. Edit anything for this booking only.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={clearCustomer}
                  className="text-xs text-gray-500 hover:text-gray-800 underline shrink-0"
                >
                  Use a different customer
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value)
                    setShowCustomerResults(true)
                  }}
                  onFocus={() => setShowCustomerResults(true)}
                  onBlur={() => setTimeout(() => setShowCustomerResults(false), 150)}
                  className="input-field pl-10"
                  placeholder={
                    customersLoading
                      ? 'Loading saved customers...'
                      : customers.length === 0
                      ? 'No saved customers yet — fill in the form below'
                      : 'Search saved customers or businesses by name, phone, or address...'
                  }
                  disabled={customersLoading || customers.length === 0}
                />
                {showCustomerResults && customers.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                    {customerMatches.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-gray-500">No matching customers.</p>
                    ) : (
                      customerMatches.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => pickCustomer(c)}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                        >
                          <p className="text-sm font-medium text-gray-900 flex items-center gap-2">
                            {c.name}
                            {c.isBusiness && (
                              <Briefcase className="h-3 w-3 text-pink-600" />
                            )}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {c.address}
                            {c.city ? `, ${c.city}` : ''}
                            {c.phone ? ` · ${c.phone}` : ''}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                )}
                <p className="mt-2 text-xs text-gray-500">
                  Pick a saved customer to fill in their details, or type a new one below.
                </p>
              </div>
            )}
          </div>

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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Assign Truck (optional)</label>
            <select
              name="truck"
              value={formData.truck}
              onChange={handleChange}
              className="input-field"
            >
              <option value="">Unassigned</option>
              {TRUCKS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
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

              {!selectedCustomer && (
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveAsCustomer}
                    onChange={(e) => setSaveAsCustomer(e.target.checked)}
                    className="h-5 w-5 rounded border-gray-300 text-habitat-green focus:ring-habitat-green"
                  />
                  <span className="text-sm text-gray-700">
                    <span className="font-medium">Save this customer for next time</span>
                    <span className="block text-xs text-gray-500">
                      Adds them to the Customers page so you can book them with one click.
                    </span>
                  </span>
                </label>
              )}
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
                  <span className="text-sm font-medium text-gray-700">Repeat this booking (e.g. business)</span>
                </div>
              </label>

              {formData.recurring && (
                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-purple-800 mb-1">Frequency</label>
                      <select
                        name="recurringFrequency"
                        value={formData.recurringFrequency}
                        onChange={handleChange}
                        className="input-field"
                      >
                        {FREQUENCY_OPTIONS.map((f) => (
                          <option key={f.value} value={f.value}>{f.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-purple-800 mb-1">Generate for how long?</label>
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

                  {formData.recurringFrequency === 'nth-weekday' && (
                    <div>
                      <label className="block text-sm font-medium text-purple-800 mb-1">
                        Which {bookingDayLabel} of the month?
                      </label>
                      <select
                        name="recurringWeekOfMonth"
                        value={formData.recurringWeekOfMonth}
                        onChange={handleChange}
                        className="input-field"
                      >
                        {WEEK_OF_MONTH_OPTIONS.map((w) => (
                          <option key={w.value} value={w.value}>{w.label}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <p className="text-xs text-purple-700">
                    Repeats on {bookingDayLabel}s starting from the date above.
                    For a schedule that runs indefinitely, save the customer and set up a recurring
                    schedule on the Customers page instead.
                  </p>
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
