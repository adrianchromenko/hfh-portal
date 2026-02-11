import { useState, useEffect } from 'react'
import { collection, query, where, orderBy, getDocs, Timestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { format, subDays } from 'date-fns'
import { Calendar, Package, Truck, MapPin, Clock, Filter, Map } from 'lucide-react'
import HistoricalMapView from './HistoricalMapView'

export default function HistoricalView({ onClose }) {
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState({ total: 0, pickups: 0, deliveries: 0 })
  const [filterType, setFilterType] = useState('all')
  const [showMapView, setShowMapView] = useState(false)

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
      let pickupCount = 0
      let deliveryCount = 0

      snapshot.forEach((doc) => {
        const booking = { id: doc.id, ...doc.data() }
        if (booking.status !== 'cancelled') {
          data.push(booking)
          if (booking.type === 'delivery') {
            deliveryCount++
          } else {
            pickupCount++
          }
        }
      })

      setBookings(data)
      setStats({
        total: data.length,
        pickups: pickupCount,
        deliveries: deliveryCount
      })
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

  const getTypeColor = (type) => {
    return type === 'delivery' 
      ? 'bg-orange-100 text-orange-800 border-orange-200' 
      : 'bg-blue-100 text-blue-800 border-blue-200'
  }

  const getTypeIcon = (type) => {
    return type === 'delivery' ? Truck : Package
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b bg-gradient-to-r from-habitat-green to-green-700 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Historical Pickups & Deliveries</h2>
              <p className="text-green-100 mt-1">View and filter past routes and stops</p>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="p-4 border-b bg-gray-50">
          <form onSubmit={handleSearch} className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-gray-500" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input-field w-auto"
                max={endDate}
              />
              <span className="text-gray-500">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input-field w-auto"
                min={startDate}
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-gray-500" />
              <select 
                value={filterType} 
                onChange={(e) => setFilterType(e.target.value)}
                className="input-field w-auto"
              >
                <option value="all">All Types</option>
                <option value="pickup">Pickups Only</option>
                <option value="delivery">Deliveries Only</option>
              </select>
            </div>

            <button type="submit" className="btn-primary">
              Search
            </button>
            
            <button 
              type="button"
              onClick={() => setShowMapView(true)}
              className="btn-secondary flex items-center gap-2"
              disabled={filteredBookings.length === 0}
            >
              <Map className="h-4 w-4" />
              View on Map
            </button>
          </form>

          {/* Stats */}
          {!loading && (
            <div className="mt-4 flex gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                <span className="text-sm text-gray-600">Total: {stats.total}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                <span className="text-sm text-gray-600">Pickups: {stats.pickups}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-orange-600 rounded-full"></div>
                <span className="text-sm text-gray-600">Deliveries: {stats.deliveries}</span>
              </div>
            </div>
          )}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-habitat-green"></div>
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="text-center py-12">
              <MapPin className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No stops found for the selected date range</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredBookings.map((booking) => {
                const Icon = getTypeIcon(booking.type || 'pickup')
                return (
                  <div 
                    key={booking.id} 
                    className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Icon className="h-5 w-5 text-gray-600" />
                          <h3 className="font-semibold text-gray-900">{booking.name}</h3>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getTypeColor(booking.type || 'pickup')}`}>
                            {booking.type === 'delivery' ? 'Delivery' : 'Pickup'}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            {format(new Date(booking.date + 'T12:00:00'), 'MMM d, yyyy')}
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            {booking.address}, {booking.city}
                          </div>
                          {booking.bookingTime && (
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4" />
                              {booking.bookingTime}
                            </div>
                          )}
                          {booking.items && (
                            <div className="md:col-span-2">
                              <strong>Items:</strong> {booking.items}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="ml-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          booking.status === 'completed' 
                            ? 'bg-green-100 text-green-800' 
                            : booking.status === 'cancelled'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {booking.status || 'confirmed'}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 flex justify-between items-center">
          <p className="text-sm text-gray-600">
            Showing {filteredBookings.length} {filterType === 'all' ? 'stops' : filterType + 's'} from {format(new Date(startDate + 'T12:00:00'), 'MMM d, yyyy')} to {format(new Date(endDate + 'T12:00:00'), 'MMM d, yyyy')}
          </p>
          <button onClick={onClose} className="btn-secondary">
            Close
          </button>
        </div>
      </div>

      {/* Historical Map View Modal */}
      {showMapView && (
        <HistoricalMapView
          onClose={() => setShowMapView(false)}
        />
      )}
    </div>
  )
}