import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  User,
  Shield,
  Bell,
  Database,
  Save,
  CheckCircle,
  CalendarX,
  Plus,
  X
} from 'lucide-react'
import {
  subscribeBookingSettings,
  saveBookingSettings,
  DEFAULT_BOOKING_SETTINGS
} from '../utils/bookingSettings'

const WEEKDAYS = [
  { value: 'sunday', label: 'Sunday' },
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' }
]

export default function Settings() {
  const { currentUser } = useAuth()
  const [saved, setSaved] = useState(false)
  const [notifications, setNotifications] = useState({
    newBooking: true,
    statusChange: true,
    dailySummary: false
  })

  const [bookingSettings, setBookingSettings] = useState(DEFAULT_BOOKING_SETTINGS)
  const [newBlockedDate, setNewBlockedDate] = useState('')
  const [savingBooking, setSavingBooking] = useState(false)
  const [bookingError, setBookingError] = useState('')

  useEffect(() => {
    const unsub = subscribeBookingSettings(setBookingSettings)
    return () => unsub()
  }, [])

  const toggleBookingDay = (day) => {
    setBookingSettings((prev) => {
      const has = prev.bookingDays.includes(day)
      return {
        ...prev,
        bookingDays: has
          ? prev.bookingDays.filter((d) => d !== day)
          : [...prev.bookingDays, day]
      }
    })
  }

  const toggleBlockedDay = (day) => {
    setBookingSettings((prev) => {
      const has = prev.blockedDays.includes(day)
      return {
        ...prev,
        blockedDays: has
          ? prev.blockedDays.filter((d) => d !== day)
          : [...prev.blockedDays, day]
      }
    })
  }

  const addBlockedDate = () => {
    setBookingError('')
    if (!newBlockedDate) return
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newBlockedDate)) {
      setBookingError('Date must be in YYYY-MM-DD format.')
      return
    }
    setBookingSettings((prev) => {
      if (prev.blockedDates.includes(newBlockedDate)) return prev
      return {
        ...prev,
        blockedDates: [...prev.blockedDates, newBlockedDate].sort()
      }
    })
    setNewBlockedDate('')
  }

  const removeBlockedDate = (date) => {
    setBookingSettings((prev) => ({
      ...prev,
      blockedDates: prev.blockedDates.filter((d) => d !== date)
    }))
  }

  const handleSaveBookingSettings = async () => {
    setBookingError('')
    setSavingBooking(true)
    try {
      await saveBookingSettings(bookingSettings)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      console.error('Failed to save booking settings:', err)
      setBookingError('Could not save. Please try again.')
    } finally {
      setSavingBooking(false)
    }
  }

  function handleSave() {
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const formatDateLabel = (dateString) => {
    const d = new Date(dateString + 'T12:00:00')
    if (isNaN(d.getTime())) return dateString
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500">Manage your account and preferences</p>
      </div>

      {saved && (
        <div className="flex items-center gap-2 bg-green-50 text-green-700 px-4 py-3 rounded-lg">
          <CheckCircle className="h-5 w-5" />
          <span>Settings saved successfully</span>
        </div>
      )}

      <div className="grid gap-6">
        {/* Booking Availability */}
        <div className="card">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-habitat-green/10 rounded-lg">
              <CalendarX className="h-5 w-5 text-habitat-green" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Booking Availability</h2>
              <p className="text-sm text-gray-500">
                Control which days customers can book. Applies to the website form and manual bookings.
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Available Weekdays</h3>
              <p className="text-xs text-gray-500 mb-3">
                Uncheck any day your team does not accept pickups or deliveries.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {WEEKDAYS.map((day) => {
                  const checked = bookingSettings.bookingDays.includes(day.value)
                  return (
                    <label
                      key={day.value}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition ${
                        checked
                          ? 'border-habitat-green bg-habitat-green/5'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleBookingDay(day.value)}
                        className="w-4 h-4 text-habitat-green rounded focus:ring-habitat-green"
                      />
                      <span className="text-sm text-gray-900">{day.label}</span>
                    </label>
                  )
                })}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Temporarily Block Weekdays</h3>
              <p className="text-xs text-gray-500 mb-3">
                Use this to block a weekday that is normally available (e.g. quickly pause Wednesdays).
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {WEEKDAYS.map((day) => {
                  const checked = bookingSettings.blockedDays.includes(day.value)
                  return (
                    <label
                      key={day.value}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition ${
                        checked
                          ? 'border-red-400 bg-red-50'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleBlockedDay(day.value)}
                        className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                      />
                      <span className="text-sm text-gray-900">{day.label}</span>
                    </label>
                  )
                })}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Block Specific Dates</h3>
              <p className="text-xs text-gray-500 mb-3">
                Block individual dates for holidays, staff meetings, or closures.
              </p>
              <div className="flex gap-2 mb-3">
                <input
                  type="date"
                  value={newBlockedDate}
                  onChange={(e) => setNewBlockedDate(e.target.value)}
                  className="input-field flex-1"
                />
                <button
                  type="button"
                  onClick={addBlockedDate}
                  className="btn-primary flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add
                </button>
              </div>

              {bookingSettings.blockedDates.length === 0 ? (
                <p className="text-sm text-gray-400 italic">No specific dates blocked.</p>
              ) : (
                <div className="space-y-2">
                  {bookingSettings.blockedDates.map((date) => (
                    <div
                      key={date}
                      className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg"
                    >
                      <span className="text-sm text-gray-900">{formatDateLabel(date)}</span>
                      <button
                        type="button"
                        onClick={() => removeBlockedDate(date)}
                        className="p-1 hover:bg-gray-200 rounded text-gray-500 hover:text-red-600"
                        aria-label={`Remove ${date}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {bookingError && (
              <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{bookingError}</p>
            )}

            <div className="flex justify-end pt-2 border-t">
              <button
                onClick={handleSaveBookingSettings}
                disabled={savingBooking}
                className="btn-primary flex items-center gap-2"
              >
                {savingBooking ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save Availability
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Account Settings */}
        <div className="card">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-habitat-green/10 rounded-lg">
              <User className="h-5 w-5 text-habitat-green" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Account</h2>
              <p className="text-sm text-gray-500">Your account information</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={currentUser?.email || ''}
                disabled
                className="input-field bg-gray-50"
              />
              <p className="text-xs text-gray-500 mt-1">
                Contact your administrator to change your email
              </p>
            </div>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="card">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-habitat-green/10 rounded-lg">
              <Bell className="h-5 w-5 text-habitat-green" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Notifications</h2>
              <p className="text-sm text-gray-500">
                Configure email notifications
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="font-medium text-gray-900">New Booking</p>
                <p className="text-sm text-gray-500">
                  Receive an email when a new booking is created
                </p>
              </div>
              <input
                type="checkbox"
                checked={notifications.newBooking}
                onChange={(e) =>
                  setNotifications({ ...notifications, newBooking: e.target.checked })
                }
                className="w-5 h-5 text-habitat-green rounded focus:ring-habitat-green"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="font-medium text-gray-900">Status Changes</p>
                <p className="text-sm text-gray-500">
                  Receive updates when booking status changes
                </p>
              </div>
              <input
                type="checkbox"
                checked={notifications.statusChange}
                onChange={(e) =>
                  setNotifications({
                    ...notifications,
                    statusChange: e.target.checked
                  })
                }
                className="w-5 h-5 text-habitat-green rounded focus:ring-habitat-green"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="font-medium text-gray-900">Daily Summary</p>
                <p className="text-sm text-gray-500">
                  Receive a daily email with upcoming pickups
                </p>
              </div>
              <input
                type="checkbox"
                checked={notifications.dailySummary}
                onChange={(e) =>
                  setNotifications({
                    ...notifications,
                    dailySummary: e.target.checked
                  })
                }
                className="w-5 h-5 text-habitat-green rounded focus:ring-habitat-green"
              />
            </label>
          </div>
        </div>

        {/* Firebase Connection */}
        <div className="card">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-habitat-green/10 rounded-lg">
              <Database className="h-5 w-5 text-habitat-green" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Database Connection</h2>
              <p className="text-sm text-gray-500">Firebase Firestore status</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <p className="font-medium text-green-800">Connected</p>
              <p className="text-sm text-green-600">
                Real-time sync is active with your WordPress booking form
              </p>
            </div>
          </div>

          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              Connection Details
            </h3>
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Collection</dt>
                <dd className="font-mono text-gray-900">bookings</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Sync Mode</dt>
                <dd className="text-gray-900">Real-time</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Security */}
        <div className="card">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-habitat-green/10 rounded-lg">
              <Shield className="h-5 w-5 text-habitat-green" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Security</h2>
              <p className="text-sm text-gray-500">Password and security options</p>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">Password</p>
              <p className="text-sm text-gray-500">
                Last changed: Unknown
              </p>
            </div>
            <button
              onClick={() => {
                alert('Password reset email would be sent to ' + currentUser?.email)
              }}
              className="btn-secondary text-sm"
            >
              Change Password
            </button>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button onClick={handleSave} className="btn-primary flex items-center gap-2">
          <Save className="h-4 w-4" />
          Save Changes
        </button>
      </div>
    </div>
  )
}
