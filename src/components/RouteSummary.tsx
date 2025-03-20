import { Route } from '../types';
import { DollarSign, Clock, Car, MapPin, TrendingUp, MapIcon, Coffee } from 'lucide-react';
import { useState } from 'react';

interface RouteSummaryProps {
  route: Route;
  darkMode?: boolean;
  algorithm?: 'reinforcement' | 'greedy';
}

export function RouteSummary({ route, darkMode = false, algorithm = 'reinforcement' }: RouteSummaryProps) {
  const [expandedTrip, setExpandedTrip] = useState<number | null>(null);

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
          revenue: dropoff.revenue
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

  const toggleTrip = (id: number) => {
    if (expandedTrip === id) {
      setExpandedTrip(null);
    } else {
      setExpandedTrip(id);
    }
  };

  return (
    <div className={`${darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white'} p-6 rounded-xl shadow-lg space-y-6 transition-colors duration-300 animate-fadeIn`}>
      <h2 className={`text-lg font-semibold mb-1 ${darkMode ? 'text-gray-100' : 'text-gray-800'} flex items-center`}>
        <MapIcon className="mr-2 h-5 w-5" />
        Route Summary
      </h2>
      <div className={`inline-flex items-center px-2 py-1 mb-3 text-xs font-medium rounded-full ${
        algorithm === 'reinforcement' 
          ? (darkMode ? 'bg-purple-900 text-purple-200' : 'bg-purple-100 text-purple-800') 
          : (darkMode ? 'bg-emerald-900 text-emerald-200' : 'bg-emerald-100 text-emerald-800')
      }`}>
        {algorithm === 'reinforcement' ? 'Reinforcement Learning Algorithm' : 'Greedy Algorithm'}
      </div>
      
      <div className="grid grid-cols-3 gap-4 mb-2">
        <div className={`${darkMode ? 'bg-gray-700' : 'bg-blue-50'} p-4 rounded-lg text-center transition-colors duration-300`}>
          <DollarSign className={`h-8 w-8 mx-auto ${darkMode ? 'text-green-400' : 'text-green-500'} mb-2`} />
          <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Total Revenue</p>
          <p className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
            ${route.totalRevenue.toFixed(2)}
          </p>
        </div>
        
        <div className={`${darkMode ? 'bg-gray-700' : 'bg-blue-50'} p-4 rounded-lg text-center transition-colors duration-300`}>
          <Clock className={`h-8 w-8 mx-auto ${darkMode ? 'text-blue-400' : 'text-blue-500'} mb-2`} />
          <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Driving Time</p>
          <p className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
            {route.totalDrivingTime > 0 ? `${route.totalDrivingTime}h` : 'Calculating...'}
          </p>
        </div>
        
        <div className={`${darkMode ? 'bg-gray-700' : 'bg-blue-50'} p-4 rounded-lg text-center transition-colors duration-300`}>
          <Coffee className={`h-8 w-8 mx-auto ${darkMode ? 'text-amber-400' : 'text-amber-500'} mb-2`} />
          <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Break Time</p>
          <p className={`text-lg font-medium ${darkMode ? 'text-white' : 'text-gray-800'}`}>
            {route.breakTime}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className={`font-semibold text-base ${darkMode ? 'text-gray-200' : 'text-gray-800'} flex items-center`}>
            <Car className="mr-2 h-4 w-4" />
            Trip Details ({trips.length})
          </h3>
          <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Click a trip for details
          </div>
        </div>
        
        <div className={`divide-y ${darkMode ? 'divide-gray-700' : 'divide-gray-100'} max-h-[320px] overflow-auto pr-2`}>
          {trips.map((trip) => (
            <div
              key={trip.id}
              onClick={() => toggleTrip(trip.id)}
              className={`py-3 first:pt-0 last:pb-0 cursor-pointer transition-all duration-200 ${darkMode 
                ? (expandedTrip === trip.id ? 'bg-gray-700 -mx-3 px-3 rounded' : '') 
                : (expandedTrip === trip.id ? 'bg-blue-50 -mx-3 px-3 rounded' : '')}`}
            >
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center space-x-2">
                  <Clock className={`h-4 w-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                  <span className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    {trip.pickup.time} - {trip.dropoff.time}
                  </span>
                </div>
                <span className={`${darkMode ? 'text-green-400' : 'text-green-600'} font-semibold flex items-center`}>
                  ${trip.revenue.toFixed(2)}
                  <TrendingUp className="h-3 w-3 ml-1" />
                </span>
              </div>
              
              {expandedTrip === trip.id && (
                <div className="mt-3 grid grid-cols-2 gap-4 text-sm animate-fadeIn">
                  <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} p-3 rounded border ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                    <div className="flex items-center space-x-2 text-xs mb-2">
                      <span className="w-2 h-2 bg-green-500 rounded-full" />
                      <span className={darkMode ? 'text-gray-300' : 'text-gray-600'}>Pick-up</span>
                    </div>
                    <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>
                      Time: {trip.pickup.time}
                    </div>
                    <div className="flex items-center mt-1">
                      <MapPin className={`h-3 w-3 mr-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                      <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {trip.pickup.lat.toFixed(4)}, {trip.pickup.lng.toFixed(4)}
                      </span>
                    </div>
                  </div>
                  
                  <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} p-3 rounded border ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                    <div className="flex items-center space-x-2 text-xs mb-2">
                      <span className="w-2 h-2 bg-blue-500 rounded-full" />
                      <span className={darkMode ? 'text-gray-300' : 'text-gray-600'}>Drop-off</span>
                    </div>
                    <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>
                      Time: {trip.dropoff.time}
                    </div>
                    <div className="flex items-center mt-1">
                      <MapPin className={`h-3 w-3 mr-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                      <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {trip.dropoff.lat.toFixed(4)}, {trip.dropoff.lng.toFixed(4)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}