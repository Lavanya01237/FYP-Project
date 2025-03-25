import { useState, useEffect } from 'react';
import { Clock, MapPin, Locate, Calendar, Settings, Coffee } from 'lucide-react';

interface RouteFormProps {
  onSubmit: (data: { 
    lat: number; 
    lng: number; 
    startTime: number; 
    endTime: number; 
    algorithm: 'reinforcement' | 'greedy';
    breakStartTime: number;
    breakEndTime: number;
  }) => void;
  isLoading?: boolean;
  darkMode?: boolean;
  themeColors?: {
    bg: string;
    card: string;
    text: string;
    highlight: string;
    secondaryBg: string;
    border: string;
  };
}

export function RouteForm({ onSubmit, isLoading, darkMode = false, themeColors }: RouteFormProps) {
  const [lat, setLat] = useState<number>(1.3521);
  const [lng, setLng] = useState<number>(103.8198);
  const [startTime, setStartTime] = useState<number>(6); // Changed default to 6 AM
  const [endTime, setEndTime] = useState<number>(25); // Default end time to 1 AM next day (25)
  const [algorithm, setAlgorithm] = useState<'reinforcement' | 'greedy'>('reinforcement');
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [expanded, setExpanded] = useState<boolean>(true);
  const [breakTimeExpanded, setBreakTimeExpanded] = useState<boolean>(false);
  const [breakStartTime, setBreakStartTime] = useState<number>(12); // Default break start time 12 PM
  const [breakEndTime, setBreakEndTime] = useState<number>(13); // Default break end time 1 PM
  const [customBreak, setCustomBreak] = useState<boolean>(false);

  // Effect to ensure break time is within shift hours
  useEffect(() => {
    if (breakStartTime < startTime) {
      setBreakStartTime(startTime);
    }
    if (breakEndTime > endTime) {
      setBreakEndTime(endTime);
    }
    if (breakStartTime >= breakEndTime) {
      setBreakEndTime(breakStartTime + 1);
    }
  }, [startTime, endTime, breakStartTime, breakEndTime]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ lat, lng, startTime, endTime, algorithm, breakStartTime, breakEndTime });
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }
    
    setIsGettingLocation(true);
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLat(position.coords.latitude);
        setLng(position.coords.longitude);
        setIsGettingLocation(false);
      },
      (error) => {
        console.error('Error getting location:', error);
        alert('Unable to retrieve your location');
        setIsGettingLocation(false);
      },
      { enableHighAccuracy: true }
    );
  };

  // Default break times
  const defaultBreakOptions = [
    { label: 'Lunch (12 PM - 1 PM)', startTime: 12, endTime: 13 },
    { label: 'Early Lunch (11 AM - 12 PM)', startTime: 11, endTime: 12 },
    { label: 'Late Lunch (1 PM - 2 PM)', startTime: 13, endTime: 14 },
    { label: 'Dinner (6 PM - 7 PM)', startTime: 18, endTime: 19 }
  ];

  // Popular Singapore locations
  const popularLocations = [
    { name: 'Downtown Core', lat: 1.2789, lng: 103.8536 },
    { name: 'Orchard', lat: 1.3006, lng: 103.8368 },
    { name: 'Changi Airport', lat: 1.3644, lng: 103.9915 },
    { name: 'Jurong East', lat: 1.3162, lng: 103.7649 },
    { name: 'Woodlands', lat: 1.4019, lng: 103.7855 }
  ];

  const colors = themeColors || {
    bg: darkMode ? 'bg-gray-900' : 'bg-purple-50',
    card: darkMode ? 'bg-gray-800' : 'bg-white',
    text: darkMode ? 'text-gray-200' : 'text-gray-800',
    highlight: darkMode ? 'text-purple-400' : 'text-purple-600',
    secondaryBg: darkMode ? 'bg-gray-700' : 'bg-purple-100',
    border: darkMode ? 'border-gray-700' : 'border-purple-100'
  };

  // Helper function to format time
  const formatTimeDisplay = (hour: number): string => {
    if (hour === 12) return '12 PM';
    if (hour === 24) return '12 AM (next day)';
    if (hour === 0) return '12 AM';
    if (hour > 24) return `${hour - 24} AM (next day)`;
    if (hour > 12) return `${hour - 12} PM`;
    return `${hour} AM`;
  };

  return (
    <div className={`rounded-l overflow-hidden transition-all duration-300 ${colors.card} ${colors.border} border shadow-xl`}>
      <div 
        className={`px-6 py-5 flex justify-between items-center ${expanded ? 'border-b' : ''} ${colors.border} cursor-pointer bg-[#F5F0FF]`}
        onClick={() => setExpanded(!expanded)}
      >
        <h2 className={`font-sans text-2xl font-bold ${colors.text} flex items-center`}>
          <MapPin className={`mr-3 h-6 w-6 ${colors.highlight}`} />
          Plan Your Route
        </h2>
        <div className={`transform transition-transform ${expanded ? 'rotate-180' : ''}`}>
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="20" 
            height="20" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            className={colors.text}
          >
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
      </div>

      {expanded && (
        <form onSubmit={handleSubmit} className="px-7 py-6 space-y-7">
          <div className="space-y-5">
            <div>
              <label className={`block font-sans text-base font-bold mb-2 ${colors.text}`}>
                Starting Location
              </label>
              <div className="relative">
                <div className={`absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none`}>
                  <MapPin className={`h-5 w-5 ${darkMode ? 'text-gray-500' : 'text-purple-400'}`} />
                </div>
                <input
                  id="startLocationInput"
                  type="text"
                  placeholder="Enter location or coordinates"
                  className={`pl-12 w-full rounded-full h-14 border ${
                    darkMode 
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                      : 'bg-white border-purple-200 text-gray-900 placeholder-gray-400'
                  } px-4 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors duration-200 text-base`}
                  value={`${lat.toFixed(4)}, ${lng.toFixed(4)}`}
                  onChange={(e) => {
                    const parts = e.target.value.split(',');
                    if (parts.length === 2) {
                      const newLat = parseFloat(parts[0].trim());
                      const newLng = parseFloat(parts[1].trim());
                      if (!isNaN(newLat) && !isNaN(newLng)) {
                        setLat(newLat);
                        setLng(newLng);
                      }
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={getCurrentLocation}
                  disabled={isGettingLocation}
                  className={`absolute inset-y-0 right-0 flex items-center pr-4 ${
                    isGettingLocation ? 'opacity-50' : 'hover:text-purple-500'
                  } transition-colors duration-200`}
                  title="Use my current location"
                >
                  <Locate size={20} className={`${darkMode ? 'text-purple-400' : 'text-purple-600'} ${isGettingLocation ? 'animate-pulse' : ''}`} />
                </button>
              </div>
            </div>

            <div>
              <label className={`block font-sans text-base font-bold  mb-2 ${colors.text}`}>
                Popular Locations
              </label>
              <div className="flex flex-wrap gap-2.5">
                {popularLocations.map((location, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => {
                      setLat(location.lat);
                      setLng(location.lng);
                    }}
                    className={`text-sm py-2 px-4 rounded-full ${
                      darkMode 
                        ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                        : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                    } transition-colors duration-200 font-medium`}
                  >
                    {location.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className={`block font-sans text-base font-bold  mb-2 ${colors.text}`}>
                  Start Time
                </label>
                <div className="relative">
                  <div className={`absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none`}>
                    <Clock className={`h-5 w-5 ${darkMode ? 'text-gray-500' : 'text-purple-400'}`} />
                  </div>
                  <select
                    value={startTime}
                    onChange={(e) => {
                      const newStartTime = parseInt(e.target.value, 10);
                      setStartTime(newStartTime);
                      // Ensure end time is always later than start time
                      if (newStartTime >= endTime) {
                        setEndTime(newStartTime + 8 > 24 ? 24 : newStartTime + 8);
                      }
                    }}
                    className={`pl-12 w-full rounded-full h-14 border ${
                      darkMode 
                        ? 'bg-gray-700 border-gray-600 text-white' 
                        : 'bg-white border-purple-200 text-gray-900'
                    } px-4 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors duration-200 appearance-none text-base`}
                  >
                    {Array.from({ length: 19 }, (_, i) => i + 6).map((hour) => (
                      <option key={hour} value={hour} className={darkMode ? 'bg-gray-700' : ''}>
                        {hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      width="16" 
                      height="16" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      className={darkMode ? 'text-gray-500' : 'text-purple-400'}
                    >
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </div>
                </div>
              </div>
              
              <div>
                <label className={`block font-sans text-base font-bold  mb-2 ${colors.text}`}>
                  End Time
                </label>
                <div className="relative">
                  <div className={`absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none`}>
                    <Clock className={`h-5 w-5 ${darkMode ? 'text-gray-500' : 'text-purple-400'}`} />
                  </div>
                  <select
                    value={endTime}
                    onChange={(e) => setEndTime(parseInt(e.target.value, 10))}
                    className={`pl-12 w-full rounded-full h-14 border ${
                      darkMode 
                        ? 'bg-gray-700 border-gray-600 text-white' 
                        : 'bg-white border-purple-200 text-gray-900'
                    } px-4 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors duration-200 appearance-none text-base`}
                  >
                    {Array.from({ length: 25 - startTime }, (_, i) => i + startTime + 1)
                      .map((hour) => {
                        // For hours 24+ (next day), convert to proper display
                        const displayHour = hour >= 24 ? hour - 24 : hour;
                        const nextDay = hour >= 24;
                        return (
                          <option key={hour} value={hour} className={darkMode ? 'bg-gray-700' : ''}>
                            {displayHour === 12 ? '12 PM' : displayHour > 12 
                              ? `${displayHour - 12} PM${nextDay ? ' (next day)' : ''}` 
                              : `${displayHour} AM${nextDay ? ' (next day)' : ''}`}
                          </option>
                        );
                      })}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      width="16" 
                      height="16" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      className={darkMode ? 'text-gray-500' : 'text-purple-400'}
                    >
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Break Time Section */}
            <div className={`rounded-lg p-5 ${colors.secondaryBg} ${colors.border} border mt-1`}>
              <div 
                className="flex justify-between items-center cursor-pointer"
                onClick={() => setBreakTimeExpanded(!breakTimeExpanded)}
              >
                <div className="flex items-center">
                  <Coffee className={`h-5 w-5 mr-3 ${colors.highlight}`} />
                  <span className={`font-sans text-base font-bold  ${colors.text}`}>Break Time</span>
                </div>
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  width="16" 
                  height="16" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  className={`transform ${breakTimeExpanded ? 'rotate-180' : ''} ${colors.text}`}
                >
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </div>
              
              {breakTimeExpanded && (
                <div className="mt-4 space-y-4">
                  <div className="flex flex-wrap gap-2.5">
                    {defaultBreakOptions.map((option, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => {
                          if (option.startTime >= startTime && option.endTime <= endTime) {
                            setBreakStartTime(option.startTime);
                            setBreakEndTime(option.endTime);
                            setCustomBreak(false);
                          } else {
                            alert('Break time must be within your shift hours.');
                          }
                        }}
                        className={`text-sm py-2 px-4 rounded-full ${
                          !customBreak && breakStartTime === option.startTime && breakEndTime === option.endTime
                            ? (darkMode ? 'bg-purple-700 text-white' : 'bg-purple-500 text-white')
                            : (darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-purple-100 text-purple-700 hover:bg-purple-200')
                        } transition-colors duration-200 font-medium`}
                      >
                        {option.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setCustomBreak(true)}
                      className={`text-sm py-2 px-4 rounded-full ${
                        customBreak
                          ? (darkMode ? 'bg-purple-700 text-white' : 'bg-purple-500 text-white')
                          : (darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-purple-100 text-purple-700 hover:bg-purple-200')
                      } transition-colors duration-200 font-medium`}
                    >
                      Custom Break
                    </button>
                  </div>
                  
                  {(customBreak || (!defaultBreakOptions.some(opt => opt.startTime === breakStartTime && opt.endTime === breakEndTime))) && (
                    <div className="grid grid-cols-2 gap-4 mt-3">
                      <div>
                        <label className={`block text-sm font-medium mb-1.5 ${colors.text}`}>
                          Break Start
                        </label>
                        <select
                          value={breakStartTime}
                          onChange={(e) => {
                            const newStartTime = parseInt(e.target.value, 10);
                            setBreakStartTime(newStartTime);
                            if (newStartTime >= breakEndTime) {
                              setBreakEndTime(newStartTime + 1 > endTime ? endTime : newStartTime + 1);
                            }
                            setCustomBreak(true);
                          }}
                          className={`w-full rounded-lg h-11 border ${
                            darkMode 
                              ? 'bg-gray-700 border-gray-600 text-white' 
                              : 'bg-white border-purple-200 text-gray-900'
                          } px-3 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm`}
                        >
                          {Array.from({ length: endTime - startTime }, (_, i) => i + startTime).map((hour) => (
                            <option key={hour} value={hour}>
                              {formatTimeDisplay(hour)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={`block text-sm font-medium mb-1.5 ${colors.text}`}>
                          Break End
                        </label>
                        <select
                          value={breakEndTime}
                          onChange={(e) => {
                            setBreakEndTime(parseInt(e.target.value, 10));
                            setCustomBreak(true);
                          }}
                          className={`w-full rounded-lg h-11 border ${
                            darkMode 
                              ? 'bg-gray-700 border-gray-600 text-white' 
                              : 'bg-white border-purple-200 text-gray-900'
                          } px-3 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm`}
                        >
                          {Array.from({ length: endTime - breakStartTime }, (_, i) => i + breakStartTime + 1).map((hour) => (
                            <option key={hour} value={hour}>
                              {formatTimeDisplay(hour)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                  
                  <div className={`text-sm p-3 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-white'} ${colors.text} mt-1`}>
                    Current break time: <strong>{formatTimeDisplay(breakStartTime)} - {formatTimeDisplay(breakEndTime)}</strong>
                    <p className={`mt-1.5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      No routes will be scheduled during this period.
                    </p>
                  </div>
                </div>
              )}
              
              {!breakTimeExpanded && (
                <div className={`mt-2.5 text-sm ${colors.text}`}>
                  Current break: {formatTimeDisplay(breakStartTime)} - {formatTimeDisplay(breakEndTime)}
                </div>
              )}
            </div>

            <div className="mt-1">
              <label className={`block font-sans text-base font-bold  mb-2.5 ${colors.text}`}>
                Optimization Algorithm
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setAlgorithm('reinforcement')}
                  className={`h-14 flex items-center justify-center space-x-3 rounded-full border ${
                    algorithm === 'reinforcement'
                      ? (darkMode ? 'bg-purple-700 border-purple-600 text-white' : 'bg-purple-500 border-purple-400 text-white')
                      : (darkMode ? 'bg-gray-700 border-gray-600 text-gray-300' : 'bg-white border-purple-200 text-gray-600')
                  } transition-colors duration-200 text-base font-medium`}
                >
                  <Settings className="h-5 w-5" />
                  <span>AI Optimized</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAlgorithm('greedy')}
                  className={`h-14 flex items-center justify-center space-x-3 rounded-full border ${
                    algorithm === 'greedy'
                      ? (darkMode ? 'bg-purple-700 border-purple-600 text-white' : 'bg-purple-500 border-purple-400 text-white')
                      : (darkMode ? 'bg-gray-700 border-gray-600 text-gray-300' : 'bg-white border-purple-200 text-gray-600')
                  } transition-colors duration-200 text-base font-medium`}
                >
                  <Calendar className="h-5 w-5" />
                  <span>Standard</span>
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full h-14 rounded-full flex items-center justify-center transition-all duration-300 ${
              isLoading 
                ? (darkMode ? 'bg-purple-700' : 'bg-purple-400') 
                : (darkMode ? 'bg-purple-600 hover:bg-purple-500' : 'bg-purple-500 hover:bg-purple-400')
            } text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 transform hover:scale-[1.01] active:scale-[0.99] shadow-md text-base font-medium mt-5`}
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                Optimizing Route...
              </>
            ) : (
              'Generate Optimized Route'
            )}
          </button>
        </form>
      )}
    </div>
  );
}