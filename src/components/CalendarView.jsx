import { useState, useMemo } from 'react'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  parseISO
} from 'date-fns'
import { ChevronLeft, ChevronRight, Calendar, Clock, MapPin, Phone, Mail, Check, X as XIcon } from 'lucide-react'
import StatusBadge from './StatusBadge'

export default function CalendarView({ bookings, onUpdateStatus, onApprove, onDeny }) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(null)
  const [showDayModal, setShowDayModal] = useState(false)

  // Group bookings by date
  const bookingsByDate = useMemo(() => {
    const grouped = {}
    bookings.forEach(booking => {
      if (booking.date) {
        const dateKey = booking.date
        if (!grouped[dateKey]) {
          grouped[dateKey] = []
        }
        grouped[dateKey].push(booking)
      }
    })
    // Sort bookings within each date by time
    Object.keys(grouped).forEach(date => {
      grouped[date].sort((a, b) => {
        if (!a.time && !b.time) return 0
        if (!a.time) return 1
        if (!b.time) return -1
        return a.time.localeCompare(b.time)
      })
    })
    return grouped
  }, [bookings])

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 })
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
    
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd })
  }, [currentMonth])

  const handleDateClick = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    if (bookingsByDate[dateStr]) {
      setSelectedDate(dateStr)
      setShowDayModal(true)
    }
  }

  const getDateBookings = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    return bookingsByDate[dateStr] || []
  }

  const formatTime = (time) => {
    if (!time) return 'No time specified'
    const [hours, minutes] = time.split(':')
    const h = parseInt(hours)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const hour = h > 12 ? h - 12 : h === 0 ? 12 : h
    return `${hour}:${minutes} ${ampm}`
  }

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => setCurrentMonth(new Date())}
              className="px-4 py-2 text-sm font-medium hover:bg-gray-100 rounded-lg transition-colors"
            >
              Today
            </button>
            <button
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Weekday Headers */}
        <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="bg-gray-50 p-2 text-center text-sm font-medium text-gray-700">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7 gap-px bg-gray-200 mt-px">
          {calendarDays.map(day => {
            const dateBookings = getDateBookings(day)
            const isCurrentMonth = isSameMonth(day, currentMonth)
            const isSelectedDay = selectedDate && isSameDay(parseISO(selectedDate), day)
            const pendingCount = dateBookings.filter(b => b.status === 'pending').length
            const confirmedCount = dateBookings.filter(b => b.status === 'confirmed').length
            
            return (
              <div
                key={day.toISOString()}
                onClick={() => handleDateClick(day)}
                className={`
                  bg-white min-h-[80px] p-2 cursor-pointer transition-all
                  ${!isCurrentMonth ? 'opacity-40' : ''}
                  ${isToday(day) ? 'bg-blue-50' : ''}
                  ${isSelectedDay ? 'ring-2 ring-habitat-green' : ''}
                  ${dateBookings.length > 0 ? 'hover:bg-gray-50' : ''}
                `}
              >
                <div className="flex flex-col h-full">
                  <span className={`
                    text-sm font-medium
                    ${isToday(day) ? 'text-blue-600' : 'text-gray-900'}
                  `}>
                    {format(day, 'd')}
                  </span>
                  
                  {dateBookings.length > 0 && (
                    <div className="mt-1 space-y-1">
                      <div className="flex items-center justify-center">
                        <span className="inline-flex items-center justify-center bg-habitat-green text-white text-xs font-bold rounded-full h-6 w-6">
                          {dateBookings.length}
                        </span>
                      </div>
                      {(pendingCount > 0 || confirmedCount > 0) && (
                        <div className="flex gap-1 justify-center">
                          {pendingCount > 0 && (
                            <span className="text-xs text-orange-600 font-medium">
                              {pendingCount}P
                            </span>
                          )}
                          {confirmedCount > 0 && (
                            <span className="text-xs text-green-600 font-medium">
                              {confirmedCount}C
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="card">
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center bg-habitat-green text-white text-xs font-bold rounded-full h-5 w-5">
              5
            </span>
            <span className="text-gray-600">Total pickups</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-orange-600 font-medium">P</span>
            <span className="text-gray-600">Pending approval</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-600 font-medium">C</span>
            <span className="text-gray-600">Confirmed</span>
          </div>
        </div>
      </div>

      {/* Day Detail Modal */}
      {showDayModal && selectedDate && (
        <DayDetailModal
          date={selectedDate}
          bookings={bookingsByDate[selectedDate] || []}
          onClose={() => {
            setShowDayModal(false)
            setSelectedDate(null)
          }}
          onUpdateStatus={onUpdateStatus}
          onApprove={onApprove}
          onDeny={onDeny}
          formatTime={formatTime}
        />
      )}
    </div>
  )
}

function DayDetailModal({ date, bookings, onClose, onUpdateStatus, onApprove, onDeny, formatTime }) {
  const [processingId, setProcessingId] = useState(null)

  const handleApprove = async (booking) => {
    setProcessingId(booking.id)
    await onApprove(booking)
    setProcessingId(null)
  }

  const handleDeny = async (booking) => {
    setProcessingId(booking.id)
    await onDeny(booking)
    setProcessingId(null)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {format(parseISO(date), 'EEEE, MMMM d, yyyy')}
            </h2>
            <p className="text-sm text-gray-500">
              {bookings.length} pickup{bookings.length !== 1 ? 's' : ''} scheduled
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {bookings.map((booking, index) => (
              <div key={booking.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    {/* Header with time and status */}
                    <div className="flex items-center gap-3 mb-3">
                      <span className="inline-flex items-center justify-center bg-habitat-green text-white text-sm font-bold rounded-full h-7 w-7">
                        {index + 1}
                      </span>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <span className="font-medium">{formatTime(booking.time)}</span>
                      </div>
                      <StatusBadge status={booking.status} />
                    </div>

                    {/* Customer Info */}
                    <h3 className="font-semibold text-gray-900 mb-2">{booking.name}</h3>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600 mb-3">
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <a href={`tel:${booking.phone}`} className="hover:text-habitat-green">
                          {booking.phone}
                        </a>
                      </div>
                      {booking.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-gray-400" />
                          <a href={`mailto:${booking.email}`} className="hover:text-habitat-green truncate">
                            {booking.email}
                          </a>
                        </div>
                      )}
                    </div>

                    <div className="flex items-start gap-2 text-sm text-gray-600 mb-3">
                      <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                      <div>
                        <p>{booking.address}</p>
                        <p>{booking.city}, {booking.state} {booking.zip}</p>
                      </div>
                    </div>

                    {booking.items && (
                      <div className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
                        <span className="font-medium">Items:</span> {booking.items}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col gap-2">
                    {booking.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleApprove(booking)}
                          disabled={processingId === booking.id}
                          className="btn-primary flex items-center gap-2 text-sm whitespace-nowrap"
                        >
                          {processingId === booking.id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                          Approve
                        </button>
                        <button
                          onClick={() => handleDeny(booking)}
                          disabled={processingId === booking.id}
                          className="btn-danger flex items-center gap-2 text-sm whitespace-nowrap"
                        >
                          {processingId === booking.id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                          ) : (
                            <XIcon className="h-4 w-4" />
                          )}
                          Deny
                        </button>
                      </>
                    )}
                    {booking.status === 'confirmed' && (
                      <div className="text-green-600 text-sm font-medium flex items-center gap-1">
                        <Check className="h-4 w-4" />
                        Approved
                      </div>
                    )}
                    {booking.status === 'cancelled' && (
                      <div className="text-red-600 text-sm font-medium flex items-center gap-1">
                        <XIcon className="h-4 w-4" />
                        Denied
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-gray-50">
          <button onClick={onClose} className="btn-secondary w-full sm:w-auto">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}