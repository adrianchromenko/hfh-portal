import {
  collection,
  query,
  where,
  getDocs,
  doc,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore'
import { db } from '../firebase'
import {
  addDays,
  addMonths,
  addWeeks,
  format,
  startOfDay,
  startOfMonth,
  endOfMonth
} from 'date-fns'

export const DEFAULT_HORIZON_WEEKS = 52
export const TOPUP_THRESHOLD_WEEKS = 26

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const SHORT_DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Frequency options shared by the customer schedule form and the manual
// booking form. 'nth-weekday' means "the Nth <weekday> of every month"
// (e.g. first Thursday) and requires schedule.weekOfMonth (1-4, or -1 = last).
export const FREQUENCY_OPTIONS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Every 4 weeks' },
  { value: 'nth-weekday', label: 'Monthly on a specific weekday (e.g. first Thursday)' }
]

export const WEEK_OF_MONTH_OPTIONS = [
  { value: 1, label: 'First' },
  { value: 2, label: 'Second' },
  { value: 3, label: 'Third' },
  { value: 4, label: 'Fourth' },
  { value: -1, label: 'Last' }
]

function stepDays(frequency) {
  if (frequency === 'weekly') return 7
  if (frequency === 'biweekly') return 14
  return 28 // monthly (every 4 weeks)
}

// Returns the date of the Nth <weekday> in the month containing `monthDate`,
// or null if that month has no such day (e.g. a 5th Thursday).
function nthWeekdayOfMonth(monthDate, dayOfWeek, weekOfMonth) {
  if (weekOfMonth === -1) {
    const last = endOfMonth(monthDate)
    const back = (last.getDay() - dayOfWeek + 7) % 7
    const d = addDays(last, -back)
    d.setHours(12, 0, 0, 0)
    return d
  }
  const first = startOfMonth(monthDate)
  const forward = (dayOfWeek - first.getDay() + 7) % 7
  const d = addDays(first, forward + (weekOfMonth - 1) * 7)
  d.setHours(12, 0, 0, 0)
  if (d.getMonth() !== monthDate.getMonth()) return null
  return d
}

// Computes every occurrence of a recurring schedule between fromDate and
// throughDate (inclusive) as 'yyyy-MM-dd' strings.
//
// Customer recurring schedules are set up internally by staff and
// intentionally bypass the public booking form's blocked days/dates —
// a Home Depot recurring pickup should still generate even if the
// weekday is paused for public bookings.
export function computeScheduleDates(schedule, fromDate, throughDate) {
  if (!schedule?.startDate || schedule.dayOfWeek == null) return []
  const start = new Date(schedule.startDate + 'T12:00:00')
  if (isNaN(start.getTime())) return []

  const targetDay = Number(schedule.dayOfWeek)
  const dates = []

  if (schedule.frequency === 'nth-weekday') {
    const weekOfMonth = Number(schedule.weekOfMonth) || 1
    let month = startOfMonth(start)
    while (month <= throughDate) {
      const d = nthWeekdayOfMonth(month, targetDay, weekOfMonth)
      if (d && d >= start && d >= fromDate && d <= throughDate) {
        dates.push(format(d, 'yyyy-MM-dd'))
      }
      month = addMonths(month, 1)
    }
    return dates
  }

  const step = stepDays(schedule.frequency)
  const startDay = start.getDay()
  const offset = (targetDay - startDay + 7) % 7
  let current = addDays(start, offset)

  while (current <= throughDate) {
    if (current >= fromDate) {
      dates.push(format(current, 'yyyy-MM-dd'))
    }
    current = addDays(current, step)
  }
  return dates
}

// Short label used on booking badges, e.g. "Weekly", "Bi-weekly",
// "1st Thu monthly". Accepts either a booking doc or a schedule object.
export function recurringBadgeLabel(source) {
  const freq = source?.recurringFrequency || source?.frequency || 'weekly'
  if (freq === 'weekly') return 'Weekly'
  if (freq === 'biweekly') return 'Bi-weekly'
  if (freq === 'nth-weekday') {
    const week = Number(source?.recurringWeekOfMonth ?? source?.weekOfMonth) || 1
    const day = Number(source?.recurringDayOfWeek ?? source?.dayOfWeek)
    const ordinal = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th', '-1': 'Last' }[week] || '1st'
    const dayName = Number.isInteger(day) ? SHORT_DAY_NAMES[day] : ''
    return `${ordinal} ${dayName} monthly`.replace(/\s+/g, ' ').trim()
  }
  return 'Monthly'
}

function bookingFromCustomer(customer, customerId, dateStr) {
  return {
    name: customer.name || '',
    email: customer.email || '',
    phone: customer.phone || '',
    address: customer.address || '',
    apartment: customer.apartment || '',
    city: customer.city || '',
    state: customer.state || '',
    zip: customer.zip || '',
    lat: customer.lat ?? null,
    lng: customer.lng ?? null,
    date: dateStr,
    items: customer.schedule?.defaultItems || '',
    notes: customer.notes || '',
    status: 'confirmed',
    type: customer.schedule?.type || 'pickup',
    isBusiness: Boolean(customer.isBusiness),
    customerId,
    customerName: customer.name || '',
    recurringId: customerId,
    recurring: true,
    recurringFrequency: customer.schedule?.frequency || 'weekly',
    recurringDayOfWeek: Number(customer.schedule?.dayOfWeek ?? 1),
    recurringWeekOfMonth: Number(customer.schedule?.weekOfMonth ?? 1),
    manualEntry: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }
}

// Only the bookings generated by this customer's recurring schedule carry
// recurringId === customerId. One-off bookings created from a saved
// customer carry customerId but no recurringId, so regenerating or
// deleting the schedule never touches them.
async function getCustomerBookings(customerId) {
  const q = query(collection(db, 'bookings'), where('recurringId', '==', customerId))
  const snap = await getDocs(q)
  return snap
}

async function commitInChunks(operations) {
  // Firestore batches max out at 500 ops
  const CHUNK = 450
  for (let i = 0; i < operations.length; i += CHUNK) {
    const batch = writeBatch(db)
    operations.slice(i, i + CHUNK).forEach((op) => op(batch))
    await batch.commit()
  }
}

export async function deleteFutureBookingsForCustomer(customerId) {
  const todayStr = format(startOfDay(new Date()), 'yyyy-MM-dd')
  const snap = await getCustomerBookings(customerId)
  const ops = []
  snap.forEach((d) => {
    if ((d.data().date || '') >= todayStr) {
      ops.push((batch) => batch.delete(d.ref))
    }
  })
  await commitInChunks(ops)
  return ops.length
}

export async function deleteAllBookingsForCustomer(customerId) {
  const snap = await getCustomerBookings(customerId)
  const ops = []
  snap.forEach((d) => ops.push((batch) => batch.delete(d.ref)))
  await commitInChunks(ops)
  return ops.length
}

export async function regenerateFutureBookings(
  customer,
  customerId,
  bookingSettings,
  horizonWeeks = DEFAULT_HORIZON_WEEKS
) {
  await deleteFutureBookingsForCustomer(customerId)
  if (!customer.schedule?.active) return 0

  const today = startOfDay(new Date())
  const through = addWeeks(today, horizonWeeks)
  const dates = computeScheduleDates(customer.schedule, today, through, bookingSettings)

  const ops = dates.map((dateStr) => (batch) => {
    const ref = doc(collection(db, 'bookings'))
    batch.set(ref, bookingFromCustomer(customer, customerId, dateStr))
  })
  await commitInChunks(ops)
  return dates.length
}

export async function extendBookingsForCustomer(
  customer,
  customerId,
  bookingSettings,
  horizonWeeks = DEFAULT_HORIZON_WEEKS
) {
  if (!customer.schedule?.active) return 0

  const today = startOfDay(new Date())
  const todayStr = format(today, 'yyyy-MM-dd')
  const through = addWeeks(today, horizonWeeks)

  const snap = await getCustomerBookings(customerId)
  let maxDate = null
  snap.forEach((d) => {
    const data = d.data()
    if (data.date && data.date >= todayStr && (!maxDate || data.date > maxDate)) {
      maxDate = data.date
    }
  })

  const fromDate = maxDate ? addDays(new Date(maxDate + 'T12:00:00'), 1) : today
  const dates = computeScheduleDates(customer.schedule, fromDate, through, bookingSettings)
  if (dates.length === 0) return 0

  const ops = dates.map((dateStr) => (batch) => {
    const ref = doc(collection(db, 'bookings'))
    batch.set(ref, bookingFromCustomer(customer, customerId, dateStr))
  })
  await commitInChunks(ops)
  return dates.length
}

export async function topUpAllActiveCustomers(customers, bookingSettings) {
  const today = startOfDay(new Date())
  const threshold = addWeeks(today, TOPUP_THRESHOLD_WEEKS)
  const todayStr = format(today, 'yyyy-MM-dd')

  for (const customer of customers) {
    if (!customer?.schedule?.active) continue

    const snap = await getCustomerBookings(customer.id)
    let maxDate = null
    snap.forEach((d) => {
      const data = d.data()
      if (data.date && data.date >= todayStr && (!maxDate || data.date > maxDate)) {
        maxDate = data.date
      }
    })

    if (!maxDate || new Date(maxDate + 'T12:00:00') < threshold) {
      await extendBookingsForCustomer(customer, customer.id, bookingSettings)
    }
  }
}

export function computeNextPickupDate(schedule, bookingSettings) {
  if (!schedule?.active || !schedule.startDate) return null
  const today = startOfDay(new Date())
  const through = addWeeks(today, 12)
  const dates = computeScheduleDates(schedule, today, through, bookingSettings)
  return dates[0] || null
}

export function scheduleSummary(schedule) {
  if (!schedule?.active) return 'Inactive'
  const day = DAY_NAMES[schedule.dayOfWeek] || 'Monday'
  const type = schedule.type === 'delivery' ? 'delivery' : 'pickup'
  if (schedule.frequency === 'nth-weekday') {
    const week = WEEK_OF_MONTH_OPTIONS.find((w) => w.value === Number(schedule.weekOfMonth))
    return `${week?.label || 'First'} ${day} of every month — ${type}`
  }
  const freq =
    schedule.frequency === 'weekly'
      ? 'Every'
      : schedule.frequency === 'biweekly'
      ? 'Every other'
      : 'Every 4 weeks on'
  return `${freq} ${day} — ${type}`
}
