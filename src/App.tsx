import React, { useState, useEffect } from 'react';
import { Map } from './components/Map';
import { RouteForm } from './components/RouteForm';
import { RouteSummary } from './components/RouteSummary';
import { DropOffSelection } from './components/DropOffSelection';
import { PickupRecommendation } from './components/PickupRecommendation';
import { Route, Location } from './types';
import { Navigation, MoonIcon, SunIcon, MenuIcon, HistoryIcon, UserIcon, BellIcon, MapPin, ArrowLeftCircle, PlusCircle, Coffee } from 'lucide-react';

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

  // Define theme colors based on mode
  const themeColors = darkMode 
    ? { 
        bg: 'bg-gray-900',
        card: 'bg-gray-800',
        text: 'text-gray-100',
        highlight: 'text-purple-400',
        secondaryBg: 'bg-gray-800',
        border: 'border-gray-700'
      }
    : { 
        bg: 'bg-gradient-to-br from-purple-50 to-pink-100',
        card: 'bg-white',
        text: 'text-gray-800',
        highlight: 'text-purple-600',
        secondaryBg: 'bg-purple-50',
        border: 'border-purple-100'
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
          <div className={`absolute left-0 top-0 h-full w-64 ${darkMode ? 'bg-gray-900' : 'bg-white'} shadow-xl transition-transform duration-300 transform`}>
            <div className="p-5">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-full ${darkMode ? 'bg-purple-900' : 'bg-purple-200'}`}>
                    <Navigation className={`h-6 w-6 ${darkMode ? 'text-purple-200' : 'text-purple-600'}`} />
                  </div>
                  <h1 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    RideOptimizer
                  </h1>
                </div>
              </div>
              
              <nav className="space-y-4">
                <a href="#" className={`flex items-center space-x-3 p-3 rounded-lg ${darkMode ? 'hover:bg-gray-800' : 'hover:bg-purple-100'}`}>
                  <UserIcon className={`h-5 w-5 ${themeColors.highlight}`} />
                  <span className={`${themeColors.text}`}>Profile</span>
                </a>
                <a href="#" className={`flex items-center space-x-3 p-3 rounded-lg ${darkMode ? 'hover:bg-gray-800' : 'hover:bg-purple-100'}`}>
                  <HistoryIcon className={`h-5 w-5 ${themeColors.highlight}`} />
                  <span className={`${themeColors.text}`}>History</span>
                </a>
                <a href="#" className={`flex items-center space-x-3 p-3 rounded-lg ${darkMode ? 'hover:bg-gray-800' : 'hover:bg-purple-100'}`}>
                  <BellIcon className={`h-5 w-5 ${themeColors.highlight}`} />
                  <span className={`${themeColors.text}`}>Notifications</span>
                </a>
                
                <div className="pt-4 mt-4 border-t border-gray-200">
                  <button 
                    onClick={toggleDarkMode}
                    className={`flex items-center space-x-3 p-3 rounded-lg w-full text-left ${darkMode ? 'hover:bg-gray-800' : 'hover:bg-purple-100'}`}
                  >
                    {darkMode ? (
                      <>
                        <SunIcon className="h-5 w-5 text-yellow-300" />
                        <span className={`${themeColors.text}`}>Light Mode</span>
                      </>
                    ) : (
                      <>
                        <MoonIcon className="h-5 w-5 text-purple-600" />
                        <span className={`${themeColors.text}`}>Dark Mode</span>
                      </>
                    )}
                  </button>
                </div>
              </nav>
            </div>
          </div>
        </div>
      )}

      <header className={`${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg transition-colors duration-300`}>
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-full ${darkMode ? 'bg-purple-900' : 'bg-purple-200'}`}>
                <Navigation className={`h-6 w-6 ${darkMode ? 'text-purple-200' : 'text-purple-600'}`} />
              </div>
              <h1 className={`text-2xl font-bold tracking-tight ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                RideOptimizer
              </h1>
            </div>
            <div className="flex items-center space-x-2">
              {appMode !== 'form' && (
                <button 
                  onClick={resetApp}
                  className={`text-sm px-3 py-1.5 rounded-full ${darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'}`}
                >
                  New Route
                </button>
              )}
              <button 
                onClick={toggleDarkMode}
                className={`p-2 rounded-full ${darkMode ? 'bg-gray-700 text-yellow-300' : 'bg-purple-100 text-purple-600'}`}
              >
                {darkMode ? <SunIcon size={20} /> : <MoonIcon size={20} />}
              </button>
              <button 
                onClick={toggleMenu}
                className="p-2 rounded-full lg:hidden"
              >
                <MenuIcon size={20} className={darkMode ? 'text-white' : 'text-gray-800'} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {appMode === 'form' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
              <RouteForm 
                onSubmit={handleRouteSubmit} 
                isLoading={loading} 
                darkMode={darkMode}
                themeColors={themeColors} 
              />
              
              {error && (
                <div className={`${darkMode ? 'bg-red-900 border-red-700' : 'bg-red-50 border-red-200'} border text-red-600 px-4 py-3 rounded-lg transition-all duration-300 animate-fadeIn`}>
                  {error}
                </div>
              )}
            </div>
            
            <div className="lg:col-span-2">
              <div className={`${themeColors.card} p-4 rounded-xl shadow-lg transition-colors duration-300 h-[700px]`}>
                <div className="h-full flex flex-col items-center justify-center">
                  <div className={`p-4 rounded-full ${darkMode ? 'bg-gray-700' : 'bg-purple-200'} mb-4 animate-float`}>
                    <Navigation className={`h-12 w-12 ${darkMode ? 'text-purple-300' : 'text-purple-500'}`} />
                  </div>
                  <p className={`text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'} max-w-sm`}>
                    Enter your starting location and time<br />to generate an optimized taxi route
                  </p>
                  <div className={`mt-8 px-6 py-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-purple-50'} max-w-md`}>
                    <h3 className={`font-medium mb-2 ${themeColors.text}`}>Try our AI-powered optimization</h3>
                    <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Select "AI Optimized" algorithm to use our reinforcement learning model for dynamic route planning.
                    </p>
                  </div>
                </div>
              </div>
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
              <div className={`${themeColors.card} p-4 rounded-xl shadow-lg transition-colors duration-300`}>
                <h3 className={`font-medium mb-4 ${themeColors.text}`}>Route Management</h3>
                <div className="flex gap-3">
                  <button
                    onClick={handleNewRoute}
                    className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center ${
                      darkMode ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                    } transition-colors duration-200`}
                  >
                    <PlusCircle className="h-4 w-4 mr-2" />
                    New Route
                  </button>
                  
                  {getCurrentHour(route.locations[route.locations.length - 1].time) < endTime && (
                    <button
                      onClick={handleContinuePlanning}
                      className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center ${
                        darkMode 
                          ? 'bg-purple-600 text-white hover:bg-purple-500' 
                          : 'bg-purple-500 text-white hover:bg-purple-400'
                      } transition-colors duration-200`}
                    >
                      <ArrowLeftCircle className="h-4 w-4 mr-2" />
                      Continue Planning
                    </button>
                  )}
                </div>
                
                {previousRoutes.length > 0 && (
                  <div className="mt-4">
                    <h4 className={`text-sm font-medium mb-2 ${themeColors.text}`}>Previous Routes</h4>
                    <div className="max-h-40 overflow-y-auto pr-2 space-y-2">
                      {previousRoutes.map((prevRoute, index) => (
                        <div 
                          key={index}
                          className={`p-2 rounded-lg cursor-pointer transition-all duration-200 ${
                            darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-purple-50 hover:bg-purple-100'
                          }`}
                          onClick={() => setRoute(prevRoute)}
                        >
                          <div className="flex justify-between items-center">
                            <span className={`text-sm ${themeColors.text}`}>Route {index + 1}</span>
                            <span className={`text-sm ${darkMode ? 'text-green-400' : 'text-green-600'}`}>
                              ${prevRoute.totalRevenue.toFixed(2)}
                            </span>
                          </div>
                          <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
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
              <div className={`${themeColors.card} p-4 rounded-xl shadow-lg transition-colors duration-300 h-[700px]`}>
                <Map locations={route.locations} darkMode={darkMode} themeColors={themeColors} />
              </div>
            </div>
          </div>
        )}

        {appMode === 'drop-off-selection' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
              <div className={`${themeColors.card} p-6 rounded-lg shadow-md transition-colors duration-300 space-y-4`}>
                <h2 className={`text-lg font-semibold ${themeColors.text} flex items-center`}>
                  <MapPin className="mr-2 h-5 w-5" />
                  AI Route Planning
                </h2>
                
                {/* Add break time indicator if in break time */}
                {customRouteLocations.length > 0 && (() => {
                  const lastLocation = customRouteLocations[customRouteLocations.length - 1];
                  const currentHour = getCurrentHour(lastLocation.time);
                  
                  if (currentHour >= breakStartTime && currentHour < breakEndTime) {
                    return (
                      <div className={`rounded-lg p-4 ${darkMode ? 'bg-amber-900' : 'bg-amber-100'} border ${darkMode ? 'border-amber-800' : 'border-amber-200'}`}>
                        <div className="flex items-center">
                          <Coffee className={`h-5 w-5 mr-2 ${darkMode ? 'text-amber-500' : 'text-amber-600'}`} />
                          <span className={`font-medium ${darkMode ? 'text-amber-400' : 'text-amber-700'}`}>
                            Break Time
                          </span>
                        </div>
                        <p className={`text-sm mt-1 ${darkMode ? 'text-amber-300' : 'text-amber-600'}`}>
                          Currently on break until {breakEndTime === 12 ? '12:00 PM' : breakEndTime > 12 ? `${breakEndTime-12}:00 PM` : `${breakEndTime}:00 AM`}.
                          The next trip will be scheduled after your break.
                        </p>
                      </div>
                    );
                  }
                  return null;
                })()}
                
                <div className={`rounded-lg p-4 ${themeColors.secondaryBg} ${themeColors.border} border`}>
                  <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Select potential drop-off locations on the map. Our AI will analyze and recommend the most profitable options.
                  </p>
                </div>
                {customRouteLocations.length > 1 && (
                  <button
                    onClick={handleFinishRoute}
                    className={`w-full py-2 rounded-full ${darkMode ? 'bg-green-700 hover:bg-green-600' : 'bg-green-600 hover:bg-green-500'} text-white transition-colors duration-200`}
                  >
                    Finish Route Planning
                  </button>
                )}
              </div>
            </div>
            
            <div className="lg:col-span-2">
              <div className={`${themeColors.card} rounded-xl shadow-lg transition-colors duration-300 h-[700px]`}>
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
              <div className={`${themeColors.card} p-6 rounded-lg shadow-md transition-colors duration-300 space-y-4`}>
                <h2 className={`text-lg font-semibold ${themeColors.text} flex items-center`}>
                  <Navigation className="mr-2 h-5 w-5" />
                  AI Pickup Recommendations
                </h2>
                
                {/* Add break time indicator if in break time */}
                {customRouteLocations.length > 0 && (() => {
                  const lastLocation = customRouteLocations[customRouteLocations.length - 1];
                  const currentHour = getCurrentHour(lastLocation.time);
                  
                  if (currentHour >= breakStartTime && currentHour < breakEndTime) {
                    return (
                      <div className={`rounded-lg p-4 ${darkMode ? 'bg-amber-900' : 'bg-amber-100'} border ${darkMode ? 'border-amber-800' : 'border-amber-200'}`}>
                        <div className="flex items-center">
                          <Coffee className={`h-5 w-5 mr-2 ${darkMode ? 'text-amber-500' : 'text-amber-600'}`} />
                          <span className={`font-medium ${darkMode ? 'text-amber-400' : 'text-amber-700'}`}>
                            Break Time
                          </span>
                        </div>
                        <p className={`text-sm mt-1 ${darkMode ? 'text-amber-300' : 'text-amber-600'}`}>
                          Currently on break until {breakEndTime === 12 ? '12:00 PM' : breakEndTime > 12 ? `${breakEndTime-12}:00 PM` : `${breakEndTime}:00 AM`}.
                          The next trip will be scheduled after your break.
                        </p>
                      </div>
                    );
                  }
                  return null;
                })()}
                
                <div className={`rounded-lg p-4 ${themeColors.secondaryBg} ${themeColors.border} border`}>
                  <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Based on your drop-off location, our AI is suggesting optimal pickup points that maximize your chances of finding passengers.
                  </p>
                </div>
                <div className={`rounded-lg p-4 ${darkMode ? 'bg-purple-900' : 'bg-purple-100'} border ${darkMode ? 'border-purple-800' : 'border-purple-200'}`}>
                  <p className={`text-sm font-medium ${darkMode ? 'text-purple-200' : 'text-purple-800'}`}>
                    Completed Trips: {(customRouteLocations.filter(loc => loc.type === 'dropoff').length)}
                  </p>
                  <p className={`text-sm ${darkMode ? 'text-purple-300' : 'text-purple-700'} mt-1`}>
                    Total Revenue: ${customRouteLocations
                      .filter(loc => loc.type === 'dropoff')
                      .reduce((sum, loc) => sum + loc.revenue, 0)
                      .toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="lg:col-span-2">
              <div className={`${themeColors.card} rounded-xl shadow-lg transition-colors duration-300 h-[700px]`}>
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
      
      <footer className={`py-4 mt-8 ${darkMode ? 'bg-gray-800 text-gray-400' : 'bg-purple-100 text-gray-600'}`}>
        <div className="max-w-7xl mx-auto px-4 text-center text-sm">
          © {new Date().getFullYear()} RideOptimizer | Optimizing routes for maximum efficiency
        </div>
      </footer>
    </div>
  );
}

export default App;