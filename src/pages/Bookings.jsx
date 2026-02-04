import { useState, useEffect } from 'react'
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { format } from 'date-fns'
import {
  Search,
  Filter,
  ChevronDown,
  MoreVertical,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Clock,
  Package,
  FileText,
  X,
  Check,
  Trash2,
  Eye
} from 'lucide-react'
import StatusBadge from '../components/StatusBadge'

const statusOptions = ['all', 'pending', 'confirmed', 'completed', 'cancelled']

export default function Bookings() {
  const [bookings, setBookings] = useState([])
  const [filteredBookings, setFilteredBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    const bookingsRef = collection(db, 'bookings')
    const q = query(bookingsRef, orderBy('createdAt', 'desc'))

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const bookingsData = []
      snapshot.forEach((doc) => {
        bookingsData.push({ id: doc.id, ...doc.data() })
      })
      setBookings(bookingsData)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    let filtered = [...bookings]

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter((b) => b.status === statusFilter)
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(
        (b) =>
          b.name?.toLowerCase().includes(term) ||
          b.email?.toLowerCase().includes(term) ||
          b.phone?.includes(term) ||
          b.address?.toLowerCase().includes(term) ||
          b.city?.toLowerCase().includes(term)
      )
    }

    setFilteredBookings(filtered)
  }, [bookings, searchTerm, statusFilter])

  async function updateBookingStatus(bookingId, newStatus) {
    try {
      await updateDoc(doc(db, 'bookings', bookingId), {
        status: newStatus,
        updatedAt: new Date()
      })
    } catch (error) {
      console.error('Error updating booking:', error)
    }
  }

  async function deleteBooking(bookingId) {
    if (!confirm('Are you sure you want to delete this booking?')) return
    try {
      await deleteDoc(doc(db, 'bookings', bookingId))
      setSelectedBooking(null)
    } catch (error) {
      console.error('Error deleting booking:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-habitat-green"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
          <p className="text-gray-500">
            {filteredBookings.length} booking{filteredBookings.length !== 1 ? 's' : ''} found
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email, phone, or address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10"
            />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input-field appearance-none pr-10 min-w-[150px]"
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Bookings List */}
      {filteredBookings.length === 0 ? (
        <div className="card text-center py-12">
          <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">No bookings found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredBookings.map((booking) => (
            <div
              key={booking.id}
              className="card hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setSelectedBooking(booking)}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-gray-900">{booking.name}</h3>
                    <StatusBadge status={booking.status} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {booking.date
                        ? format(new Date(booking.date), 'MMM d, yyyy')
                        : 'No date'}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {booking.time ? formatTime(booking.time) : 'No time'}
                    </div>
                    <div className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {booking.city}, {booking.state}
                    </div>
                    <div className="flex items-center gap-1">
                      <Phone className="h-4 w-4" />
                      {booking.phone}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedBooking(booking)
                    }}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <Eye className="h-5 w-5 text-gray-500" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Booking Detail Modal */}
      {selectedBooking && (
        <BookingModal
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onUpdateStatus={updateBookingStatus}
          onDelete={deleteBooking}
        />
      )}
    </div>
  )
}

function BookingModal({ booking, onClose, onUpdateStatus, onDelete }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{booking.name}</h2>
            <p className="text-sm text-gray-500">Booking Details</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="h-5 w-5" />
          </button>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Mail className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Email</p>
                  <a
                    href={`mailto:${booking.email}`}
                    className="text-habitat-green hover:underline"
                  >
                    {booking.email}
                  </a>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Phone className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Phone</p>
                  <a
                    href={`tel:${booking.phone}`}
                    className="text-habitat-green hover:underline"
                  >
                    {booking.phone}
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Pickup Info */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Pickup Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Calendar className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Date</p>
                  <p className="font-medium">
                    {booking.date
                      ? format(new Date(booking.date), 'EEEE, MMMM d, yyyy')
                      : 'Not set'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Clock className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Time</p>
                  <p className="font-medium">
                    {booking.time ? formatTime(booking.time) : 'Not set'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Address */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Address</h3>
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="font-medium">{booking.address}</p>
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
          </div>

          {/* Items */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Items for Pickup</h3>
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <Package className="h-5 w-5 text-gray-400 mt-0.5" />
              <p className="text-gray-700">{booking.items || 'No items specified'}</p>
            </div>
          </div>

          {/* Notes */}
          {booking.notes && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">Additional Notes</h3>
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <FileText className="h-5 w-5 text-gray-400 mt-0.5" />
                <p className="text-gray-700">{booking.notes}</p>
              </div>
            </div>
          )}

          {/* Created At */}
          {booking.createdAt && (
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
