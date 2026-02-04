import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore'
import { db } from '../firebase'
import { format, startOfToday, endOfToday, startOfWeek, endOfWeek, isToday } from 'date-fns'
import {
  CalendarDays,
  Clock,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  ArrowRight,
  Package
} from 'lucide-react'
import StatusBadge from '../components/StatusBadge'

export default function Dashboard() {
  const [stats, setStats] = useState({
    todayBookings: 0,
    weekBookings: 0,
    pendingBookings: 0,
    completedBookings: 0
  })
  const [recentBookings, setRecentBookings] = useState([])
  const [todaysPickups, setTodaysPickups] = useState([])
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

      snapshot.forEach((doc) => {
        const data = { id: doc.id, ...doc.data() }
        const bookingDate = data.date ? new Date(data.date) : null

        // Count stats
        if (bookingDate) {
          if (bookingDate >= today && bookingDate <= todayEnd) {
            todayCount++
            todaysList.push(data)
          }
          if (bookingDate >= weekStart && bookingDate <= weekEnd) {
            weekCount++
          }
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

      // Sort today's pickups by time
      todaysList.sort((a, b) => (a.time || '').localeCompare(b.time || ''))
      setTodaysPickups(todaysList)
      setRecentBookings(recent)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

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
                        {booking.time ? formatTime(booking.time) : 'No time set'} - {booking.city}
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
                        ? format(new Date(booking.date), 'MMM d, yyyy')
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
