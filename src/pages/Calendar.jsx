import { useState, useEffect } from 'react'
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore'
import { db } from '../firebase'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday
} from 'date-fns'
import { ChevronLeft, ChevronRight, Clock, MapPin } from 'lucide-react'
import StatusBadge from '../components/StatusBadge'

export default function Calendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [bookings, setBookings] = useState([])
  const [selectedDate, setSelectedDate] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const bookingsRef = collection(db, 'bookings')
    const q = query(bookingsRef, orderBy('date', 'asc'))

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

  function getBookingsForDate(date) {
    const dateStr = format(date, 'yyyy-MM-dd')
    return bookings.filter((b) => b.date === dateStr)
  }

  function renderHeader() {
    return (
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">
          {format(currentMonth, 'MMMM yyyy')}
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => setCurrentMonth(new Date())}
            className="px-3 py-1 text-sm text-habitat-green hover:bg-habitat-green/10 rounded-lg"
          >
            Today
          </button>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    )
  }

  function renderDays() {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    return (
      <div className="grid grid-cols-7 mb-2">
        {days.map((day) => (
          <div
            key={day}
            className="p-2 text-center text-sm font-medium text-gray-500"
          >
            {day}
          </div>
        ))}
      </div>
    )
  }

  function renderCells() {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(monthStart)
    const startDate = startOfWeek(monthStart)
    const endDate = endOfWeek(monthEnd)

    const rows = []
    let days = []
    let day = startDate

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        const cloneDay = day
        const dayBookings = getBookingsForDate(day)
        const isCurrentMonth = isSameMonth(day, monthStart)
        const isSelected = selectedDate && isSameDay(day, selectedDate)
        const isTodayDate = isToday(day)

        days.push(
          <div
            key={day.toString()}
            className={`min-h-[100px] p-2 border border-gray-100 cursor-pointer transition-colors ${
              !isCurrentMonth ? 'bg-gray-50' : 'bg-white hover:bg-gray-50'
            } ${isSelected ? 'ring-2 ring-habitat-green ring-inset' : ''}`}
            onClick={() => setSelectedDate(cloneDay)}
          >
            <span
              className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm ${
                isTodayDate
                  ? 'bg-habitat-green text-white font-semibold'
                  : isCurrentMonth
                  ? 'text-gray-900'
                  : 'text-gray-400'
              }`}
            >
              {format(day, 'd')}
            </span>
            <div className="mt-1 space-y-1">
              {dayBookings.slice(0, 3).map((booking) => (
                <div
                  key={booking.id}
                  className={`text-xs px-1.5 py-0.5 rounded truncate ${
                    booking.status === 'completed'
                      ? 'bg-green-100 text-green-800'
                      : booking.status === 'confirmed'
                      ? 'bg-blue-100 text-blue-800'
                      : booking.status === 'cancelled'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}
                >
                  {booking.time ? formatTime(booking.time) : ''} {booking.name}
                </div>
              ))}
              {dayBookings.length > 3 && (
                <div className="text-xs text-gray-500 px-1.5">
                  +{dayBookings.length - 3} more
                </div>
              )}
            </div>
          </div>
        )
        day = addDays(day, 1)
      }
      rows.push(
        <div key={day.toString()} className="grid grid-cols-7">
          {days}
        </div>
      )
      days = []
    }
    return <div>{rows}</div>
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-habitat-green"></div>
      </div>
    )
  }

  const selectedDateBookings = selectedDate
    ? getBookingsForDate(selectedDate).sort((a, b) =>
        (a.time || '').localeCompare(b.time || '')
      )
    : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
        <p className="text-gray-500">View and manage scheduled pickups</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-2 card">
          {renderHeader()}
          {renderDays()}
          {renderCells()}
        </div>

        {/* Selected Date Details */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">
            {selectedDate
              ? format(selectedDate, 'EEEE, MMMM d, yyyy')
              : 'Select a date'}
          </h3>

          {selectedDate ? (
            selectedDateBookings.length > 0 ? (
              <div className="space-y-3">
                {selectedDateBookings.map((booking) => (
                  <div
                    key={booking.id}
                    className="p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900">
                        {booking.name}
                      </span>
                      <StatusBadge status={booking.status} />
                    </div>
                    <div className="space-y-1 text-sm text-gray-500">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        {booking.time ? formatTime(booking.time) : 'No time set'}
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        {booking.city}, {booking.state}
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                      {booking.items}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                No pickups scheduled for this date
              </p>
            )
          ) : (
            <p className="text-gray-500 text-center py-8">
              Click on a date to see scheduled pickups
            </p>
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
