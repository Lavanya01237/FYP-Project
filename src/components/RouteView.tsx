import React, { useState, useEffect } from 'react';
import { Map } from './Map';
import { Route, Location } from '../types';
import { Navigation, ArrowLeft, TrendingUp, Clock, DollarSign } from 'lucide-react';


interface RouteViewProps {
  route: Route | null;
  currentLocations: Location[];
  darkMode?: boolean;
  onBack: () => void;
  themeColors?: {
    bg: string;
    card: string;
    text: string;
    highlight: string;
    secondaryBg: string;
    border: string;
  };
}

// Make TripDetail accept null values
interface TripDetail {
    tripId: number;
    pickup: Location;
    dropoff: Location;
    revenue: number;
  }
  

export function RouteView({ route, currentLocations, darkMode = false, onBack, themeColors }: RouteViewProps) {
  const [combinedLocations, setCombinedLocations] = useState<Location[]>([]);
  
  const colors = themeColors || {
    bg: darkMode ? 'bg-gray-900' : 'bg-purple-50',
    card: darkMode ? 'bg-gray-800' : 'bg-white',
    text: darkMode ? 'text-gray-200' : 'text-gray-800',
    highlight: darkMode ? 'text-purple-400' : 'text-purple-600',
    secondaryBg: darkMode ? 'bg-gray-700' : 'bg-purple-50',
    border: darkMode ? 'border-gray-700' : 'border-purple-100'
  };
  
  // Combine locations from both route object and current locations
  useEffect(() => {
    const allLocations: Location[] = [];
    
    // Add locations from the route if it exists
    if (route && route.locations) {
      allLocations.push(...route.locations);
    }
    
    // Add current locations if not already in the route
    currentLocations.forEach(loc => {
      // Check if this location is already in the route
      const exists = allLocations.some(
        existingLoc => 
          existingLoc.lat === loc.lat && 
          existingLoc.lng === loc.lng && 
          existingLoc.tripId === loc.tripId
      );
      
      if (!exists) {
        allLocations.push(loc);
      }
    });
    
    setCombinedLocations(allLocations);
  }, [route, currentLocations]);
  
  // Calculate total revenue from all locations
  const totalRevenue = combinedLocations
    .filter(loc => loc.type === 'dropoff')
    .reduce((sum, loc) => sum + loc.revenue, 0);
  
  // Calculate total trips
  const tripIds = combinedLocations
    .filter(loc => loc.type === 'dropoff')
    .map(loc => loc.tripId);
  
  const uniqueTripIds = [...new Set(tripIds)];
  const totalTrips = uniqueTripIds.length;
  
  // Generate detailed trip list
  const trips = uniqueTripIds.map(tripId => {
    const pickup = combinedLocations.find(
      loc => loc.tripId === tripId && loc.type === 'pickup'
    );
    const dropoff = combinedLocations.find(
      loc => loc.tripId === tripId && loc.type === 'dropoff'
    );
    
    if (pickup && dropoff) {
      return {
        tripId,
        pickup,
        dropoff,
        revenue: dropoff.revenue
      };
    }
    return null;
  }).filter(Boolean);
  
  return (
    <div className="flex flex-col h-full">
      <div className={`p-4 ${colors.card} border-b ${colors.border}`}>
        <div className="flex justify-between items-center mb-4">
          <h2 className={`text-lg font-semibold ${colors.text} flex items-center`}>
            <Navigation className={`mr-2 h-5 w-5 ${colors.highlight}`} />
            Complete Route View
          </h2>
          <button
            onClick={onBack}
            className={`p-2 rounded-full ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-purple-100 hover:bg-purple-200'} transition-colors duration-200`}
          >
            <ArrowLeft size={20} className={colors.text} />
          </button>
        </div>
        
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className={`${colors.secondaryBg} p-3 rounded-lg flex flex-col items-center justify-center`}>
            <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total Revenue</p>
            <div className="flex items-center mt-1">
              <DollarSign className={`h-4 w-4 mr-1 ${darkMode ? 'text-green-400' : 'text-green-600'}`} />
              <p className={`text-lg font-semibold ${colors.text}`}>{totalRevenue.toFixed(2)}</p>
            </div>
          </div>
          
          <div className={`${colors.secondaryBg} p-3 rounded-lg flex flex-col items-center justify-center`}>
            <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total Trips</p>
            <div className="flex items-center mt-1">
              <TrendingUp className={`h-4 w-4 mr-1 ${colors.highlight}`} />
              <p className={`text-lg font-semibold ${colors.text}`}>{totalTrips}</p>
            </div>
          </div>
          
          <div className={`${colors.secondaryBg} p-3 rounded-lg flex flex-col items-center justify-center`}>
            <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Driving Time</p>
            <div className="flex items-center mt-1">
              <Clock className={`h-4 w-4 mr-1 ${colors.highlight}`} />
              <p className={`text-lg font-semibold ${colors.text}`}>
                {route?.totalDrivingTime || "—"}h
              </p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex-1 relative">
        <Map 
          locations={combinedLocations}
          darkMode={darkMode}
          themeColors={themeColors}
        />
      </div>
      
      {trips.length > 0 && (
    <div className={`p-3 ${colors.card} border-t ${colors.border}`}>
    <h3 className={`text-sm font-medium mb-2 ${colors.text}`}>Trip Details</h3>
    <div className="max-h-32 overflow-y-auto">
      {trips.map((trip) => {
        // Skip any null trips
        if (!trip) return null;
        
        return (
          <div key={trip.tripId} className={`text-xs p-2 mb-1 rounded ${colors.secondaryBg} ${colors.border} border`}>
            <div className="flex justify-between">
              <div>
                <span className="inline-block w-2 h-2 rounded-full bg-yellow-400 mr-1"></span>
                {trip.pickup.time}
              </div>
              <div>
                <span className="inline-block w-2 h-2 rounded-full bg-purple-400 mr-1"></span>
                {trip.dropoff.time}
              </div>
              <div className={darkMode ? 'text-green-400' : 'text-green-600'}>
                ${trip.revenue.toFixed(2)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  </div>
)}
    </div>
  );
}