import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  User,
  Shield,
  Bell,
  Database,
  Save,
  CheckCircle,
  AlertCircle
} from 'lucide-react'

export default function Settings() {
  const { currentUser } = useAuth()
  const [saved, setSaved] = useState(false)
  const [notifications, setNotifications] = useState({
    newBooking: true,
    statusChange: true,
    dailySummary: false
  })

  function handleSave() {
    // In a real app, this would save to Firebase
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
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
                // In a real app, trigger password reset
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
