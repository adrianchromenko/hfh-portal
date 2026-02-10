import { MapPin, Navigation, AlertTriangle, Package, Truck } from 'lucide-react'
import StatusBadge from '../StatusBadge'

export default function RoutePanel({
  stops,
  routeData,
  isOptimizing,
  onOptimize,
  onStopClick
}) {
  const displayStops = routeData ? routeData.orderedStops : stops

  const formatDistance = (meters) => {
    const km = meters / 1000
    return `${km.toFixed(1)} km`
  }

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.round((seconds % 3600) / 60)
    if (hours === 0) return `${minutes} min`
    return `${hours}h ${minutes}m`
  }

  const geocodedStops = stops.filter(s => s.lat && s.lng)
  const ungeocodedStops = stops.filter(s => !s.lat || !s.lng)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">Route</h3>
          <span className="text-sm text-gray-500">
            {stops.length} stop{stops.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={onOptimize}
            disabled={isOptimizing || geocodedStops.length < 2}
            className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isOptimizing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Optimizing...
              </>
            ) : (
              <>
                <Navigation className="h-4 w-4" />
                Optimize Route
              </>
            )}
          </button>
          {routeData && onPrint && (
            <button
              onClick={onPrint}
              className="py-2 px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors flex items-center justify-center"
              title="Print route sheet"
            >
              <Printer className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Route summary */}
        {routeData && (
          <div className="mt-3 p-3 bg-green-50 rounded-lg text-sm">
            <div className="flex items-center gap-4 text-green-800">
              <span>{formatDistance(routeData.totalDistance)}</span>
              <span>~{formatDuration(routeData.totalDuration)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Stop list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {/* Depot */}
        <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
          <div className="flex-shrink-0 w-7 h-7 rounded-full bg-green-600 text-white flex items-center justify-center font-bold text-xs">
            H
          </div>
          <div>
            <p className="font-medium text-green-900 text-sm">Habitat ReStore</p>
            <p className="text-xs text-green-700">44 Great Northern Rd, Sault Ste. Marie</p>
            <p className="text-xs text-green-600 mt-0.5">Start Point</p>
          </div>
        </div>

        {/* Stops */}
        {displayStops.map((stop, index) => {
          const type = stop.type || 'pickup'
          const hasCoords = stop.lat && stop.lng
          return (
            <div
              key={stop.id}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                hasCoords
                  ? 'bg-white border-gray-200 hover:border-habitat-green hover:bg-gray-50'
                  : 'bg-amber-50 border-amber-200'
              }`}
              onClick={() => onStopClick && hasCoords && onStopClick(stop)}
            >
              <div
                className="flex-shrink-0 w-7 h-7 rounded-full text-white flex items-center justify-center font-bold text-xs"
                style={{ background: type === 'delivery' ? '#F7941D' : '#0099CC' }}
              >
                {index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-medium text-gray-900 text-sm truncate">{stop.name}</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                    type === 'delivery'
                      ? 'bg-orange-100 text-orange-800'
                      : 'bg-sky-100 text-sky-800'
                  }`}>
                    {type === 'delivery' ? 'Delivery' : 'Pickup'}
                  </span>
                </div>
                <p className="text-xs text-gray-500 truncate">
                  {stop.address}, {stop.city}, {stop.state} {stop.zip}
                </p>
                {stop.items && (
                  <p className="text-xs text-gray-400 truncate mt-0.5">
                    <Package className="inline h-3 w-3 mr-1" />
                    {stop.items}
                  </p>
                )}
                <div className="mt-1">
                  <StatusBadge status={stop.status} />
                </div>
                {!hasCoords && (
                  <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Could not geocode address
                  </p>
                )}
              </div>
            </div>
          )
        })}

        {stops.length === 0 && (
          <div className="text-center py-8">
            <Truck className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p className="text-sm text-gray-500">No stops for this date</p>
          </div>
        )}

        {/* Ungeocoded warning */}
        {ungeocodedStops.length > 0 && (
          <div className="mt-2 p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-700">
            <AlertTriangle className="inline h-3 w-3 mr-1" />
            {ungeocodedStops.length} stop{ungeocodedStops.length !== 1 ? 's' : ''} could not be placed on the map.
            These will be excluded from route optimization.
          </div>
        )}
      </div>
    </div>
  )
}
