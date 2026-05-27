import {
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs
} from 'firebase/firestore'
import { db } from '../firebase'

export const SETTINGS_DOC_PATH = ['settings', 'booking']

export const WEEKDAY_NAMES = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday'
]

function emptyWeekdayMap() {
  return WEEKDAY_NAMES.reduce((acc, d) => {
    acc[d] = 0
    return acc
  }, {})
}

export const DEFAULT_BOOKING_SETTINGS = {
  bookingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  blockedDays: [],
  blockedDates: [],
  pickupStartHour: 10,
  pickupEndHour: 16,
  maxPerDay: 0,
  maxPerWeekday: emptyWeekdayMap()
}

const DAY_NAME_TO_INDEX = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6
}

// Accepts either a legacy string ("2026-06-15") or a {date, note} object and
// returns the normalized {date, note} shape. Anything malformed becomes null.
function normalizeBlockedDateEntry(entry) {
  if (typeof entry === 'string') {
    return /^\d{4}-\d{2}-\d{2}$/.test(entry) ? { date: entry, note: '' } : null
  }
  if (entry && typeof entry === 'object' && typeof entry.date === 'string') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) return null
    return { date: entry.date, note: typeof entry.note === 'string' ? entry.note : '' }
  }
  return null
}

function normalize(data) {
  const merged = { ...DEFAULT_BOOKING_SETTINGS, ...(data || {}) }
  merged.bookingDays = Array.isArray(merged.bookingDays)
    ? merged.bookingDays
    : DEFAULT_BOOKING_SETTINGS.bookingDays
  merged.blockedDays = Array.isArray(merged.blockedDays) ? merged.blockedDays : []
  merged.blockedDates = Array.isArray(merged.blockedDates)
    ? merged.blockedDates.map(normalizeBlockedDateEntry).filter(Boolean)
    : []
  merged.pickupStartHour = Number.isFinite(merged.pickupStartHour)
    ? merged.pickupStartHour
    : DEFAULT_BOOKING_SETTINGS.pickupStartHour
  merged.pickupEndHour = Number.isFinite(merged.pickupEndHour)
    ? merged.pickupEndHour
    : DEFAULT_BOOKING_SETTINGS.pickupEndHour
  merged.maxPerDay = Number.isFinite(merged.maxPerDay) ? merged.maxPerDay : 0

  const mpw = emptyWeekdayMap()
  const incoming =
    merged.maxPerWeekday && typeof merged.maxPerWeekday === 'object'
      ? merged.maxPerWeekday
      : {}
  for (const day of WEEKDAY_NAMES) {
    const v = Number(incoming[day])
    mpw[day] = Number.isFinite(v) && v >= 0 ? v : 0
  }
  merged.maxPerWeekday = mpw
  return merged
}

export function subscribeBookingSettings(callback) {
  const ref = doc(db, ...SETTINGS_DOC_PATH)
  return onSnapshot(ref, (snap) => {
    callback(normalize(snap.exists() ? snap.data() : null))
  })
}

export async function saveBookingSettings(settings) {
  const ref = doc(db, ...SETTINGS_DOC_PATH)
  const cleanedBlockedDates = (settings.blockedDates || [])
    .map(normalizeBlockedDateEntry)
    .filter(Boolean)
  await setDoc(
    ref,
    {
      bookingDays: settings.bookingDays,
      blockedDays: settings.blockedDays,
      blockedDates: cleanedBlockedDates,
      pickupStartHour: settings.pickupStartHour,
      pickupEndHour: settings.pickupEndHour,
      maxPerDay: settings.maxPerDay,
      maxPerWeekday: settings.maxPerWeekday,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  )
}

export function isDateBlocked(dateString, settings) {
  if (!dateString) return { blocked: false }
  const { bookingDays, blockedDays, blockedDates } = settings || DEFAULT_BOOKING_SETTINGS

  const blockedMatch = (blockedDates || []).find(
    (entry) => entry && entry.date === dateString
  )
  if (blockedMatch) {
    return {
      blocked: true,
      reason: blockedMatch.note
        ? `This date is blocked off: ${blockedMatch.note}`
        : 'This date is blocked off.'
    }
  }

  const date = new Date(dateString + 'T12:00:00')
  if (isNaN(date.getTime())) return { blocked: false }
  const dayIndex = date.getDay()

  const enabledIndexes = (bookingDays || []).map((d) => DAY_NAME_TO_INDEX[d])
  if (!enabledIndexes.includes(dayIndex)) {
    return { blocked: true, reason: 'Bookings are not accepted on this day of the week.' }
  }

  const blockedDayIndexes = (blockedDays || []).map((d) => DAY_NAME_TO_INDEX[d])
  if (blockedDayIndexes.includes(dayIndex)) {
    return { blocked: true, reason: 'This weekday is blocked off.' }
  }

  return { blocked: false }
}

export async function countBookingsOnDate(dateString) {
  if (!dateString) return 0
  const q = query(collection(db, 'bookings'), where('date', '==', dateString))
  const snap = await getDocs(q)
  let count = 0
  snap.forEach((d) => {
    const status = d.data().status
    if (status !== 'cancelled') count++
  })
  return count
}

export function getMaxForDate(dateString, settings) {
  if (!dateString) return 0
  const date = new Date(dateString + 'T12:00:00')
  if (isNaN(date.getTime())) return 0
  const weekdayName = WEEKDAY_NAMES[date.getDay()]
  const perWeekday = Number(settings?.maxPerWeekday?.[weekdayName])
  if (Number.isFinite(perWeekday) && perWeekday > 0) return perWeekday
  const legacy = Number(settings?.maxPerDay) || 0
  return legacy > 0 ? legacy : 0
}

export async function isDateAtCapacity(dateString, settings) {
  const cap = getMaxForDate(dateString, settings)
  if (!cap) return false
  const count = await countBookingsOnDate(dateString)
  return count >= cap
}

// Compute which upcoming dates have hit their cap, based on a live snapshot
// of future bookings plus the cap settings. Returns a sorted array of
// YYYY-MM-DD strings.
function computeFullDates(bookings, settings) {
  const counts = {}
  for (const b of bookings) {
    if (b.status === 'cancelled') continue
    if (!b.date || typeof b.date !== 'string') continue
    counts[b.date] = (counts[b.date] || 0) + 1
  }
  const full = []
  for (const date of Object.keys(counts)) {
    const cap = getMaxForDate(date, settings)
    if (cap > 0 && counts[date] >= cap) full.push(date)
  }
  full.sort()
  return full
}

function arraysEqual(a, b) {
  if (a === b) return true
  if (!Array.isArray(a) || !Array.isArray(b)) return false
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

// Keep `settings/booking.fullDates` in sync with the live state of upcoming
// bookings. The customer-facing booking widget cannot read the `bookings`
// collection (PII protection) and instead reads this public array to grey out
// dates that have hit their cap. Subscribes to settings + future bookings;
// returns an unsubscribe function.
export function subscribeFullDatesReconciler() {
  let latestSettings = null
  let latestBookings = []
  let lastPublished = null
  let publishInFlight = false

  const todayStr = (() => {
    const t = new Date()
    const y = t.getFullYear()
    const m = String(t.getMonth() + 1).padStart(2, '0')
    const d = String(t.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  })()

  async function maybePublish() {
    if (!latestSettings) return
    if (publishInFlight) return
    const next = computeFullDates(latestBookings, latestSettings)
    // The settings doc itself is the source of truth for `fullDates`, so the
    // first pass also publishes when the doc has no array yet.
    if (lastPublished !== null && arraysEqual(next, lastPublished)) return
    publishInFlight = true
    try {
      await setDoc(
        doc(db, ...SETTINGS_DOC_PATH),
        { fullDates: next, fullDatesUpdatedAt: serverTimestamp() },
        { merge: true }
      )
      lastPublished = next
    } catch (err) {
      console.warn('fullDates publish failed:', err)
    } finally {
      publishInFlight = false
    }
  }

  const unsubSettings = onSnapshot(doc(db, ...SETTINGS_DOC_PATH), (snap) => {
    const data = snap.exists() ? snap.data() : null
    latestSettings = normalize(data)
    // Seed lastPublished from the doc so we don't write on first load unless
    // the computed value actually differs from what's already there.
    if (lastPublished === null && Array.isArray(data?.fullDates)) {
      lastPublished = [...data.fullDates].sort()
    }
    maybePublish()
  })

  const futureQuery = query(
    collection(db, 'bookings'),
    where('date', '>=', todayStr)
  )
  const unsubBookings = onSnapshot(futureQuery, (snap) => {
    latestBookings = snap.docs.map((d) => d.data())
    maybePublish()
  })

  return () => {
    unsubSettings()
    unsubBookings()
  }
}

export function formatHourLabel(hour) {
  const h = Number(hour)
  if (!Number.isFinite(h)) return ''
  const ampm = h >= 12 ? 'PM' : 'AM'
  const display = h % 12 === 0 ? 12 : h % 12
  return `${display}:00 ${ampm}`
}
