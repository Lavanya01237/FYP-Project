import { Route } from '../types';
import { Clock, DollarSign, Car } from 'lucide-react';

interface RouteSummaryProps {
  route: Route;
}

export function RouteSummary({ route }: RouteSummaryProps) {
  // Group locations by tripId
  const trips = route.locations.reduce((acc, location) => {
    if (location.type === 'pickup') {
      const dropoff = route.locations.find(
        loc => loc.tripId === location.tripId && loc.type === 'dropoff'
      );
      if (dropoff) {
        acc.push({
          id: location.tripId,
          pickup: location,
          dropoff: dropoff,
          revenue: location.revenue
        });
      }
    }
    return acc;
  }, [] as Array<{
    id: number;
    pickup: typeof route.locations[0];
    dropoff: typeof route.locations[0];
    revenue: number;
  }>);

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center">
          <DollarSign className="h-6 w-6 mx-auto text-green-600 mb-2" />
          <p className="text-sm text-gray-600">Total Revenue</p>
          <p className="text-xl font-semibold">${route.totalRevenue.toFixed(2)}</p>
        </div>
        <div className="text-center">
          <Clock className="h-6 w-6 mx-auto text-blue-600 mb-2" />
          <p className="text-sm text-gray-600">Total Time</p>
          <p className="text-xl font-semibold">{route.totalDrivingTime}h</p>
        </div>
        <div className="text-center">
          <Car className="h-6 w-6 mx-auto text-purple-600 mb-2" />
          <p className="text-sm text-gray-600">Break Time</p>
          <p className="text-lg font-medium">{route.breakTime}</p>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-semibold text-lg text-gray-800 mb-4">Journey Details</h3>
        <div className="divide-y divide-gray-100">
          {trips.map((trip) => (
            <div
              key={trip.id}
              className="py-4 first:pt-0 last:pb-0"
            >
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-600">
                    {trip.pickup.time} - {trip.dropoff.time}
                  </span>
                </div>
                <span className="text-green-600 font-semibold">${trip.revenue.toFixed(2)}</span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="flex items-center space-x-2 text-gray-500 mb-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full" />
                    <span>Pick-up Location</span>
                  </div>
                  <span className="text-gray-600 text-xs">
                    {trip.pickup.lat.toFixed(4)}, {trip.pickup.lng.toFixed(4)}
                  </span>
                </div>
                <div>
                  <div className="flex items-center space-x-2 text-gray-500 mb-1">
                    <span className="w-2 h-2 bg-blue-500 rounded-full" />
                    <span>Drop-off Location</span>
                  </div>
                  <span className="text-gray-600 text-xs">
                    {trip.dropoff.lat.toFixed(4)}, {trip.dropoff.lng.toFixed(4)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}