import { useState, useEffect } from 'react';
import { Route } from '../types';
import { DollarSign, Clock, Car, MapPin, TrendingUp, MapIcon, Coffee, ChevronDown, ChevronUp } from 'lucide-react';

interface RouteSummaryProps {
  route: Route;
  darkMode?: boolean;
  algorithm?: 'reinforcement' | 'greedy';
  themeColors?: {
    bg: string;
    card: string;
    text: string;
    highlight: string;
    secondaryBg: string;
    border: string;
  };
}

export function RouteSummary({ route, darkMode = false, algorithm = 'reinforcement', themeColors }: RouteSummaryProps) {
  const [expandedTrip, setExpandedTrip] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<boolean>(true);
  const [showAllTrips, setShowAllTrips] = useState<boolean>(false);
  const [trips, setTrips] = useState<Array<{
    id: number;
    pickup: typeof route.locations[0];
    dropoff: typeof route.locations[0];
    revenue: number;
  }>>([]);

  // Function to ensure proper trip generation
  const ensureTripsGenerated = (routeData: Route) => {
    // First, try the standard grouping logic
    const generatedTrips = routeData.locations.reduce((acc, location) => {
      if (location.type === 'pickup') {
        const dropoff = routeData.locations.find(
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
      pickup: typeof routeData.locations[0];
      dropoff: typeof routeData.locations[0];
      revenue: number;
    }>);

    // If no trips were found but there are dropoff locations, create trips from consecutive locations
    if (generatedTrips.length === 0 && routeData.locations.filter(loc => loc.type === 'dropoff').length > 0) {
      const fallbackTrips = [];
      const dropoffs = routeData.locations.filter(loc => loc.type === 'dropoff');
      
      for (const dropoff of dropoffs) {
        // Find the closest pickup before this dropoff
        const pickups = routeData.locations.filter(
          loc => loc.type === 'pickup' && 
          routeData.locations.indexOf(loc) < routeData.locations.indexOf(dropoff)
        );
        
        if (pickups.length > 0) {
          const pickup = pickups[pickups.length - 1]; // Get the latest pickup
          fallbackTrips.push({
            id: dropoff.tripId || fallbackTrips.length + 1,
            pickup: pickup,
            dropoff: dropoff,
            revenue: dropoff.revenue
          });
        }
      }
      
      return fallbackTrips;
    }
    
    return generatedTrips;
  };

  // Update trips when route changes
  useEffect(() => {
    setTrips(ensureTripsGenerated(route));
  }, [route]);

  const toggleTrip = (id: number) => {
    if (expandedTrip === id) {
      setExpandedTrip(null);
    } else {
      setExpandedTrip(id);
    }
  };

  const colors = themeColors || {
    bg: darkMode ? 'bg-gray-900' : 'bg-purple-50',
    card: darkMode ? 'bg-gray-800' : 'bg-white',
    text: darkMode ? 'text-gray-200' : 'text-gray-800',
    highlight: darkMode ? 'text-purple-400' : 'text-purple-600',
    secondaryBg: darkMode ? 'bg-gray-700' : 'bg-purple-50',
    border: darkMode ? 'border-gray-700' : 'border-purple-100'
  };

  // Count actual trips based on dropoff locations as a fallback
  const tripCount = trips.length > 0 ? trips.length : route.locations.filter(loc => loc.type === 'dropoff').length;

  return (
    <div className={`rounded-xl overflow-hidden shadow-lg transition-colors duration-300 ${colors.card} ${colors.border} border animate-fadeIn`}>
      <div 
        className={`px-6 py-4 flex justify-between items-center ${expanded ? 'border-b' : ''} ${colors.border} cursor-pointer`}
        onClick={() => setExpanded(!expanded)}
      >
        <h2 className={`text-lg font-semibold ${colors.text} flex items-center`}>
          <MapIcon className={`mr-2 h-5 w-5 ${colors.highlight}`} />
          Route Summary
        </h2>
        <div>
          {expanded ? (
            <ChevronUp className={`h-5 w-5 ${colors.text}`} />
          ) : (
            <ChevronDown className={`h-5 w-5 ${colors.text}`} />
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-6 py-4 space-y-6">
          <div className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium ${
            algorithm === 'reinforcement' 
              ? (darkMode ? 'bg-purple-900 text-purple-200' : 'bg-purple-100 text-purple-800') 
              : (darkMode ? 'bg-pink-900 text-pink-200' : 'bg-pink-100 text-pink-800')
          }`}>
            {algorithm === 'reinforcement' ? 'AI Optimized Route' : 'Standard Optimization'}
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div className={`${colors.secondaryBg} rounded-xl p-4 text-center transition-colors duration-300 shadow-sm border ${colors.border}`}>
              <div className={`h-10 w-10 rounded-full ${darkMode ? 'bg-gray-800' : 'bg-white'} mx-auto mb-2 flex items-center justify-center`}>
                <DollarSign className={`h-6 w-6 ${darkMode ? 'text-green-400' : 'text-green-500'}`} />
              </div>
              <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>Total Revenue</p>
              <p className={`text-xl font-bold ${colors.text}`}>
                ${route.totalRevenue.toFixed(2)}
              </p>
            </div>
            
            <div className={`${colors.secondaryBg} rounded-xl p-4 text-center transition-colors duration-300 shadow-sm border ${colors.border}`}>
              <div className={`h-10 w-10 rounded-full ${darkMode ? 'bg-gray-800' : 'bg-white'} mx-auto mb-2 flex items-center justify-center`}>
                <Clock className={`h-6 w-6 ${darkMode ? 'text-purple-400' : 'text-purple-500'}`} />
              </div>
              <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>Driving Time</p>
              <p className={`text-xl font-bold ${colors.text}`}>
                {route.totalDrivingTime > 0 ? `${route.totalDrivingTime}h` : 'Calculating...'}
              </p>
            </div>
            
            <div className={`${colors.secondaryBg} rounded-xl p-4 text-center transition-colors duration-300 shadow-sm border ${colors.border}`}>
              <div className={`h-10 w-10 rounded-full ${darkMode ? 'bg-gray-800' : 'bg-white'} mx-auto mb-2 flex items-center justify-center`}>
                <Coffee className={`h-6 w-6 ${darkMode ? 'text-amber-400' : 'text-amber-500'}`} />
              </div>
              <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>Break Time</p>
              <p className={`text-lg font-medium ${colors.text}`}>
                {route.breakTime}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className={`font-semibold text-base ${colors.text} flex items-center`}>
                <Car className="mr-2 h-4 w-4" />
                Trip Details ({tripCount})
              </h3>
              <div className="flex items-center space-x-2">
                <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Click trips for details
                </div>
                {trips.length > 0 && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowAllTrips(!showAllTrips);
                    }}
                    className={`text-xs py-1 px-2 rounded ${
                      darkMode ? 'hover:bg-gray-700 bg-gray-800' : 'hover:bg-purple-100 bg-purple-50'
                    } ${colors.text}`}
                  >
                    {showAllTrips ? 'Collapse' : 'Show All'}
                  </button>
                )}
              </div>
            </div>
            
            {tripCount > 0 ? (
              <div className={`space-y-2 max-h-[320px] overflow-auto pr-2 scrollbar-hide`}>
                {trips.map((trip, index) => (
                  <div
                    key={trip.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleTrip(trip.id);
                    }}
                    className={`p-3 rounded-xl cursor-pointer transition-all duration-200 border ${
                      expandedTrip === trip.id || showAllTrips
                        ? (darkMode ? 'bg-gray-700 border-gray-600' : 'bg-purple-50 border-purple-200') 
                        : (darkMode ? 'bg-gray-800 border-gray-700 hover:bg-gray-700' : 'bg-white border-purple-100 hover:bg-purple-50')
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <Clock className={`h-4 w-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                        <span className={`text-sm font-medium ${colors.text}`}>
                          {trip.pickup.time} - {trip.dropoff.time}
                        </span>
                      </div>
                      <span className={`${darkMode ? 'text-green-400' : 'text-green-600'} font-medium flex items-center text-sm`}>
                        ${trip.revenue.toFixed(2)}
                        <TrendingUp className="h-3 w-3 ml-1" />
                      </span>
                    </div>
                    
                    {(expandedTrip === trip.id || showAllTrips) && (
                      <div className="mt-3 grid grid-cols-2 gap-3 text-sm animate-fadeIn">
                        <div className={`p-3 rounded-lg border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-purple-100'}`}>
                          <div className="flex items-center space-x-2 text-xs mb-2">
                            <span className="w-2 h-2 bg-green-500 rounded-full" />
                            <span className={colors.text}>Pick-up</span>
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
                        
                        <div className={`p-3 rounded-lg border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-purple-100'}`}>
                          <div className="flex items-center space-x-2 text-xs mb-2">
                            <span className="w-2 h-2 bg-purple-500 rounded-full" />
                            <span className={colors.text}>Drop-off</span>
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
            ) : (
              <div className={`p-6 flex justify-center items-center ${colors.secondaryBg} rounded-lg text-center`}>
                <p className={`${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  No trips have been completed yet.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}