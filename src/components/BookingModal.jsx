import { useState } from 'react'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { format } from 'date-fns'
import {
  Mail,
  Phone,
  Calendar,
  Clock,
  Package,
  FileText,
  X,
  Trash2,
  MapPin,
  Edit2,
  Save,
  Truck,
  Repeat
} from 'lucide-react'
import StatusBadge from './StatusBadge'

export default function BookingModal({ booking, onClose, onUpdateStatus, onDelete, onApprove, onDeny }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editData, setEditData] = useState({
    name: booking.name || '',
    email: booking.email || '',
    phone: booking.phone || '',
    date: booking.date || '',
    address: booking.address || '',
    apartment: booking.apartment || '',
    city: booking.city || '',
    state: booking.state || '',
    zip: booking.zip || '',
    items: booking.items || '',
    notes: booking.notes || ''
  })

  const handleEditChange = (e) => {
    setEditData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateDoc(doc(db, 'bookings', booking.id), {
        ...editData,
        updatedAt: serverTimestamp()
      })
      setEditing(false)
      // Update the booking object in place so the modal reflects changes
      Object.assign(booking, editData)
    } catch (error) {
      console.error('Error updating booking:', error)
      alert('Error saving changes. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const bookingType = booking.type || 'pickup'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-gray-900">
                {editing ? 'Edit Booking' : booking.name}
              </h2>
              {!editing && (
                <>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                    bookingType === 'delivery'
                      ? 'bg-orange-100 text-orange-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {bookingType === 'delivery' ? (
                      <Truck className="h-3 w-3" />
                    ) : (
                      <Package className="h-3 w-3" />
                    )}
                    {bookingType === 'delivery' ? 'Delivery' : 'Pickup'}
                  </span>
                  {booking.recurring && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                      <Repeat className="h-3 w-3" />
                      {booking.recurringFrequency === 'weekly' ? 'Weekly' : booking.recurringFrequency === 'biweekly' ? 'Bi-weekly' : 'Monthly'}
                    </span>
                  )}
                </>
              )}
            </div>
            <p className="text-sm text-gray-500">
              {editing ? 'Modify booking details below' : 'Booking Details'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-habitat-green bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                title="Edit booking"
              >
                <Edit2 className="h-4 w-4" />
                Edit
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <div className="flex flex-wrap gap-2">
              {['pending', 'confirmed', 'completed', 'cancelled'].map((status) => (
                <button
                  key={status}
                  onClick={() => onUpdateStatus(booking.id, status)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    booking.status === status
                      ? 'bg-habitat-green text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Contact Information</h3>
            {editing ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Name</label>
                  <input name="name" value={editData.name} onChange={handleEditChange} className="input-field" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Email</label>
                    <input name="email" type="email" value={editData.email} onChange={handleEditChange} className="input-field" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Phone</label>
                    <input name="phone" type="tel" value={editData.phone} onChange={handleEditChange} className="input-field" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Mail className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Email</p>
                    <a href={`mailto:${booking.email}`} className="text-habitat-green hover:underline">
                      {booking.email}
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Phone className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Phone</p>
                    <a href={`tel:${booking.phone}`} className="text-habitat-green hover:underline">
                      {booking.phone}
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Pickup/Delivery Info */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              {bookingType === 'delivery' ? 'Delivery' : 'Pickup'} Details
            </h3>
            {editing ? (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Date</label>
                <input name="date" type="date" value={editData.date} onChange={handleEditChange} className="input-field" />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Calendar className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Date</p>
                    <p className="font-medium">
                      {booking.date
                        ? format(new Date(booking.date + 'T12:00:00'), 'EEEE, MMMM d, yyyy')
                        : 'Not set'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Clock className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Time</p>
                    <p className="font-medium">
                      {booking.time ? formatTime(booking.time) : '10:00 AM - 4:00 PM'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Address */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Address</h3>
            {editing ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Street Address</label>
                    <input name="address" value={editData.address} onChange={handleEditChange} className="input-field" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Apt / Unit #</label>
                    <input name="apartment" value={editData.apartment} onChange={handleEditChange} className="input-field" placeholder="Apt 4, Unit B, etc." />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">City</label>
                    <input name="city" value={editData.city} onChange={handleEditChange} className="input-field" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Province</label>
                    <input name="state" value={editData.state} onChange={handleEditChange} className="input-field" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Postal Code</label>
                    <input name="zip" value={editData.zip} onChange={handleEditChange} className="input-field" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="font-medium">
                    {booking.address}
                    {booking.apartment && <span className="text-gray-500 ml-1">({booking.apartment})</span>}
                  </p>
                  <p className="text-gray-600">
                    {booking.city}, {booking.state} {booking.zip}
                  </p>
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(
                      `${booking.address}, ${booking.city}, ${booking.state} ${booking.zip}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-habitat-green hover:underline mt-1 inline-block"
                  >
                    Open in Google Maps
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Items */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Items for {bookingType === 'delivery' ? 'Delivery' : 'Pickup'}
            </h3>
            {editing ? (
              <textarea
                name="items"
                value={editData.items}
                onChange={handleEditChange}
                rows={3}
                className="input-field"
              />
            ) : (
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <Package className="h-5 w-5 text-gray-400 mt-0.5" />
                <p className="text-gray-700">{booking.items || 'No items specified'}</p>
              </div>
            )}
          </div>

          {/* Donation Photos */}
          {booking.photos && booking.photos.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">Donation Photos</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {booking.photos.map((url, index) => (
                  <a
                    key={index}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block aspect-square rounded-lg overflow-hidden border border-gray-200 hover:border-habitat-green transition-colors"
                  >
                    <img
                      src={url}
                      alt={`Donation photo ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Additional Notes</h3>
            {editing ? (
              <textarea
                name="notes"
                value={editData.notes}
                onChange={handleEditChange}
                rows={3}
                className="input-field"
                placeholder="No notes"
              />
            ) : (
              booking.notes ? (
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <FileText className="h-5 w-5 text-gray-400 mt-0.5" />
                  <p className="text-gray-700">{booking.notes}</p>
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">No notes</p>
              )
            )}
          </div>

          {/* Created At */}
          {booking.createdAt && !editing && (
            <p className="text-xs text-gray-400">
              Booking created:{' '}
              {booking.createdAt.toDate
                ? format(booking.createdAt.toDate(), 'PPpp')
                : format(new Date(booking.createdAt), 'PPpp')}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t bg-gray-50">
          {editing ? (
            <>
              <button
                onClick={() => setEditing(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary flex items-center gap-2"
              >
                {saving ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onDelete(booking.id)}
                className="flex items-center gap-2 text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
              <button onClick={onClose} className="btn-primary">
                Close
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function formatTime(time) {
  if (!time) return ''
  const [hours, minutes] = time.split(':')
  const h = parseInt(hours)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h
  return `${hour}:${minutes} ${ampm}`
}
