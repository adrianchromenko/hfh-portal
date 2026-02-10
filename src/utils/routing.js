const OSRM_URL = 'https://router.project-osrm.org/trip/v1/driving'

// Habitat for Humanity ReStore - 44 Great Northern Rd, Sault Ste. Marie, ON
const DEPOT = { lat: 46.5240, lng: -84.3170 }

export function getDepot() {
  return DEPOT
}

export async function optimizeRoute(stops) {
  if (stops.length === 0) return null
  if (stops.length === 1) {
    return {
      orderedStops: stops,
      geometry: null,
      totalDistance: 0,
      totalDuration: 0
    }
  }

  const coords = [DEPOT, ...stops]
    .map(s => `${s.lng},${s.lat}`)
    .join(';')

  try {
    const response = await fetch(
      `${OSRM_URL}/${coords}?overview=full&geometries=geojson&roundtrip=false&source=first`
    )
    const data = await response.json()

    if (data.code !== 'Ok') throw new Error(`OSRM error: ${data.code}`)

    const trip = data.trips[0]
    // waypoints[0] is the depot, the rest map to stops
    const waypointOrder = data.waypoints.map(wp => wp.waypoint_index)

    // Build ordered stops excluding depot (index 0)
    const orderedStops = []
    for (let i = 0; i < waypointOrder.length; i++) {
      const wpIdx = waypointOrder[i]
      if (wpIdx === 0) continue // skip depot
      orderedStops.push(stops[wpIdx - 1])
    }

    return {
      orderedStops,
      geometry: trip.geometry,
      totalDistance: trip.distance,
      totalDuration: trip.duration
    }
  } catch (error) {
    console.warn('OSRM unavailable, falling back to nearest-neighbor:', error)
    return nearestNeighborRoute(stops)
  }
}

function haversineDistance(a, b) {
  const R = 6371000 // Earth radius in meters
  const toRad = deg => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const h = sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng
  return 2 * R * Math.asin(Math.sqrt(h))
}

function nearestNeighborRoute(stops) {
  const ordered = []
  const remaining = [...stops]
  let current = DEPOT
  let totalDistance = 0

  while (remaining.length > 0) {
    let nearestIdx = 0
    let nearestDist = Infinity
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineDistance(current, remaining[i])
      if (d < nearestDist) {
        nearestDist = d
        nearestIdx = i
      }
    }
    totalDistance += nearestDist
    current = remaining[nearestIdx]
    ordered.push(remaining.splice(nearestIdx, 1)[0])
  }

  return {
    orderedStops: ordered,
    geometry: null, // No road-following geometry for fallback
    totalDistance,
    totalDuration: totalDistance / 13.4 // Rough estimate: ~30mph average in town
  }
}
