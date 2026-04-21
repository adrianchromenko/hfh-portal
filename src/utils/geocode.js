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

  // 1) Postal-code-first query — a full 6-char Canadian postal code pins
  // a small block, so "street + postalcode" often resolves more precisely
  // than adding city/state (which can pull Nominatim toward a street's
  // downtown segment on long roads like Queen St).
  let results = []
  if (zip) {
    const zipFirst = new URLSearchParams({
      street,
      postalcode: zip,
      country: 'Canada',
      format: 'json',
      addressdetails: '1',
      limit: '5',
      countrycodes: 'ca'
    })
    try {
      results = await queryNominatim(zipFirst)
    } catch {
      results = []
    }

    if (houseNumber && results.length) {
      const target = normalizeNumber(houseNumber)
      const exact = results.find(r => normalizeNumber(r.address?.house_number) === target)
      if (exact) {
        return { lat: parseFloat(exact.lat), lng: parseFloat(exact.lon) }
      }
    }
  }

  // 2) Structured query with full address components — fallback when the
  // postal code isn't known or didn't return an exact house-number match.
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

  try {
    const structuredResults = await queryNominatim(structured)
    if (structuredResults.length) results = structuredResults
  } catch {
    // keep whatever zip-first found, if anything
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

  // 3) Free-form fallback with addressdetails, still filtered by country.
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
