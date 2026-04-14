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
import { addDays, addWeeks, format, startOfDay } from 'date-fns'

export const DEFAULT_HORIZON_WEEKS = 52
export const TOPUP_THRESHOLD_WEEKS = 26

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function stepDays(frequency) {
  if (frequency === 'weekly') return 7
  if (frequency === 'biweekly') return 14
  return 28 // monthly (every 4 weeks)
}

function computeScheduleDates(schedule, fromDate, throughDate) {
  if (!schedule?.startDate || schedule.dayOfWeek == null) return []
  const start = new Date(schedule.startDate + 'T12:00:00')
  if (isNaN(start.getTime())) return []

  const step = stepDays(schedule.frequency)
  const targetDay = Number(schedule.dayOfWeek)
  const startDay = start.getDay()
  const offset = (targetDay - startDay + 7) % 7
  let current = addDays(start, offset)

  // Customer recurring schedules are set up internally by staff and
  // intentionally bypass the public booking form's blocked days/dates —
  // a Home Depot recurring pickup should still generate even if the
  // weekday is paused for public bookings.
  const dates = []
  while (current <= throughDate) {
    if (current >= fromDate) {
      dates.push(format(current, 'yyyy-MM-dd'))
    }
    current = addDays(current, step)
  }
  return dates
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
    customerId,
    customerName: customer.name || '',
    recurringId: customerId,
    recurring: true,
    recurringFrequency: customer.schedule?.frequency || 'weekly',
    manualEntry: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }
}

async function getCustomerBookings(customerId) {
  const q = query(collection(db, 'bookings'), where('customerId', '==', customerId))
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
  const freq =
    schedule.frequency === 'weekly'
      ? 'Every'
      : schedule.frequency === 'biweekly'
      ? 'Every other'
      : 'Monthly on'
  const type = schedule.type === 'delivery' ? 'delivery' : 'pickup'
  return `${freq} ${day} — ${type}`
}
