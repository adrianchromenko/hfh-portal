import { useEffect, useRef, useState } from 'react'
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  deleteDoc
} from 'firebase/firestore'
import { db } from '../firebase'
import {
  Plus,
  Search,
  MapPin,
  Phone,
  Mail,
  Repeat,
  Edit2,
  Trash2,
  RefreshCw,
  Users as UsersIcon
} from 'lucide-react'
import CustomerModal from '../components/CustomerModal'
import {
  subscribeBookingSettings,
  DEFAULT_BOOKING_SETTINGS
} from '../utils/bookingSettings'
import {
  scheduleSummary,
  computeNextPickupDate,
  extendBookingsForCustomer,
  deleteFutureBookingsForCustomer,
  topUpAllActiveCustomers
} from '../utils/customerBookings'

export default function Customers() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [bookingSettings, setBookingSettings] = useState(DEFAULT_BOOKING_SETTINGS)
  const [extendingId, setExtendingId] = useState(null)
  const topUpRan = useRef(false)

  useEffect(() => {
    const unsub = subscribeBookingSettings(setBookingSettings)
    return () => unsub()
  }, [])

  useEffect(() => {
    const q = query(collection(db, 'customers'), orderBy('name', 'asc'))
    const unsub = onSnapshot(q, (snap) => {
      const rows = []
      snap.forEach((d) => rows.push({ id: d.id, ...d.data() }))
      setCustomers(rows)
      setLoading(false)
    })
    return () => unsub()
  }, [])

  // Auto-extend bookings for customers that existed at page-load time.
  // We snapshot the guard the first time loading completes, regardless of
  // whether the collection was empty, so customers added AFTER mount never
  // get auto-topped up (which would race with their initial regenerate and
  // duplicate bookings).
  useEffect(() => {
    if (loading || topUpRan.current) return
    topUpRan.current = true
    if (customers.length === 0) return
    topUpAllActiveCustomers(customers, bookingSettings).catch((err) => {
      console.error('Auto top-up failed:', err)
    })
  }, [loading, customers, bookingSettings])

  const filtered = customers.filter((c) => {
    if (!searchTerm) return true
    const t = searchTerm.toLowerCase()
    return (
      c.name?.toLowerCase().includes(t) ||
      c.phone?.includes(t) ||
      c.email?.toLowerCase().includes(t) ||
      c.address?.toLowerCase().includes(t)
    )
  })

  const handleAdd = () => {
    setEditingCustomer(null)
    setShowModal(true)
  }

  const handleEdit = (customer) => {
    setEditingCustomer(customer)
    setShowModal(true)
  }

  const handleDelete = async (customer) => {
    const ok = window.confirm(
      `Delete customer "${customer.name}"?\n\nThis will also delete all of their future recurring bookings. Past bookings will be kept for history.`
    )
    if (!ok) return
    try {
      await deleteFutureBookingsForCustomer(customer.id)
      await deleteDoc(doc(db, 'customers', customer.id))
    } catch (err) {
      console.error('Failed to delete customer:', err)
      alert('Failed to delete customer. Please try again.')
    }
  }

  const handleExtend = async (customer) => {
    setExtendingId(customer.id)
    try {
      const added = await extendBookingsForCustomer(customer, customer.id, bookingSettings)
      if (added === 0) {
        alert('Already extended for the next 52 weeks.')
      } else {
        alert(`Added ${added} future booking${added === 1 ? '' : 's'}.`)
      }
    } catch (err) {
      console.error('Failed to extend:', err)
      alert('Failed to extend bookings.')
    } finally {
      setExtendingId(null)
    }
  }

  const formatNext = (customer) => {
    const next = computeNextPickupDate(customer.schedule, bookingSettings)
    if (!next) return '—'
    const d = new Date(next + 'T12:00:00')
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-gray-500">
            Manage recurring pickup and delivery customers
          </p>
        </div>
        <button onClick={handleAdd} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Add Customer
        </button>
      </div>

      <div className="card">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search customers by name, phone, email, or address..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-10"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-habitat-green border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-3 bg-gray-100 rounded-full mb-3">
              <UsersIcon className="h-6 w-6 text-gray-400" />
            </div>
            <p className="text-gray-500 mb-1">
              {customers.length === 0 ? 'No customers yet' : 'No matching customers'}
            </p>
            <p className="text-sm text-gray-400">
              {customers.length === 0
                ? 'Add your first recurring customer to get started.'
                : 'Try a different search term.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((customer) => (
              <div
                key={customer.id}
                className="border border-gray-200 rounded-lg p-4 hover:border-habitat-green transition"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-gray-900">{customer.name}</h3>
                      {customer.schedule?.active ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                          <Repeat className="h-3 w-3" />
                          {scheduleSummary(customer.schedule)}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          Paused
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-600">
                      {customer.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-3.5 w-3.5 text-gray-400" />
                          <span>{customer.phone}</span>
                        </div>
                      )}
                      {customer.email && (
                        <div className="flex items-center gap-2 min-w-0">
                          <Mail className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                          <span className="truncate">{customer.email}</span>
                        </div>
                      )}
                      {customer.address && (
                        <div className="flex items-center gap-2 min-w-0 sm:col-span-2">
                          <MapPin className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                          <span className="truncate">
                            {customer.address}
                            {customer.apartment ? `, ${customer.apartment}` : ''}, {customer.city}
                          </span>
                        </div>
                      )}
                      {customer.schedule?.active && (
                        <div className="sm:col-span-2 mt-1 text-xs text-gray-500">
                          Next booking: <span className="font-medium text-gray-700">{formatNext(customer)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {customer.schedule?.active && (
                      <button
                        onClick={() => handleExtend(customer)}
                        disabled={extendingId === customer.id}
                        className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                        title="Extend bookings for another 52 weeks"
                      >
                        {extendingId === customer.id ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-500 border-t-transparent" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => handleEdit(customer)}
                      className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                      title="Edit customer"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(customer)}
                      className="p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 rounded-lg"
                      title="Delete customer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <CustomerModal
          customer={editingCustomer}
          onClose={() => {
            setShowModal(false)
            setEditingCustomer(null)
          }}
        />
      )}
    </div>
  )
}
