// Truck assignment for pickups/deliveries.
// A booking's `truck` field is 'one', 'two', or unset (= unassigned).
// Used by the Bookings list, the booking detail modal, and the Route Map so
// each truck can be filtered out and routed on its own.

export const TRUCKS = [
  { value: 'one', label: 'Truck One', color: '#4F46E5' }, // indigo
  { value: 'two', label: 'Truck Two', color: '#0D9488' }, // teal
]

export function truckLabel(value) {
  const t = TRUCKS.find((t) => t.value === value)
  return t ? t.label : 'Unassigned'
}

export function truckColor(value) {
  const t = TRUCKS.find((t) => t.value === value)
  return t ? t.color : '#9CA3AF' // gray for unassigned
}

// Tailwind badge classes per truck (gray when unassigned).
export function truckBadgeClasses(value) {
  if (value === 'one') return 'bg-indigo-100 text-indigo-700'
  if (value === 'two') return 'bg-teal-100 text-teal-700'
  return 'bg-gray-100 text-gray-600'
}

// Shared filter predicate. `filter` is 'all', 'unassigned', 'one', or 'two'.
export function matchesTruckFilter(truck, filter) {
  if (filter === 'all') return true
  if (filter === 'unassigned') return truck !== 'one' && truck !== 'two'
  return truck === filter
}
