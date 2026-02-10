import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix Leaflet default marker icons in Vite
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
})

function createNumberedIcon(number, type) {
  const color = type === 'delivery' ? '#F7941D' : '#0099CC'
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="background:${color};color:white;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:13px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35)">${number}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  })
}

function createDepotIcon() {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="background:#059669;color:white;border-radius:50%;width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:16px;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35)">H</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  })
}

// Auto-fit map bounds to show all markers
function FitBounds({ stops, depot }) {
  const map = useMap()

  useEffect(() => {
    const points = [depot, ...stops.filter(s => s.lat && s.lng)].map(s => [s.lat, s.lng])
    if (points.length > 0) {
      map.fitBounds(points, { padding: [40, 40], maxZoom: 14 })
    }
  }, [stops, depot, map])

  return null
}

export default function MapView({ stops, depot, routeGeometry, onStopClick }) {
  // Default center on Sault Ste. Marie
  const center = [depot.lat, depot.lng]

  // Convert OSRM GeoJSON geometry to Leaflet polyline coordinates
  const routePositions = routeGeometry
    ? routeGeometry.coordinates.map(([lng, lat]) => [lat, lng])
    : null

  return (
    <MapContainer
      center={center}
      zoom={12}
      className="h-full w-full rounded-lg"
      style={{ minHeight: '400px' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds stops={stops} depot={depot} />

      {/* Depot marker */}
      <Marker position={[depot.lat, depot.lng]} icon={createDepotIcon()}>
        <Popup>
          <strong>Habitat ReStore</strong><br />
          44 Great Northern Rd<br />
          Sault Ste. Marie, ON
        </Popup>
      </Marker>

      {/* Stop markers */}
      {stops.map((stop, index) => {
        if (!stop.lat || !stop.lng) return null
        const type = stop.type || 'pickup'
        return (
          <Marker
            key={stop.id}
            position={[stop.lat, stop.lng]}
            icon={createNumberedIcon(index + 1, type)}
            eventHandlers={{
              click: () => onStopClick && onStopClick(stop)
            }}
          >
            <Popup>
              <div className="text-sm">
                <strong>{stop.name}</strong>
                <span className="ml-2 text-xs px-1.5 py-0.5 rounded" style={{
                  background: type === 'delivery' ? '#FEF3C7' : '#E0F2FE',
                  color: type === 'delivery' ? '#92400E' : '#0369A1'
                }}>
                  {type === 'delivery' ? 'Delivery' : 'Pickup'}
                </span>
                <br />
                {stop.address}<br />
                {stop.city}, {stop.state} {stop.zip}<br />
                {stop.items && <><br /><em>Items:</em> {stop.items}</>}
              </div>
            </Popup>
          </Marker>
        )
      })}

      {/* Route polyline */}
      {routePositions && (
        <Polyline
          positions={routePositions}
          color="#0099CC"
          weight={4}
          opacity={0.7}
        />
      )}
    </MapContainer>
  )
}
