import { format } from 'date-fns'
import { MapPin, Clock, Phone, Package, Truck } from 'lucide-react'

export default function PrintRouteSheet({ routeData, stops, date, depot }) {
  const formatTime = (time) => {
    if (!time) return 'Flexible'
    const [hours, minutes] = time.split(':')
    const h = parseInt(hours)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const hour = h > 12 ? h - 12 : h === 0 ? 12 : h
    return `${hour}:${minutes} ${ampm}`
  }

  const formatDistance = (meters) => {
    const km = meters / 1000
    return `${km.toFixed(1)} km`
  }

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes} min`
  }

  const orderedStops = routeData ? routeData.orderedStops : stops

  return (
    <div className="print-route-sheet">
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-route-sheet, .print-route-sheet * {
            visibility: visible;
          }
          .print-route-sheet {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 20px;
            font-size: 12px;
          }
          .page-break {
            page-break-after: always;
          }
          .no-print {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
        }
        @media screen {
          .print-only {
            display: none;
          }
        }
      `}</style>

      <div className="print-only bg-white p-6">
        {/* Header */}
        <div className="border-b-2 border-gray-800 pb-4 mb-4">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Habitat for Humanity</h1>
              <h2 className="text-lg text-gray-700">Pickup/Delivery Route Sheet</h2>
            </div>
            <div className="text-right">
              <p className="font-semibold text-lg">{format(new Date(date + 'T12:00:00'), 'EEEE, MMMM d, yyyy')}</p>
              <p className="text-sm text-gray-600">Driver: ___________________</p>
            </div>
          </div>
        </div>

        {/* Route Summary */}
        {routeData && (
          <div className="bg-gray-100 p-3 rounded mb-4">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="font-semibold">Total Stops:</span> {orderedStops.length}
              </div>
              <div>
                <span className="font-semibold">Distance:</span> {formatDistance(routeData.totalDistance)}
              </div>
              <div>
                <span className="font-semibold">Est. Time:</span> {formatDuration(routeData.totalDuration)}
              </div>
            </div>
          </div>
        )}

        {/* Stop List */}
        <div className="space-y-3">
          {/* Starting Point */}
          <div className="border border-green-600 rounded p-3 bg-green-50">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center font-bold">
                H
              </div>
              <div className="flex-1">
                <p className="font-bold text-green-900">START - Habitat ReStore</p>
                <p className="text-sm">44 Great Northern Rd, Sault Ste. Marie, ON</p>
              </div>
              <div className="text-sm">
                <input type="checkbox" className="mr-2" />
                <span>Departed: _______</span>
              </div>
            </div>
          </div>

          {/* Stops */}
          {orderedStops.map((stop, index) => {
            const type = stop.type || 'pickup'
            return (
              <div key={stop.id} className="border border-gray-400 rounded p-3">
                <div className="flex items-start gap-3">
                  <div 
                    className="flex-shrink-0 w-8 h-8 rounded-full text-white flex items-center justify-center font-bold"
                    style={{ backgroundColor: type === 'delivery' ? '#F7941D' : '#0099CC' }}
                  >
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-bold">{stop.name}</p>
                        <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                          type === 'delivery' 
                            ? 'bg-orange-200 text-orange-800' 
                            : 'bg-blue-200 text-blue-800'
                        }`}>
                          {type === 'delivery' ? 'DELIVERY' : 'PICKUP'}
                        </span>
                      </div>
                      <div className="text-sm">
                        <input type="checkbox" className="mr-2" />
                        <span>Completed: _______</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm mb-2">
                      <div>
                        <span className="font-semibold">📍 Address:</span>
                        <p>{stop.address}</p>
                        <p>{stop.city}, {stop.state} {stop.zip}</p>
                      </div>
                      <div>
                        <p><span className="font-semibold">📞 Phone:</span> {stop.phone}</p>
                        <p><span className="font-semibold">⏰ Time:</span> {formatTime(stop.time) || '10 AM - 4 PM'}</p>
                      </div>
                    </div>

                    {stop.items && (
                      <div className="border-t pt-2 mt-2">
                        <p className="text-sm"><span className="font-semibold">📦 Items:</span></p>
                        <p className="text-sm ml-4">{stop.items}</p>
                      </div>
                    )}

                    {stop.notes && (
                      <div className="border-t pt-2 mt-2">
                        <p className="text-sm"><span className="font-semibold">📝 Notes:</span></p>
                        <p className="text-sm ml-4">{stop.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {/* Return to Depot */}
          <div className="border border-green-600 rounded p-3 bg-green-50">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center font-bold">
                H
              </div>
              <div className="flex-1">
                <p className="font-bold text-green-900">END - Return to Habitat ReStore</p>
                <p className="text-sm">44 Great Northern Rd, Sault Ste. Marie, ON</p>
              </div>
              <div className="text-sm">
                <input type="checkbox" className="mr-2" />
                <span>Returned: _______</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t-2 border-gray-800">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-semibold mb-2">Driver Notes:</p>
              <div className="border border-gray-400 rounded h-20 p-2">
                <div className="h-full" style={{ lineHeight: '1.5em' }}>
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="border-b border-gray-200" style={{ height: '1.5em' }}></div>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <p className="font-semibold mb-2">Signatures:</p>
              <div className="space-y-3">
                <div>
                  <p className="text-xs">Driver Signature:</p>
                  <div className="border-b border-gray-400 h-6"></div>
                </div>
                <div>
                  <p className="text-xs">Supervisor Signature:</p>
                  <div className="border-b border-gray-400 h-6"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Page number */}
        <div className="text-center text-xs text-gray-500 mt-4">
          Page 1 of 1 - Generated {format(new Date(), 'MMM d, yyyy h:mm a')}
        </div>
      </div>
    </div>
  )
}