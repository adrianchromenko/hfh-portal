import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'

export const SETTINGS_DOC_PATH = ['settings', 'booking']

export const DEFAULT_BOOKING_SETTINGS = {
  bookingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  blockedDays: [],
  blockedDates: []
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

export function subscribeBookingSettings(callback) {
  const ref = doc(db, ...SETTINGS_DOC_PATH)
  return onSnapshot(ref, (snap) => {
    if (snap.exists()) {
      const data = snap.data()
      callback({
        bookingDays: data.bookingDays || DEFAULT_BOOKING_SETTINGS.bookingDays,
        blockedDays: data.blockedDays || DEFAULT_BOOKING_SETTINGS.blockedDays,
        blockedDates: data.blockedDates || DEFAULT_BOOKING_SETTINGS.blockedDates
      })
    } else {
      callback(DEFAULT_BOOKING_SETTINGS)
    }
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
