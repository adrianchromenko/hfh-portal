const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
const RATE_LIMIT_MS = 1100 // Nominatim requires max 1 request/sec

let lastRequestTime = 0

async function throttle() {
  const now = Date.now()
  const elapsed = now - lastRequestTime
  if (elapsed < RATE_LIMIT_MS) {
    await new Promise(r => setTimeout(r, RATE_LIMIT_MS - elapsed))
  }
  lastRequestTime = Date.now()
}

async function queryNominatim(params) {
  await throttle()
  const response = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
    headers: { 'User-Agent': 'HabitatAdminDashboard/1.0' }
  })
  return response.json()
}

// Pull the leading house number out of an address like "2196 Queen St E"
// or "2196-B Queen St E". Returns null if there's no leading number.
function extractHouseNumber(address) {
  const match = (address || '').trim().match(/^(\d+[A-Za-z]?)\b/)
  return match ? match[1] : null
}

function normalizeNumber(n) {
  return (n || '').toString().replace(/[^0-9]/g, '')
}

export async function geocodeAddress(address, city, state, zip) {
  const houseNumber = extractHouseNumber(address)
  const street = address?.trim() || ''

  // 1) Structured query — much more accurate than free-form for specific
  // house numbers on long streets (Nominatim otherwise tends to snap to
  // the street centroid, which lands downtown on long roads like Queen St).
  const structured = new URLSearchParams({
    street,
    city: city || '',
    state: state || '',
    country: 'Canada',
    format: 'json',
    addressdetails: '1',
    limit: '5',
    countrycodes: 'ca'
  })
  if (zip) structured.set('postalcode', zip)

  let results = []
  try {
    results = await queryNominatim(structured)
  } catch {
    results = []
  }

  // Prefer a result whose returned house_number matches ours.
  if (houseNumber && results.length) {
    const target = normalizeNumber(houseNumber)
    const exact = results.find(r => normalizeNumber(r.address?.house_number) === target)
    if (exact) {
      return { lat: parseFloat(exact.lat), lng: parseFloat(exact.lon) }
    }
  }

  // If structured returned something but no house-number match, still trust
  // the top hit *only if* the address has no leading number (e.g. a POI or
  // business name). Otherwise fall through to the free-form retry, which
  // sometimes finds a better match.
  if (!houseNumber && results.length) {
    return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) }
  }

  // 2) Free-form fallback with addressdetails, still filtered by country.
  const freeform = new URLSearchParams({
    q: `${address}, ${city}, ${state}${zip ? ' ' + zip : ''}, Canada`,
    format: 'json',
    addressdetails: '1',
    limit: '5',
    countrycodes: 'ca'
  })

  let fallback = []
  try {
    fallback = await queryNominatim(freeform)
  } catch {
    fallback = []
  }

  if (houseNumber && fallback.length) {
    const target = normalizeNumber(houseNumber)
    const exact = fallback.find(r => normalizeNumber(r.address?.house_number) === target)
    if (exact) {
      return { lat: parseFloat(exact.lat), lng: parseFloat(exact.lon) }
    }
  }

  if (fallback.length) {
    return { lat: parseFloat(fallback[0].lat), lng: parseFloat(fallback[0].lon) }
  }

  if (results.length) {
    return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) }
  }

  return null
}
