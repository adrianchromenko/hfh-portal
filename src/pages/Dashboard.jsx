import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore'
import { db } from '../firebase'
import { format, startOfToday, endOfToday, startOfWeek, endOfWeek, getDay, subDays } from 'date-fns'
import {
  CalendarDays,
  Clock,
  CheckCircle,
  TrendingUp,
  ArrowRight,
  Package,
  BarChart3,
  Users
} from 'lucide-react'
import StatusBadge from '../components/StatusBadge'

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAY_COLORS = ['bg-red-400', 'bg-blue-400', 'bg-green-400', 'bg-yellow-400', 'bg-purple-400', 'bg-pink-400', 'bg-orange-400']

export default function Dashboard() {
  const [stats, setStats] = useState({
    todayBookings: 0,
    weekBookings: 0,
    pendingBookings: 0,
    completedBookings: 0
  })
  const [recentBookings, setRecentBookings] = useState([])
  const [todaysPickups, setTodaysPickups] = useState([])
  const [dayOfWeekStats, setDayOfWeekStats] = useState([0, 0, 0, 0, 0, 0, 0])
  const [timeSlotStats, setTimeSlotStats] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const today = startOfToday()
    const todayEnd = endOfToday()
    const weekStart = startOfWeek(today)
    const weekEnd = endOfWeek(today)

    // Subscribe to all bookings for stats
    const bookingsRef = collection(db, 'bookings')
    const allBookingsQuery = query(bookingsRef, orderBy('createdAt', 'desc'))

    const unsubscribe = onSnapshot(allBookingsQuery, (snapshot) => {
      let todayCount = 0
      let weekCount = 0
      let pendingCount = 0
      let completedCount = 0
      const todaysList = []
      const recent = []
      const dayStats = [0, 0, 0, 0, 0, 0, 0]
      const timeStats = {}

      snapshot.forEach((doc) => {
        const data = { id: doc.id, ...doc.data() }
        const bookingDate = data.date ? new Date(data.date + 'T12:00:00') : null

        // Count stats
        if (bookingDate) {
          if (bookingDate >= today && bookingDate <= todayEnd) {
            todayCount++
            todaysList.push(data)
          }
          if (bookingDate >= weekStart && bookingDate <= weekEnd) {
            weekCount++
          }

          // Day of week analytics (for all bookings)
          const dayOfWeek = getDay(bookingDate)
          dayStats[dayOfWeek]++
        }

        // Time slot analytics
        if (data.time) {
          const hour = parseInt(data.time.split(':')[0])
          const timeLabel = formatHour(hour)
          timeStats[timeLabel] = (timeStats[timeLabel] || 0) + 1
        }

        if (data.status === 'pending') pendingCount++
        if (data.status === 'completed') completedCount++

        // Get recent 5
        if (recent.length < 5) {
          recent.push(data)
        }
      })

      setStats({
        todayBookings: todayCount,
        weekBookings: weekCount,
        pendingBookings: pendingCount,
        completedBookings: completedCount
      })

      setDayOfWeekStats(dayStats)
      setTimeSlotStats(timeStats)

      // Sort today's pickups by time
      todaysList.sort((a, b) => (a.time || '').localeCompare(b.time || ''))
      setTodaysPickups(todaysList)
      setRecentBookings(recent)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  // Find busiest day
  const maxDayCount = Math.max(...dayOfWeekStats)
  const busiestDayIndex = dayOfWeekStats.indexOf(maxDayCount)
  const busiestDay = DAYS_OF_WEEK[busiestDayIndex]

  // Find busiest time
  const timeEntries = Object.entries(timeSlotStats)
  const busiestTime = timeEntries.length > 0
    ? timeEntries.reduce((a, b) => a[1] > b[1] ? a : b)[0]
    : 'N/A'

  const statCards = [
    {
      label: "Today's Pickups",
      value: stats.todayBookings,
      icon: CalendarDays,
      color: 'bg-blue-500'
    },
    {
      label: 'This Week',
      value: stats.weekBookings,
      icon: TrendingUp,
      color: 'bg-purple-500'
    },
    {
      label: 'Pending',
      value: stats.pendingBookings,
      icon: Clock,
      color: 'bg-orange-500'
    },
    {
      label: 'Completed',
      value: stats.completedBookings,
      icon: CheckCircle,
      color: 'bg-green-500'
    }
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-habitat-green"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500">Welcome back! Here's what's happening today.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <div key={stat.label} className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stat.value}</p>
              </div>
              <div className={`${stat.color} p-3 rounded-lg`}>
                <stat.icon className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bookings by Day of Week */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Bookings by Day</h2>
              <p className="text-sm text-gray-500">Plan your manpower accordingly</p>
            </div>
            <div className="bg-habitat-green/10 p-2 rounded-lg">
              <BarChart3 className="h-5 w-5 text-habitat-green" />
            </div>
          </div>

          {/* Busiest Day Insight */}
          {maxDayCount > 0 && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-blue-800">
                  <strong>{busiestDay}</strong> is your busiest day with <strong>{maxDayCount}</strong> bookings
                </span>
              </div>
            </div>
          )}

          {/* Bar Chart */}
          <div className="space-y-3">
            {DAYS_OF_WEEK.map((day, index) => {
              const count = dayOfWeekStats[index]
              const percentage = maxDayCount > 0 ? (count / maxDayCount) * 100 : 0
              return (
                <div key={day} className="flex items-center gap-3">
                  <span className="w-12 text-sm text-gray-600 font-medium">{day.slice(0, 3)}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                    <div
                      className={`h-full ${DAY_COLORS[index]} rounded-full transition-all duration-500 flex items-center justify-end pr-2`}
                      style={{ width: `${Math.max(percentage, count > 0 ? 15 : 0)}%` }}
                    >
                      {count > 0 && (
                        <span className="text-xs font-semibold text-white">{count}</span>
                      )}
                    </div>
                  </div>
                  {count === 0 && <span className="text-xs text-gray-400">0</span>}
                </div>
              )
            })}
          </div>
        </div>

        {/* Bookings by Time Slot */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Peak Hours</h2>
              <p className="text-sm text-gray-500">Most requested pickup times</p>
            </div>
            <div className="bg-habitat-green/10 p-2 rounded-lg">
              <Clock className="h-5 w-5 text-habitat-green" />
            </div>
          </div>

          {/* Busiest Time Insight */}
          {timeEntries.length > 0 && (
            <div className="mb-4 p-3 bg-green-50 border border-green-100 rounded-lg">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-800">
                  Peak time: <strong>{busiestTime}</strong>
                </span>
              </div>
            </div>
          )}

          {/* Time Slots */}
          {timeEntries.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No time data yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(timeSlotStats)
                .sort((a, b) => {
                  // Sort by time
                  const hourA = parseInt(a[0])
                  const hourB = parseInt(b[0])
                  return hourA - hourB
                })
                .map(([time, count]) => {
                  const maxTimeCount = Math.max(...Object.values(timeSlotStats))
                  const percentage = maxTimeCount > 0 ? (count / maxTimeCount) * 100 : 0
                  return (
                    <div key={time} className="flex items-center gap-3">
                      <span className="w-20 text-sm text-gray-600 font-medium">{time}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                        <div
                          className="h-full bg-habitat-green rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                          style={{ width: `${Math.max(percentage, 15)}%` }}
                        >
                          <span className="text-xs font-semibold text-white">{count}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Pickups */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Today's Pickups</h2>
            <Link
              to="/calendar"
              className="text-habitat-green hover:underline text-sm flex items-center gap-1"
            >
              View Calendar <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {todaysPickups.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <CalendarDays className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No pickups scheduled for today</p>
            </div>
          ) : (
            <div className="space-y-3">
              {todaysPickups.map((booking) => (
                <div
                  key={booking.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-habitat-green/10 rounded-lg flex items-center justify-center">
                      <Clock className="h-5 w-5 text-habitat-green" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{booking.name}</p>
                      <p className="text-sm text-gray-500">
                        {booking.time ? formatTime(booking.time) : '10 AM - 4 PM'} - {booking.city}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={booking.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Bookings */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Bookings</h2>
            <Link
              to="/bookings"
              className="text-habitat-green hover:underline text-sm flex items-center gap-1"
            >
              View All <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {recentBookings.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No bookings yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentBookings.map((booking) => (
                <div
                  key={booking.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900">{booking.name}</p>
                    <p className="text-sm text-gray-500">
                      {booking.date
                        ? format(new Date(booking.date + 'T12:00:00'), 'MMM d, yyyy')
                        : 'No date'}{' '}
                      - {booking.items?.substring(0, 30)}
                      {booking.items?.length > 30 ? '...' : ''}
                    </p>
                  </div>
                  <StatusBadge status={booking.status} />
                </div>
              ))}
            </div>
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

function formatHour(hour) {
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const h = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
  return `${h}:00 ${ampm}`
}
