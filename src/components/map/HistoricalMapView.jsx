import { useState, useEffect } from 'react'
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore'
import { db } from '../../firebase'
import { format, subDays } from 'date-fns'
import { X, Calendar, Filter, Package, Truck } from 'lucide-react'
import MapView from './MapView'
import { getDepot } from '../../utils/routing'

export default function HistoricalMapView({ onClose }) {
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(false)
  const [filterType, setFilterType] = useState('all')
  const depot = getDepot()

  const fetchHistoricalData = async () => {
    setLoading(true)
    try {
      const bookingsRef = collection(db, 'bookings')
      const q = query(
        bookingsRef,
        where('date', '>=', startDate),
        where('date', '<=', endDate),
        orderBy('date', 'desc'),
        orderBy('createdAt', 'desc')
      )

      const snapshot = await getDocs(q)
      const data = []

      snapshot.forEach((doc) => {
        const booking = { id: doc.id, ...doc.data() }
        if (booking.status !== 'cancelled' && booking.lat && booking.lng) {
          data.push(booking)
        }
      })

      setBookings(data)
    } catch (error) {
      console.error('Error fetching historical data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHistoricalData()
  }, [])

  const handleSearch = (e) => {
    e.preventDefault()
    fetchHistoricalData()
  }

  const filteredBookings = filterType === 'all' 
    ? bookings 
    : bookings.filter(b => b.type === filterType)

  const stats = {
    total: filteredBookings.length,
    pickups: filteredBookings.filter(b => b.type !== 'delivery').length,
    deliveries: filteredBookings.filter(b => b.type === 'delivery').length
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-7xl w-full h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b bg-gradient-to-r from-habitat-green to-green-700 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Historical Map View</h2>
              <p className="text-green-100 text-sm">Viewing {stats.total} stops from {format(new Date(startDate + 'T12:00:00'), 'MMM d')} to {format(new Date(endDate + 'T12:00:00'), 'MMM d, yyyy')}</p>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="p-3 border-b bg-gray-50">
          <form onSubmit={handleSearch} className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input-field w-auto text-sm py-1"
                max={endDate}
              />
              <span className="text-gray-500 text-sm">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input-field w-auto text-sm py-1"
                min={startDate}
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <select 
                value={filterType} 
                onChange={(e) => setFilterType(e.target.value)}
                className="input-field w-auto text-sm py-1"
              >
                <option value="all">All Types</option>
                <option value="pickup">Pickups Only</option>
                <option value="delivery">Deliveries Only</option>
              </select>
            </div>

            <button type="submit" className="btn-primary text-sm py-1 px-3">
              Update Map
            </button>

            {/* Stats */}
            <div className="ml-auto flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <Package className="h-4 w-4 text-blue-600" />
                <span className="text-gray-600">{stats.pickups} pickups</span>
              </div>
              <div className="flex items-center gap-1">
                <Truck className="h-4 w-4 text-orange-600" />
                <span className="text-gray-600">{stats.deliveries} deliveries</span>
              </div>
            </div>
          </form>
        </div>

        {/* Map */}
        <div className="flex-1 relative">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-habitat-green"></div>
            </div>
          ) : (
            <MapView
              stops={filteredBookings}
              depot={depot}
              routeGeometry={null}
              onStopClick={(stop) => {
                // Could open a detail modal here
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}