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

export function formatHourLabel(hour) {
  const h = Number(hour)
  if (!Number.isFinite(h)) return ''
  const ampm = h >= 12 ? 'PM' : 'AM'
  const display = h % 12 === 0 ? 12 : h % 12
  return `${display}:00 ${ampm}`
}
