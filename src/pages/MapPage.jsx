import { useState, useEffect, useCallback, useRef } from 'react'
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { format } from 'date-fns'
import { Plus, Loader2, Printer, Download } from 'lucide-react'
import { geocodeAddress } from '../utils/geocode'
import { optimizeRoute, getDepot } from '../utils/routing'
import MapView from '../components/map/MapView'
import RoutePanel from '../components/map/RoutePanel'
import AddStopModal from '../components/map/AddStopModal'
import PrintRouteSheet from '../components/map/PrintRouteSheet'

export default function MapPage() {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [routeData, setRouteData] = useState(null)
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [geocodingStatus, setGeocodingStatus] = useState('')
  const [showPrintView, setShowPrintView] = useState(false)
  const mapRef = useRef(null)

  const depot = getDepot()

  // Fetch bookings for selected date
  useEffect(() => {
    setLoading(true)
    setRouteData(null)

    const bookingsRef = collection(db, 'bookings')
    const q = query(
      bookingsRef,
      where('date', '==', selectedDate),
      orderBy('createdAt', 'asc')
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const stops = []
      snapshot.forEach((docSnap) => {
        const data = { id: docSnap.id, ...docSnap.data() }
        if (!data.type) data.type = 'pickup'
        if (data.status !== 'cancelled') {
          stops.push(data)
        }
      })
      setBookings(stops)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [selectedDate])

  // Geocode bookings that are missing coordinates
  useEffect(() => {
    const ungeocodedBookings = bookings.filter(b => b.lat == null || b.lng == null)
    if (ungeocodedBookings.length === 0) {
      setGeocodingStatus('')
      return
    }

    let cancelled = false

    async function geocodeAll() {
      for (let i = 0; i < ungeocodedBookings.length; i++) {
        if (cancelled) return
        const booking = ungeocodedBookings[i]
        setGeocodingStatus(`Geocoding addresses... (${i + 1}/${ungeocodedBookings.length})`)

        try {
          const coords = await geocodeAddress(booking.address, booking.city, booking.state, booking.zip)
          if (cancelled) return
          if (coords) {
            await updateDoc(doc(db, 'bookings', booking.id), {
              lat: coords.lat,
              lng: coords.lng
            })
          } else {
            // Mark as geocoded but failed (so we don't retry)
            await updateDoc(doc(db, 'bookings', booking.id), {
              lat: false,
              lng: false
            })
          }
        } catch (err) {
          console.error('Geocoding error for', booking.name, err)
        }
      }
      if (!cancelled) setGeocodingStatus('')
    }

    geocodeAll()
    return () => { cancelled = true }
  }, [bookings])

  const handleOptimize = useCallback(async () => {
    const geocodedStops = bookings.filter(s => s.lat && s.lng && s.lat !== false)
    if (geocodedStops.length < 2) return

    setIsOptimizing(true)
    try {
      const result = await optimizeRoute(geocodedStops)
      setRouteData(result)
    } catch (err) {
      console.error('Route optimization error:', err)
    } finally {
      setIsOptimizing(false)
    }
  }, [bookings])

  const handleStopClick = useCallback((stop) => {
    // The MapView popup handles this via Leaflet
  }, [])

  const handlePrint = () => {
    setShowPrintView(true)
    setTimeout(() => {
      window.print()
      setShowPrintView(false)
    }, 500)
  }

  const handleDownloadMap = async () => {
    // This would require a library like html2canvas or leaflet-image
    // For now, we'll use the print function
    alert('Use the Print button to save as PDF. In the print dialog, select "Save as PDF" as the destination.')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-habitat-green"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Route Map</h1>
          <p className="text-gray-500">
            {bookings.length} stop{bookings.length !== 1 ? 's' : ''} for{' '}
            {format(new Date(selectedDate + 'T12:00:00'), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="input-field w-auto"
          />
          {routeData && (
            <button
              onClick={handlePrint}
              className="btn-secondary flex items-center gap-2 whitespace-nowrap"
              title="Print route sheet for drivers"
            >
              <Printer className="h-4 w-4" />
              Print Route
            </button>
          )}
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary flex items-center gap-2 whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            Add Stop
          </button>
        </div>
      </div>

      {/* Geocoding status */}
      {geocodingStatus && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 text-blue-700 rounded-lg text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          {geocodingStatus}
        </div>
      )}

      {/* Map + Panel layout */}
      <div className="flex flex-col lg:flex-row gap-4" style={{ height: 'calc(100vh - 14rem)' }}>
        {/* Map */}
        <div className="flex-1 lg:flex-[2] card p-0 overflow-hidden" ref={mapRef}>
          <MapView
            stops={routeData ? routeData.orderedStops : bookings}
            depot={depot}
            routeGeometry={routeData?.geometry}
            onStopClick={handleStopClick}
          />
        </div>

        {/* Route panel */}
        <div className="lg:flex-1 card p-0 overflow-hidden" style={{ maxHeight: 'calc(100vh - 14rem)' }}>
          <RoutePanel
            stops={bookings}
            routeData={routeData}
            isOptimizing={isOptimizing}
            onOptimize={handleOptimize}
            onStopClick={handleStopClick}
            onPrint={handlePrint}
          />
        </div>
      </div>

      {/* Add stop modal */}
      {showAddModal && (
        <AddStopModal
          selectedDate={selectedDate}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {/* Print View */}
      {showPrintView && (
        <PrintRouteSheet
          routeData={routeData}
          stops={bookings}
          date={selectedDate}
          depot={depot}
        />
      )}
    </div>
  )
}
