import { useState, useEffect } from 'react'
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { format, isToday, isTomorrow, isYesterday, parseISO } from 'date-fns'
import {
  Search,
  ChevronDown,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Clock,
  Package,
  FileText,
  X,
  Trash2,
  Eye,
  ChevronRight,
  Image
} from 'lucide-react'
import StatusBadge from '../components/StatusBadge'

const statusOptions = ['all', 'pending', 'confirmed', 'completed', 'cancelled']

export default function Bookings() {
  const [bookings, setBookings] = useState([])
  const [filteredBookings, setFilteredBookings] = useState([])
  const [groupedBookings, setGroupedBookings] = useState({})
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [collapsedDates, setCollapsedDates] = useState({})

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

    // Group by date
    const grouped = {}
    filtered.forEach((booking) => {
      const dateKey = booking.date || 'No Date'
      if (!grouped[dateKey]) {
        grouped[dateKey] = []
      }
      grouped[dateKey].push(booking)
    })

    // Sort bookings within each date by time
    Object.keys(grouped).forEach((date) => {
      grouped[date].sort((a, b) => (a.time || '').localeCompare(b.time || ''))
    })

    setGroupedBookings(grouped)
  }, [bookings, searchTerm, statusFilter])

  // Sort dates (most recent first, but "No Date" at the end)
  const sortedDates = Object.keys(groupedBookings).sort((a, b) => {
    if (a === 'No Date') return 1
    if (b === 'No Date') return -1
    return new Date(b) - new Date(a)
  })

  const toggleDateCollapse = (date) => {
    setCollapsedDates((prev) => ({
      ...prev,
      [date]: !prev[date]
    }))
  }

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

  function formatDateHeader(dateStr) {
    if (dateStr === 'No Date') return 'No Date Specified'

    try {
      const date = new Date(dateStr + 'T12:00:00')
      if (isToday(date)) return `Today - ${format(date, 'EEEE, MMMM d, yyyy')}`
      if (isTomorrow(date)) return `Tomorrow - ${format(date, 'EEEE, MMMM d, yyyy')}`
      if (isYesterday(date)) return `Yesterday - ${format(date, 'EEEE, MMMM d, yyyy')}`
      return format(date, 'EEEE, MMMM d, yyyy')
    } catch {
      return dateStr
    }
  }

  function getDateBadgeColor(dateStr) {
    if (dateStr === 'No Date') return 'bg-gray-100 text-gray-600'
    try {
      const date = new Date(dateStr + 'T12:00:00')
      if (isToday(date)) return 'bg-green-100 text-green-700'
      if (isTomorrow(date)) return 'bg-blue-100 text-blue-700'
      if (date < new Date()) return 'bg-gray-100 text-gray-600'
      return 'bg-purple-100 text-purple-700'
    } catch {
      return 'bg-gray-100 text-gray-600'
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
            {sortedDates.length > 0 && ` across ${sortedDates.length} date${sortedDates.length !== 1 ? 's' : ''}`}
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

      {/* Bookings List Grouped by Date */}
      {filteredBookings.length === 0 ? (
        <div className="card text-center py-12">
          <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">No bookings found</p>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedDates.map((date) => {
            const dateBookings = groupedBookings[date]
            const isCollapsed = collapsedDates[date]
            const pendingCount = dateBookings.filter((b) => b.status === 'pending').length
            const confirmedCount = dateBookings.filter((b) => b.status === 'confirmed').length

            return (
              <div key={date} className="space-y-3">
                {/* Date Header */}
                <button
                  onClick={() => toggleDateCollapse(date)}
                  className="w-full flex items-center justify-between p-4 bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${getDateBadgeColor(date)}`}>
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-gray-900">{formatDateHeader(date)}</h3>
                      <p className="text-sm text-gray-500">
                        {dateBookings.length} pickup{dateBookings.length !== 1 ? 's' : ''}
                        {pendingCount > 0 && (
                          <span className="ml-2 text-orange-600">• {pendingCount} pending</span>
                        )}
                        {confirmedCount > 0 && (
                          <span className="ml-2 text-green-600">• {confirmedCount} confirmed</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <ChevronRight
                    className={`h-5 w-5 text-gray-400 transition-transform ${
                      isCollapsed ? '' : 'rotate-90'
                    }`}
                  />
                </button>

                {/* Bookings for this date */}
                {!isCollapsed && (
                  <div className="space-y-3 pl-4 border-l-2 border-gray-200 ml-6">
                    {dateBookings.map((booking) => (
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
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm text-gray-500">
                              <div className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                {booking.time ? formatTime(booking.time) : '10 AM - 4 PM'}
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
              </div>
            )
          })}
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
