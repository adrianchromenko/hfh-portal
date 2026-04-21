import { useState, useEffect, useRef } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { collection, query, orderBy, limit, onSnapshot, where, Timestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import {
  LayoutDashboard,
  CalendarDays,
  ClipboardList,
  Settings,
  LogOut,
  Menu,
  X,
  MapPin,
  Users,
  Contact,
  Bell
} from 'lucide-react'
import logo from '../assets/images/sault-black.webp'

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/bookings', icon: ClipboardList, label: 'Bookings' },
  { path: '/calendar', icon: CalendarDays, label: 'Calendar' },
  { path: '/map', icon: MapPin, label: 'Map' },
  { path: '/customers', icon: Contact, label: 'Customers' },
  { path: '/users', icon: Users, label: 'Users' },
  { path: '/settings', icon: Settings, label: 'Settings' },
]

const LAST_SEEN_KEY = 'habitat.lastSeenBookingTs'

function playChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.12)
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35)
    osc.start()
    osc.stop(ctx.currentTime + 0.36)
  } catch {
    // Audio is a nicety; swallow errors so a missing/blocked context
    // never disrupts the visual notification.
  }
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [unseenCount, setUnseenCount] = useState(0)
  const [toasts, setToasts] = useState([]) // [{id, name, city}]
  const { currentUser, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const lastSeenRef = useRef(
    parseInt(localStorage.getItem(LAST_SEEN_KEY) || '0', 10) || 0
  )

  // Listen for bookings created after the last-seen timestamp. The query
  // only fires when truly new docs arrive; existing bookings older than
  // lastSeen are excluded entirely so we don't light up on page load.
  useEffect(() => {
    const since = lastSeenRef.current || Date.now()
    const q = query(
      collection(db, 'bookings'),
      where('createdAt', '>', Timestamp.fromMillis(since)),
      orderBy('createdAt', 'desc'),
      limit(25)
    )

    const unsub = onSnapshot(q, (snap) => {
      const added = []
      snap.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data()
          added.push({
            id: change.doc.id,
            name: data.name || 'New booking',
            city: data.city || ''
          })
        }
      })
      if (!added.length) return

      setUnseenCount((c) => c + added.length)
      setToasts((prev) => [...prev, ...added])
      playChime()

      // Auto-dismiss each toast after 10s.
      added.forEach((t) => {
        setTimeout(() => {
          setToasts((prev) => prev.filter((x) => x.id !== t.id))
        }, 10000)
      })
    })

    return unsub
  }, [])

  // Clear the unseen badge whenever the admin actually looks at the
  // Bookings page, and bump the last-seen timestamp so reloads don't
  // re-fire notifications for bookings we've already acknowledged.
  useEffect(() => {
    if (location.pathname.startsWith('/bookings')) {
      setUnseenCount(0)
      setToasts([])
      const now = Date.now()
      lastSeenRef.current = now
      localStorage.setItem(LAST_SEEN_KEY, String(now))
    }
  }, [location.pathname])

  async function handleLogout() {
    try {
      await logout()
      navigate('/login')
    } catch (error) {
      console.error('Failed to log out:', error)
    }
  }

  function dismissToast(id) {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <img src={logo} alt="Sault Logo" className="h-14 w-auto" />
          <button
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-habitat-green text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`
              }
              onClick={() => setSidebarOpen(false)}
            >
              <item.icon className="h-5 w-5" />
              <span className="font-medium flex-1">{item.label}</span>
              {item.path === '/bookings' && unseenCount > 0 && (
                <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-semibold rounded-full bg-red-500 text-white">
                  {unseenCount > 99 ? '99+' : unseenCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-habitat-green flex items-center justify-center text-white font-medium">
              {currentUser?.email?.[0]?.toUpperCase() || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {currentUser?.email || 'Admin'}
              </p>
              <p className="text-xs text-gray-500">Administrator</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <LogOut className="h-5 w-5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white border-b px-4 py-3 flex items-center justify-between">
          <button
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>
          <button
            onClick={() => navigate('/bookings')}
            className="relative p-2 rounded-lg hover:bg-gray-100"
            title={unseenCount > 0 ? `${unseenCount} new booking${unseenCount === 1 ? '' : 's'}` : 'No new bookings'}
          >
            <Bell className="h-5 w-5 text-gray-600" />
            {unseenCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-semibold rounded-full bg-red-500 text-white">
                {unseenCount > 99 ? '99+' : unseenCount}
              </span>
            )}
          </button>
        </header>

        {/* Page content */}
        <main className="p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      {/* Toasts */}
      <div className="fixed top-4 right-4 z-[60] flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]">
        {toasts.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              dismissToast(t.id)
              navigate('/bookings')
            }}
            className="text-left bg-white border border-gray-200 shadow-lg rounded-lg p-3 pr-8 hover:bg-gray-50 transition relative"
          >
            <div className="flex items-start gap-2">
              <span className="flex-shrink-0 mt-0.5 inline-flex items-center justify-center h-6 w-6 rounded-full bg-habitat-green text-white">
                <Bell className="h-3.5 w-3.5" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">New booking</p>
                <p className="text-sm text-gray-600 truncate">
                  {t.name}{t.city ? ` — ${t.city}` : ''}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">Click to view</p>
              </div>
            </div>
            <span
              role="button"
              aria-label="Dismiss"
              onClick={(e) => { e.stopPropagation(); dismissToast(t.id) }}
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
