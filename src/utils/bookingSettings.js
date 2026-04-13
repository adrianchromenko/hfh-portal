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

export const DEFAULT_BOOKING_SETTINGS = {
  bookingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  blockedDays: [],
  blockedDates: [],
  pickupStartHour: 10,
  pickupEndHour: 16,
  maxPerDay: 0
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

function normalize(data) {
  const merged = { ...DEFAULT_BOOKING_SETTINGS, ...(data || {}) }
  merged.bookingDays = Array.isArray(merged.bookingDays)
    ? merged.bookingDays
    : DEFAULT_BOOKING_SETTINGS.bookingDays
  merged.blockedDays = Array.isArray(merged.blockedDays) ? merged.blockedDays : []
  merged.blockedDates = Array.isArray(merged.blockedDates) ? merged.blockedDates : []
  merged.pickupStartHour = Number.isFinite(merged.pickupStartHour)
    ? merged.pickupStartHour
    : DEFAULT_BOOKING_SETTINGS.pickupStartHour
  merged.pickupEndHour = Number.isFinite(merged.pickupEndHour)
    ? merged.pickupEndHour
    : DEFAULT_BOOKING_SETTINGS.pickupEndHour
  merged.maxPerDay = Number.isFinite(merged.maxPerDay) ? merged.maxPerDay : 0
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
  await setDoc(
    ref,
    {
      bookingDays: settings.bookingDays,
      blockedDays: settings.blockedDays,
      blockedDates: settings.blockedDates,
      pickupStartHour: settings.pickupStartHour,
      pickupEndHour: settings.pickupEndHour,
      maxPerDay: settings.maxPerDay,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  )
}

export function isDateBlocked(dateString, settings) {
  if (!dateString) return { blocked: false }
  const { bookingDays, blockedDays, blockedDates } = settings || DEFAULT_BOOKING_SETTINGS

  if ((blockedDates || []).includes(dateString)) {
    return { blocked: true, reason: 'This date is blocked off.' }
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

export async function isDateAtCapacity(dateString, settings) {
  const cap = settings?.maxPerDay || 0
  if (!cap || cap <= 0) return false
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
