import { useState, useEffect } from 'react';
import { Route } from '../types';
import { DollarSign, Clock, Coffee, ChevronDown, ChevronUp, TrendingUp, MapIcon, Car } from 'lucide-react';

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
    purpleLight: string;
    purpleMedium: string;
    purpleText: string;
    greenText: string;
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
    bg: 'bg-[#f9f0ff]',
    card: 'bg-white',
    text: 'text-gray-800',
    highlight: 'text-[#9747ff]',
    secondaryBg: 'bg-[#f5f0ff]',
    border: 'border-gray-200',
    purpleLight: 'bg-[#f5f0ff]',
    purpleMedium: 'bg-[#9747ff]',
    purpleText: 'text-[#9747ff]',
    greenText: 'text-[#4caf50]'
  };

  // Count actual trips based on dropoff locations as a fallback
  const tripCount = trips.length > 0 ? trips.length : route.locations.filter(loc => loc.type === 'dropoff').length;

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden animate-fadeIn">
      <div 
        className="px-6 py-4 flex justify-between items-center cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <h2 className="text-lg font-medium text-gray-800 flex items-center">
          <MapIcon className="mr-2 h-5 w-5 text-[#9747ff]" />
          Route Summary
        </h2>
        <div>
          {expanded ? (
            <ChevronUp className="h-5 w-5 text-gray-800" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-800" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-6 py-4 space-y-6">
          <div className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-[#f5f0ff] text-[#9747ff] shadow-lg">
            AI Optimized Route
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            {/* Total Revenue Box */}
            <div className="bg-[#f5f0ff] rounded-lg p-4 text-center">
              <div className="w-12 h-12 rounded-full bg-white mx-auto mb-2 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-[#4caf50]" />
              </div>
              <p className="text-xs text-gray-500 mb-1">Total Revenue</p>
              <p className="text-xl font-bold text-gray-800">
                ${route.totalRevenue.toFixed(2)}
              </p>
            </div>
            
            {/* Driving Time Box */}
            <div className="bg-[#f5f0ff] rounded-lg p-4 text-center">
              <div className="w-12 h-12 rounded-full bg-white mx-auto mb-2 flex items-center justify-center">
                <Clock className="h-6 w-6 text-[#9747ff]" />
              </div>
              <p className="text-xs text-gray-500 mb-1">Driving Time</p>
              <p className="text-xl font-bold text-gray-800">
                {route.totalDrivingTime > 0 ? `${route.totalDrivingTime}h` : 'Calculating...'}
              </p>
            </div>
            
            {/* Break Time Box */}
            <div className="bg-[#f5f0ff] rounded-lg p-4 text-center">
              <div className="w-12 h-12 rounded-full bg-white mx-auto mb-2 flex items-center justify-center">
                <Coffee className="h-6 w-6 text-[#ff9800]" />
              </div>
              <p className="text-xs text-gray-500 mb-1">Break Time</p>
              <p className="text-lg font-medium text-gray-800">
                {route.breakTime}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-base text-gray-800 flex items-center">
                <Car className="mr-2 h-4 w-4" />
                Trip Details ({tripCount})
              </h3>
              <div className="flex items-center space-x-2">
                <div className="text-xs text-gray-500">
                  Click trips for details
                </div>
                {trips.length > 0 && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowAllTrips(!showAllTrips);
                    }}
                    className="text-sm py-1 px-3 rounded-md border border-gray-200 text-gray-600 bg-white"
                  >
                    Show All
                  </button>
                )}
              </div>
            </div>
            
            {tripCount > 0 ? (
              <div className="space-y-2 max-h-[320px] overflow-auto pr-2">
                {trips.map((trip, index) => (
                  <div
                    key={trip.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleTrip(trip.id);
                    }}
                    className="p-3 rounded-lg cursor-pointer transition-all duration-200 bg-[#f5f0ff]"
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <Clock className="h-4 w-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-800">
                          {trip.pickup.time} - {trip.dropoff.time}
                        </span>
                      </div>
                      <span className="text-[#4caf50] font-medium flex items-center text-sm">
                        ${trip.revenue.toFixed(2)}
                        <TrendingUp className="h-3 w-3 ml-1" />
                      </span>
                    </div>
                    
                    {(expandedTrip === trip.id || showAllTrips) && (
                      <div className="mt-3 grid grid-cols-2 gap-3 text-sm animate-fadeIn">
                        <div className="p-3 rounded-lg bg-white">
                          <div className="flex items-center space-x-2 text-xs mb-2">
                            <span className="w-2 h-2 bg-[#4caf50] rounded-full" />
                            <span className="text-gray-800">Pick-up</span>
                          </div>
                          <div className="text-xs text-gray-500 mb-1">
                            Time: {trip.pickup.time}
                          </div>
                          <div className="flex items-center mt-1">
                            <MapIcon className="h-3 w-3 mr-1 text-gray-500" />
                            <span className="text-xs text-gray-500">
                              {trip.pickup.lat.toFixed(4)}, {trip.pickup.lng.toFixed(4)}
                            </span>
                          </div>
                        </div>
                        
                        <div className="p-3 rounded-lg bg-white">
                          <div className="flex items-center space-x-2 text-xs mb-2">
                            <span className="w-2 h-2 bg-[#9747ff] rounded-full" />
                            <span className="text-gray-800">Drop-off</span>
                          </div>
                          <div className="text-xs text-gray-500 mb-1">
                            Time: {trip.dropoff.time}
                          </div>
                          <div className="flex items-center mt-1">
                            <MapIcon className="h-3 w-3 mr-1 text-gray-500" />
                            <span className="text-xs text-gray-500">
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
              <div className="p-6 flex justify-center items-center bg-[#f5f0ff] rounded-lg text-center">
                <p className="text-gray-500">
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