const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
const RATE_LIMIT_MS = 1100 // Nominatim requires max 1 request/sec

// Bounding box around Sault Ste. Marie + a buffer for nearby rural pickups
// (Goulais River, Heyden, Echo Bay, etc). Format: lon_left,lat_top,lon_right,lat_bottom.
// Nominatim's countrycodes=ca alone isn't enough — common street names like
// "Queen St" still resolve to Toronto. bounded=1 + this viewbox keeps results
// in our service area or returns nothing.
const SSM_VIEWBOX = '-84.70,46.75,-84.00,46.35'

let lastRequestTime = 0

async function throttle() {
  const now = Date.now()
  const elapsed = now - lastRequestTime
  if (elapsed < RATE_LIMIT_MS) {
    await new Promise(r => setTimeout(r, RATE_LIMIT_MS - elapsed))
  }
  lastRequestTime = Date.now()
}

function applySsmBounds(params) {
  params.set('viewbox', SSM_VIEWBOX)
  params.set('bounded', '1')
  return params
}

// Sanity check for stored coordinates. Older bookings were geocoded without
// the SSM viewbox and sometimes landed in the wrong city (Queen St → Toronto).
// Returns true if the point is plausibly in our service area.
export function isWithinSsmBounds(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false
  if (Number.isNaN(lat) || Number.isNaN(lng)) return false
  return lat >= 46.35 && lat <= 46.75 && lng >= -84.70 && lng <= -84.00
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

// Words that can follow "St" when it means "Street" rather than "Saint".
// "Queen St E" must stay as-is; "St Georges Ave" should become "Saint ...".
const NOT_A_SAINT_NAME = new Set([
  'e', 'w', 'n', 's', 'east', 'west', 'north', 'south',
  'ne', 'nw', 'se', 'sw', 'unit', 'apt', 'suite', 'ste'
])

// OpenStreetMap spells saints' streets in full with a possessive, e.g.
// "Saint George's Avenue East", and Nominatim won't match "St. Georges Ave"
// against it. This returns the spellings worth trying, most likely first:
//   "100 St. Georges Ave" → ["100 St. Georges Ave",
//                            "100 St. George's Ave",
//                            "100 Saint George's Ave",
//                            "100 Saint Georges Ave"]
// Addresses without a St/Saint prefix get a single-element list, so the
// common case costs no extra requests.
export function streetSpellingVariants(address) {
  const original = (address || '').trim()
  const words = original.split(/\s+/)

  let saintIndex = -1
  for (let i = 0; i < words.length - 1; i++) {
    const w = words[i].toLowerCase().replace(/\.$/, '')
    const next = words[i + 1].toLowerCase().replace(/[^a-z']/g, '')
    if ((w === 'st' || w === 'saint') && next.length >= 3 && !NOT_A_SAINT_NAME.has(next)) {
      saintIndex = i
      break
    }
  }
  if (saintIndex === -1) return [original]

  const withPrefix = (prefix, list) =>
    list.map((w, i) => (i === saintIndex ? prefix : w))

  const nameIndex = saintIndex + 1
  const name = words[nameIndex]
  const canAddApostrophe = /s$/i.test(name) && !name.includes("'")
  const withApostrophe = (list) =>
    list.map((w, i) => (i === nameIndex ? w.replace(/s$/i, "'s") : w))

  const candidates = [
    words,
    canAddApostrophe ? withApostrophe(words) : null,
    canAddApostrophe ? withPrefix('Saint', withApostrophe(words)) : null,
    withPrefix('Saint', words),
    withPrefix('St.', words)
  ]

  const seen = new Set()
  const variants = []
  for (const c of candidates) {
    if (!c) continue
    const text = c.join(' ')
    const key = text.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    variants.push(text)
  }
  return variants
}

// Runs the full lookup for one spelling of the street. Returns
// { lat, lng, exact } where exact means Nominatim returned the same house
// number we asked for, or null when nothing was found.
async function geocodeSpelling(street, city, state, zip) {
  const houseNumber = extractHouseNumber(street)

  // 1) Postal-code-first query — a full 6-char Canadian postal code pins
  // a small block, so "street + postalcode" often resolves more precisely
  // than adding city/state (which can pull Nominatim toward a street's
  // downtown segment on long roads like Queen St).
  let results = []
  if (zip) {
    const zipFirst = applySsmBounds(new URLSearchParams({
      street,
      postalcode: zip,
      country: 'Canada',
      format: 'json',
      addressdetails: '1',
      limit: '5',
      countrycodes: 'ca'
    }))
    try {
      results = await queryNominatim(zipFirst)
    } catch {
      results = []
    }

    if (houseNumber && results.length) {
      const target = normalizeNumber(houseNumber)
      const exact = results.find(r => normalizeNumber(r.address?.house_number) === target)
      if (exact) {
        return { lat: parseFloat(exact.lat), lng: parseFloat(exact.lon), exact: true }
      }
    }
  }

  // 2) Structured query with full address components — fallback when the
  // postal code isn't known or didn't return an exact house-number match.
  const structured = applySsmBounds(new URLSearchParams({
    street,
    city: city || '',
    state: state || '',
    country: 'Canada',
    format: 'json',
    addressdetails: '1',
    limit: '5',
    countrycodes: 'ca'
  }))
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
      return { lat: parseFloat(exact.lat), lng: parseFloat(exact.lon), exact: true }
    }
  }

  // If structured returned something but no house-number match, still trust
  // the top hit *only if* the address has no leading number (e.g. a POI or
  // business name). Otherwise fall through to the free-form retry, which
  // sometimes finds a better match.
  if (!houseNumber && results.length) {
    return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon), exact: true }
  }

  // 3) Free-form fallback with addressdetails, still filtered by country.
  const freeform = applySsmBounds(new URLSearchParams({
    q: `${street}, ${city}, ${state}${zip ? ' ' + zip : ''}, Canada`,
    format: 'json',
    addressdetails: '1',
    limit: '5',
    countrycodes: 'ca'
  }))

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
      return { lat: parseFloat(exact.lat), lng: parseFloat(exact.lon), exact: true }
    }
  }

  if (fallback.length) {
    return { lat: parseFloat(fallback[0].lat), lng: parseFloat(fallback[0].lon), exact: false }
  }

  if (results.length) {
    return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon), exact: false }
  }

  return null
}

export async function geocodeAddress(address, city, state, zip) {
  const variants = streetSpellingVariants(address)
  let bestInexact = null

  for (const street of variants) {
    const result = await geocodeSpelling(street, city, state, zip)
    if (!result) continue
    if (result.exact) {
      return { lat: result.lat, lng: result.lng }
    }
    if (!bestInexact) bestInexact = result
  }

  return bestInexact ? { lat: bestInexact.lat, lng: bestInexact.lng } : null
}
