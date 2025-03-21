import React, { useState, useEffect } from 'react';
import { Map } from './components/Map';
import { RouteForm } from './components/RouteForm';
import { RouteSummary } from './components/RouteSummary';
import { DropOffSelection } from './components/DropOffSelection';
import { PickupRecommendation } from './components/PickupRecommendation';
import { Route, Location } from './types';
import { motion } from "framer-motion";
//import { Navigation, MenuIcon } from "lucide-react"; // Ensure correct imports
import { 
  Navigation, 
  MoonIcon, 
  SunIcon, 
  MenuIcon, 
  HistoryIcon, 
  UserIcon, 
  BellIcon, 
  MapPin, 
  ArrowLeftCircle, 
  PlusCircle, 
  Coffee, 
  Send, 
  Clock, 
  DollarSign,
  Car
} from 'lucide-react';

// Add these new types to handle the AI flow
interface DropOffLocation {
  id: number;
  lat: number;
  lng: number;
  label: string;
  score?: number;
  revenue?: number;
  distance?: number;
  duration?: number;
}

interface PickupLocation {
  id: number;
  lat: number;
  lng: number;
  label: string;
  score?: number;
  distance?: number;
  duration?: number;
  prediction?: number;
}

type AppMode = 'form' | 'route' | 'drop-off-selection' | 'pickup-recommendation';

function App() {
  const [route, setRoute] = useState<Route | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<'reinforcement' | 'greedy'>('reinforcement');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [appMode, setAppMode] = useState<AppMode>('form');
  const [currentLocation, setCurrentLocation] = useState({ lat: 1.3521, lng: 103.8198 });
  const [customRouteLocations, setCustomRouteLocations] = useState<Location[]>([]);
  const [selectedDropOff, setSelectedDropOff] = useState<DropOffLocation | null>(null);
  const [nextTripId, setNextTripId] = useState(1);
  const [initialStartTime, setInitialStartTime] = useState<number>(6); // Default start time (6 AM)
  const [endTime, setEndTime] = useState<number>(25); // Default end time (1 AM next day)
  const [previousRoutes, setPreviousRoutes] = useState<Route[]>([]);
  const [canContinuePlanning, setCanContinuePlanning] = useState(false);
  const [breakStartTime, setBreakStartTime] = useState<number>(12); // Default break start time (12 PM)
  const [breakEndTime, setBreakEndTime] = useState<number>(13); // Default break end time (1 PM)
  const [isBreakTime, setIsBreakTime] = useState<boolean>(false);

  // Function to get current hour for time calculations
  const getCurrentHour = (timeStr: string): number => {
    const [time, period] = timeStr.split(' ');
    let [hour, minute] = time.split(':').map(Number);
    if (period === 'PM' && hour !== 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    return hour;
  };

  // Helper function to convert time string to minutes
  const timeStringToMinutes = (timeString: string): number => {
    const [time, period] = timeString.split(' ');
    const [hour, minute] = time.split(':').map(Number);
    
    let totalMinutes = (hour % 12) * 60 + minute;
    if (period === 'PM' && hour !== 12) totalMinutes += 12 * 60;
    if (period === 'AM' && hour === 12) totalMinutes = minute; // 12 AM is 0 hours
    
    return totalMinutes;
  };

  // Helper function to convert minutes to time string
  const minutesToTimeString = (totalMinutes: number): string => {
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    const period = hours >= 12 ? 'PM' : 'AM';
    const formattedHour = hours % 12 || 12;
    
    return `${formattedHour}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  // Helper function to check if a time is during break
  const isDuringBreak = (timeString: string): boolean => {
    const minutes = timeStringToMinutes(timeString);
    const hour = Math.floor(minutes / 60);
    return hour >= breakStartTime && hour < breakEndTime;
  };

  // Helper function to get time after break if the given time is during break
  const getTimeAfterBreak = (timeString: string): string => {
    if (!isDuringBreak(timeString)) return timeString;
    
    return minutesToTimeString(breakEndTime * 60);
  };

  const handleRouteSubmit = async (data: { 
    lat: number; 
    lng: number; 
    startTime: number; 
    endTime: number; 
    algorithm: 'reinforcement' | 'greedy';
    breakStartTime: number;
    breakEndTime: number;
  }) => {
    try {
      setLoading(true);
      setError(null);
      setSelectedAlgorithm(data.algorithm);
      setCurrentLocation({ lat: data.lat, lng: data.lng });
      setInitialStartTime(data.startTime);
      setEndTime(data.endTime);
      setBreakStartTime(data.breakStartTime);
      setBreakEndTime(data.breakEndTime);
      
      // If user chooses AI optimization (reinforcement learning)
      if (data.algorithm === 'reinforcement') {
        // Start the AI-guided flow instead of fetching a complete route
        setCustomRouteLocations([{
          lat: data.lat,
          lng: data.lng,
          type: 'pickup',
          time: formatTime(data.startTime, 0),
          revenue: 0,
          tripId: 0 // Initial location
        }]);
        
        setLoading(false);
        setAppMode('drop-off-selection');
        setCanContinuePlanning(true);
      } else {
        // Traditional approach - fetch full route from backend
        const response = await fetch('http://localhost:3001/api/optimize-route', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            startLocation: {
              lat: data.lat,
              lng: data.lng
            },
            startTime: data.startTime,
            endTime: data.endTime,
            algorithm: data.algorithm,
            breakStartTime: data.breakStartTime,
            breakEndTime: data.breakEndTime
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to generate route');
        }

        const optimizedRoute = await response.json();
        setRoute(optimizedRoute);
        setAppMode('route');
        setLoading(false);
        setCanContinuePlanning(false);
      }
    } catch (err) {
      setError('Failed to generate route. Please try again.');
      console.error('Error generating route:', err);
      setLoading(false);
    }
  };

  const handleDropOffSelected = (location: DropOffLocation) => {
    setSelectedDropOff(location);
    
    // Add the drop-off to our custom route
    const lastLocation = customRouteLocations[customRouteLocations.length - 1];
    const currentTripId = nextTripId;
    
    // Calculate estimated time for the drop-off
    let estimatedMinutes = timeStringToMinutes(lastLocation.time) + Math.ceil((location.duration || 300) / 60);
    
    // Check if drop-off time falls within break time
    const estimatedHour = Math.floor(estimatedMinutes / 60);
    
    if (estimatedHour >= breakStartTime && estimatedHour < breakEndTime) {
      // Adjust time to after break
      estimatedMinutes = breakEndTime * 60;
    }
    
    // Create the time string
    const dropOffTime = minutesToTimeString(estimatedMinutes);
    
    // Add selected drop-off
    const newDropOff: Location = {
      lat: location.lat,
      lng: location.lng,
      type: 'dropoff',
      time: dropOffTime,
      revenue: location.revenue || 0,
      tripId: currentTripId
    };
    
    setCustomRouteLocations([...customRouteLocations, newDropOff]);
    setNextTripId(currentTripId + 1);
    
    // Move to pickup recommendation mode
    setCurrentLocation({ lat: location.lat, lng: location.lng });
    setAppMode('pickup-recommendation');
  };

  const handlePickupSelected = (location: PickupLocation) => {
    // Add the new pickup location to our custom route
    const lastLocation = customRouteLocations[customRouteLocations.length - 1];
    
    // Calculate time to pickup location
    let estimatedMinutes = timeStringToMinutes(lastLocation.time) + Math.ceil((location.duration || 300) / 60);
    
    // Check if time falls within break time
    const estimatedHour = Math.floor(estimatedMinutes / 60);
    
    if (estimatedHour >= breakStartTime && estimatedHour < breakEndTime) {
      // Skip to end of break
      estimatedMinutes = breakEndTime * 60;
    }
    
    // Create the time string
    const pickupTime = minutesToTimeString(estimatedMinutes);
    
    const newPickup: Location = {
      lat: location.lat,
      lng: location.lng,
      type: 'pickup',
      time: pickupTime,
      revenue: 0,
      tripId: nextTripId
    };
    
    setCustomRouteLocations([...customRouteLocations, newPickup]);
    setCurrentLocation({ lat: location.lat, lng: location.lng });
    
    // Check if we've reached the end time
    const currentHour = getCurrentHour(pickupTime);
    if (currentHour >= endTime) {
      handleFinishRoute();
    } else {
      // Go back to drop-off selection for the next leg
      setAppMode('drop-off-selection');
    }
  };

  const handleFinishRoute = () => {
    // Calculate total revenue and driving time
    const totalRevenue = customRouteLocations
      .filter(loc => loc.type === 'dropoff')
      .reduce((sum, loc) => sum + loc.revenue, 0);
    
    // Calculate driving time from first to last location
    const firstTime = timeStringToMinutes(customRouteLocations[0].time);
    const lastTime = timeStringToMinutes(customRouteLocations[customRouteLocations.length - 1].time);
    const totalDrivingTime = Math.round((lastTime - firstTime) / 60 * 10) / 10; // Convert minutes to hours with 1 decimal
    
    // Create a complete route object
    const completeRoute: Route = {
      locations: [...customRouteLocations],
      totalRevenue,
      totalDrivingTime,
      breakTime: `${formatTime(breakStartTime, 0)} - ${formatTime(breakEndTime, 0)}`
    };
    
    // Save the current route to previous routes
    setPreviousRoutes(prev => [...prev, completeRoute]);
    
    setRoute(completeRoute);
    setAppMode('route');
  };

  const handleContinuePlanning = () => {
    // Resume planning from the last location
    if (route && route.locations.length > 0) {
      const lastLocation = route.locations[route.locations.length - 1];
      setCurrentLocation({ lat: lastLocation.lat, lng: lastLocation.lng });
      
      // Check if we need to reset the custom route locations
      if (customRouteLocations.length === 0) {
        setCustomRouteLocations(route.locations);
      }
      
      // Determine next mode based on the last location type
      if (lastLocation.type === 'pickup') {
        setAppMode('drop-off-selection');
      } else {
        setAppMode('pickup-recommendation');
      }
    }
  };

  const handleNewRoute = () => {
    // Start a completely new route
    setRoute(null);
    setCustomRouteLocations([]);
    setSelectedDropOff(null);
    setNextTripId(1);
    setAppMode('form');
    setCanContinuePlanning(false);
    
    // Clear previous routes - this is the key addition
    setPreviousRoutes([]);
    
    // Also reset to default location if needed
    setCurrentLocation({ lat: 1.3521, lng: 103.8198 });
    
    // Reset time settings to defaults
    setInitialStartTime(6); // Default start time (6 AM)
    setEndTime(25); // Default end time (1 AM next day)
    setBreakStartTime(12); // Reset break time
    setBreakEndTime(13);
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const resetApp = () => {
    setRoute(null);
    setCustomRouteLocations([]);
    setSelectedDropOff(null);
    setNextTripId(1);
    setAppMode('form');
    setCanContinuePlanning(false);
    
    // Clear previous routes
    setPreviousRoutes([]);
    
    // Reset to default location
    setCurrentLocation({ lat: 1.3521, lng: 103.8198 });
    
    // Reset time settings to defaults
    setInitialStartTime(6);
    setEndTime(25);
    setBreakStartTime(12);
    setBreakEndTime(13);
  };

  // Helper function to format time
  const formatTime = (hour: number, minutes: number): string => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const formattedHour = hour % 12 || 12;
    return `${formattedHour}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  // Helper function to add minutes to a time string
  const addMinutesToTime = (timeString: string, minutesToAdd: number): string => {
    const [time, period] = timeString.split(' ');
    const [hour, minute] = time.split(':').map(Number);
    
    let totalMinutes = (hour % 12) * 60 + minute;
    if (period === 'PM' && hour !== 12) totalMinutes += 12 * 60;
    
    totalMinutes += minutesToAdd;
    
    // Check if the resulting time is during break hours
    const resultHour = Math.floor(totalMinutes / 60);
    if (resultHour >= breakStartTime && resultHour < breakEndTime) {
      // Skip to end of break
      totalMinutes = breakEndTime * 60;
    }
    
    const newHour = Math.floor(totalMinutes / 60) % 24;
    const newMinute = totalMinutes % 60;
    const newPeriod = newHour >= 12 ? 'PM' : 'AM';
    const formattedHour = newHour % 12 || 12;
    
    return `${formattedHour}:${newMinute.toString().padStart(2, '0')} ${newPeriod}`;
  };

  // Create a helper function to get formatted break time string
  const getFormattedBreakTime = (): string => {
    const formatHour = (hour: number) => {
      if (hour === 0 || hour === 24) return '12:00 AM';
      if (hour === 12) return '12:00 PM';
      if (hour > 12) return `${hour - 12}:00 PM`;
      return `${hour}:00 AM`;
    };
    
    return `${formatHour(breakStartTime)} - ${formatHour(breakEndTime)}`;
  };

  // Add effect to check if current time is during break
  useEffect(() => {
    if (customRouteLocations.length > 0) {
      const lastLocation = customRouteLocations[customRouteLocations.length - 1];
      const currentHour = getCurrentHour(lastLocation.time);
      
      // Set flag for whether we're in break time
      setIsBreakTime(currentHour >= breakStartTime && currentHour < breakEndTime);
    }
  }, [customRouteLocations, breakStartTime, breakEndTime]);

  // Define theme colors based on mode - Updated to exactly match screenshots
  const themeColors = { 
    bg: 'bg-[#f9f0ff]', // Light purple background
    card: 'bg-white',
    text: 'text-gray-800',
    highlight: 'text-purple-600',
    secondaryBg: 'bg-[#f5f0ff]', // Lighter purple for secondary elements
    border: 'border-gray-200',
    purpleLight: 'bg-[#f5f0ff]', // Very light purple for cards
    purpleMedium: 'bg-[#9747ff]', // Medium purple for buttons
    purpleText: 'text-[#9747ff]', // Purple text color
    greenText: 'text-[#4caf50]' // Green text for revenue
  };

  // Check if user can continue route planning based on time
  useEffect(() => {
    if (route && route.locations.length > 0) {
      const lastLocation = route.locations[route.locations.length - 1];
      const currentHour = getCurrentHour(lastLocation.time);
      setCanContinuePlanning(currentHour < endTime);
    }
  }, [route, endTime]);

  return (
    <div className={`min-h-screen transition-colors duration-300 ${themeColors.bg}`}>
      {/* Mobile Menu Overlay */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div 
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={toggleMenu}
          ></div>
          <div className="absolute left-0 top-0 h-full w-64 bg-white border-r border-gray-200 transition-transform duration-300 transform">
            <div className="p-5">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-full bg-[#f5f0ff]">
                    <Navigation className="h-6 w-6 text-[#9747ff]" />
                  </div>
                  <h1 className="text-xl font-medium text-gray-900">
                    RideOptimizer
                  </h1>
                </div>
              </div>
              
              <nav className="space-y-2">
                <a href="#" className="flex items-center space-x-3 p-3 rounded-lg hover:bg-[#f5f0ff]">
                  <UserIcon className="h-5 w-5 text-gray-600" />
                  <span className="text-gray-800">Profile</span>
                </a>
                <a href="#" className="flex items-center space-x-3 p-3 rounded-lg hover:bg-[#f5f0ff]">
                  <HistoryIcon className="h-5 w-5 text-gray-600" />
                  <span className="text-gray-800">History</span>
                </a>
                <a href="#" className="flex items-center space-x-3 p-3 rounded-lg hover:bg-[#f5f0ff]">
                  <BellIcon className="h-5 w-5 text-gray-600" />
                  <span className="text-gray-800">Notifications</span>
                </a>
                
                <div className="pt-4 mt-4 border-t border-gray-200">
                  <button 
                    onClick={toggleDarkMode}
                    className="flex items-center space-x-3 p-3 rounded-lg w-full text-left hover:bg-[#f5f0ff]"
                  >
                    <MoonIcon className="h-5 w-5 text-gray-600" />
                    <span className="text-gray-800">Dark Mode</span>
                  </button>
                </div>
              </nav>
            </div>
          </div>
        </div>
      )}

<header className="bg-white border-b border-gray-200 transition-colors duration-300">
  <div className="max-w-7xl mx-auto px-7 py-5 sm:px-6 lg:px-8">
    <div className="flex items-center justify-between">
      
      {/* Left Section */}
      <div className="flex items-center space-x-3">
        
        {/* Navigation Icon with Background */}
        <div className="p-2 rounded-full bg-[#F5EFFF]">
          <Navigation className="h-6 w-6 text-[#9747FF]" />
        </div>

        {/* Text */}
        <h1 className="text-4xl font-bold text-[#29044D]">
          RideOptimizer
        </h1>

      </div>

      {/* Right Section */}
      <div className="flex items-center space-x-2">
        {appMode !== "form" && (
          <button 
            onClick={resetApp}
            className="text-sm px-4 py-1.5 rounded-full border bg-purple-100 text-purple-800 hover:bg-purple-200"
          >
            New Route
          </button>
        )}
        
        {/* Menu Button */}
        <button 
          onClick={toggleMenu}
          className="p-2 rounded-full border border-purple-100 lg:hidden"
        >
          <Navigation size={18} className="text-gray-800" />
        </button>
      </div>

    </div>
  </div>
</header>


      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {appMode === 'form' && (
          <div className="flex flex-col items-center justify-center">
            <div className="w-full max-w-2xl">
              <RouteForm 
                onSubmit={handleRouteSubmit} 
                isLoading={loading} 
                darkMode={darkMode}
                themeColors={themeColors} 
              />
              
              {error && (
                <div className="mt-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg transition-all duration-300 animate-fadeIn">
                  {error}
                </div>
              )}
            </div>
          </div>
        )}

        {appMode === 'route' && route && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
              <RouteSummary 
                route={{...route, breakTime: getFormattedBreakTime()}} 
                darkMode={darkMode} 
                algorithm={selectedAlgorithm} 
                themeColors={themeColors} 
              />
              
              {/* Route Management Controls */}
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <h3 className="font-medium mb-4 text-gray-800">Route Management</h3>
                <div className="flex gap-3">
                  <button
                    onClick={handleNewRoute}
                    className="flex-1 py-2 px-3 rounded-lg flex items-center justify-center bg-[#f5f0ff] text-[#9747ff] transition-colors duration-200"
                  >
                    <PlusCircle className="h-4 w-4 mr-2" />
                    New Route
                  </button>
                  
                  {getCurrentHour(route.locations[route.locations.length - 1].time) < endTime && (
                    <button
                      onClick={handleContinuePlanning}
                      className="flex-1 py-2 px-3 rounded-lg flex items-center justify-center bg-[#9747ff] text-white transition-colors duration-200"
                    >
                      <ArrowLeftCircle className="h-4 w-4 mr-2" />
                      Continue Planning
                    </button>
                  )}
                </div>
                
                {previousRoutes.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium mb-2 text-gray-800">Previous Routes</h4>
                    <div className="max-h-40 overflow-y-auto pr-2 space-y-2">
                      {previousRoutes.map((prevRoute, index) => (
                        <div 
                          key={index}
                          className="p-2 rounded-lg cursor-pointer transition-all duration-200 bg-[#f5f0ff] hover:bg-[#ebe5f9]"
                          onClick={() => setRoute(prevRoute)}
                        >
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-800">Route {index + 1}</span>
                            <span className="text-sm text-[#4caf50]">
                              ${prevRoute.totalRevenue.toFixed(2)}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500">
                            {prevRoute.locations.length} locations • {prevRoute.totalDrivingTime}h
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="lg:col-span-2">
              <div className="bg-white p-4 rounded-lg shadow-sm h-[700px]">
                <Map locations={route.locations} darkMode={darkMode} themeColors={themeColors} />
              </div>
            </div>
          </div>
        )}

        {appMode === 'drop-off-selection' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <h2 className="text-lg font-medium text-gray-800 flex items-center">
                  <MapPin className="mr-2 h-5 w-5" />
                  AI Route Planning
                </h2>
                
                {/* Break time indicator if in break time */}
                {customRouteLocations.length > 0 && (() => {
                  const lastLocation = customRouteLocations[customRouteLocations.length - 1];
                  const currentHour = getCurrentHour(lastLocation.time);
                  
                  if (currentHour >= breakStartTime && currentHour < breakEndTime) {
                    return (
                      <div className="mt-4 rounded-lg p-4 bg-amber-100 border border-amber-200">
                        <div className="flex items-center">
                          <Coffee className="h-5 w-5 mr-2 text-amber-600" />
                          <span className="font-medium text-amber-700">
                            Break Time
                          </span>
                        </div>
                        <p className="text-sm mt-1 text-amber-600">
                          Currently on break until {breakEndTime === 12 ? '12:00 PM' : breakEndTime > 12 ? `${breakEndTime-12}:00 PM` : `${breakEndTime}:00 AM`}.
                          The next trip will be scheduled after your break.
                        </p>
                      </div>
                    );
                  }
                  return null;
                })()}
                
                <div className="mt-4 rounded-lg p-4 bg-[#f5f0ff]">
                  <p className="text-sm text-gray-700">
                    Select potential drop-off locations on the map. Our AI will analyze and recommend the most profitable options.
                  </p>
                </div>
                {customRouteLocations.length > 1 && (
                  <button
                    onClick={handleFinishRoute}
                    className="w-full py-2 mt-4 rounded-full bg-[#4caf50] text-white transition-colors duration-200"
                  >
                    Finish Route Planning
                  </button>
                )}
              </div>
            </div>
            
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow-sm h-[700px]">
                <DropOffSelection 
                  darkMode={darkMode} 
                  currentLocation={currentLocation}
                  onDropOffSelected={handleDropOffSelected}
                  onCancel={resetApp}
                  themeColors={themeColors}
                  currentTime={customRouteLocations.length > 0 ? customRouteLocations[customRouteLocations.length - 1].time : undefined}
                  breakStartTime={breakStartTime}
                  breakEndTime={breakEndTime}
                />
              </div>
            </div>
          </div>
        )}

        {appMode === 'pickup-recommendation' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <h2 className="text-lg font-medium text-gray-800 flex items-center">
                  <Send className="mr-2 h-5 w-5 transform rotate-45" />
                  AI Pickup Recommendations
                </h2>
                
                {/* Break time indicator if in break time */}
                {customRouteLocations.length > 0 && (() => {
                  const lastLocation = customRouteLocations[customRouteLocations.length - 1];
                  const currentHour = getCurrentHour(lastLocation.time);
                  
                  if (currentHour >= breakStartTime && currentHour < breakEndTime) {
                    return (
                      <div className="mt-4 rounded-lg p-4 bg-amber-100 border border-amber-200">
                        <div className="flex items-center">
                          <Coffee className="h-5 w-5 mr-2 text-amber-600" />
                          <span className="font-medium text-amber-700">
                            Break Time
                          </span>
                        </div>
                        <p className="text-sm mt-1 text-amber-600">
                          Currently on break until {breakEndTime === 12 ? '12:00 PM' : breakEndTime > 12 ? `${breakEndTime-12}:00 PM` : `${breakEndTime}:00 AM`}.
                          The next trip will be scheduled after your break.
                        </p>
                      </div>
                    );
                  }
                  return null;
                })()}<div className="mt-4 rounded-lg p-4 bg-[#f5f0ff]">
                <p className="text-sm text-gray-700">
                  Based on your drop-off location, our AI is suggesting optimal pickup points that maximize your chances of finding passengers.
                </p>
              </div>
              <div className="mt-4 rounded-lg p-4 bg-[#f5f0ff]">
                <p className="text-sm font-medium text-gray-700">
                  Completed Trips: {(customRouteLocations.filter(loc => loc.type === 'dropoff').length)}
                </p>
                <p className="text-sm text-[#9747ff] mt-1">
                  Total Revenue: ${customRouteLocations
                    .filter(loc => loc.type === 'dropoff')
                    .reduce((sum, loc) => sum + loc.revenue, 0)
                    .toFixed(2)}
                </p>
              </div>
            </div>
          </div>
          
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm h-[700px]">
              <PickupRecommendation 
                darkMode={darkMode} 
                currentLocation={currentLocation}
                onPickupSelected={handlePickupSelected}
                onCancel={resetApp}
                themeColors={themeColors}
              />
            </div>
          </div>
        </div>
      )}
    </main>
    
    <footer className="py-4 mt-8 bg-white text-gray-600 border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-4 text-center text-sm">
        © {new Date().getFullYear()} RideOptimizer | Optimizing routes for maximum efficiency
      </div>
    </footer>
  </div>
);
}

export default App;