import { useState, useEffect } from 'react';
import { Clock, MapPin, Locate } from 'lucide-react';

interface RouteFormProps {
  onSubmit: (data: { lat: number; lng: number; startTime: number; endTime: number; algorithm: 'reinforcement' | 'greedy' }) => void;
  isLoading?: boolean;
  darkMode?: boolean;
}

export function RouteForm({ onSubmit, isLoading, darkMode = false }: RouteFormProps) {
  const [lat, setLat] = useState<number>(1.3521);
  const [lng, setLng] = useState<number>(103.8198);
  const [startTime, setStartTime] = useState<number>(6); // Changed default to 6 AM
  const [endTime, setEndTime] = useState<number>(25); // Default end time to 1 AM next day (25)
  const [algorithm, setAlgorithm] = useState<'reinforcement' | 'greedy'>('reinforcement');
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ lat, lng, startTime, endTime, algorithm });
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

  // Popular Singapore locations
  const popularLocations = [
    { name: 'Downtown Core', lat: 1.2789, lng: 103.8536 },
    { name: 'Orchard', lat: 1.3006, lng: 103.8368 },
    { name: 'Changi Airport', lat: 1.3644, lng: 103.9915 },
    { name: 'Jurong East', lat: 1.3162, lng: 103.7649 },
    { name: 'Woodlands', lat: 1.4019, lng: 103.7855 }
  ];

  return (
    <form onSubmit={handleSubmit} className={`space-y-6 ${darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white'} p-6 rounded-lg shadow-md transition-colors duration-300`}>
      <h2 className={`text-lg font-semibold mb-4 ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
        Route Settings
      </h2>

      <div className="space-y-4">
        <div>
          <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            Starting Location
          </label>
          <div className="grid grid-cols-6 gap-2">
            <div className="col-span-3">
              <div className="relative">
                <MapPin className={`absolute left-3 top-2.5 h-5 w-5 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                <input
                  type="number"
                  step="0.0001"
                  placeholder="Latitude"
                  value={lat}
                  onChange={(e) => setLat(parseFloat(e.target.value))}
                  className={`pl-10 w-full rounded-md border ${darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900'} px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200`}
                />
              </div>
            </div>
            <div className="col-span-2">
              <input
                type="number"
                step="0.0001"
                placeholder="Longitude"
                value={lng}
                onChange={(e) => setLng(parseFloat(e.target.value))}
                className={`w-full rounded-md border ${darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900'} px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200`}
              />
            </div>
            <div className="col-span-1">
              <button
                type="button"
                onClick={getCurrentLocation}
                disabled={isGettingLocation}
                className={`h-full w-full flex items-center justify-center rounded-md ${darkMode 
                  ? 'bg-gray-700 text-blue-400 hover:bg-gray-600' 
                  : 'bg-blue-50 text-blue-600 hover:bg-blue-100'} 
                  transition-colors duration-200 disabled:opacity-50`}
                title="Use my current location"
              >
                <Locate size={18} className={isGettingLocation ? 'animate-pulse' : ''} />
              </button>
            </div>
          </div>
        </div>

        <div>
          <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            Popular Locations
          </label>
          <div className="grid grid-cols-2 gap-2">
            {popularLocations.map((location, index) => (
              <button
                key={index}
                type="button"
                onClick={() => {
                  setLat(location.lat);
                  setLng(location.lng);
                }}
                className={`text-xs py-1 px-2 rounded ${darkMode 
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200'} transition-colors duration-200`}
              >
                {location.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            Start Time
          </label>
          <div className="relative">
            <Clock className={`absolute left-3 top-2.5 h-5 w-5 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
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
              className={`pl-10 w-full rounded-md border ${darkMode 
                ? 'bg-gray-700 border-gray-600 text-white' 
                : 'bg-white border-gray-300 text-gray-900'} 
                px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200`}
            >
              {Array.from({ length: 19 }, (_, i) => i + 6).map((hour) => (
                <option key={hour} value={hour} className={darkMode ? 'bg-gray-700' : ''}>
                  {hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        <div>
          <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            End Time
          </label>
          <div className="relative">
            <Clock className={`absolute left-3 top-2.5 h-5 w-5 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
            <select
              value={endTime}
              onChange={(e) => setEndTime(parseInt(e.target.value, 10))}
              className={`pl-10 w-full rounded-md border ${darkMode 
                ? 'bg-gray-700 border-gray-600 text-white' 
                : 'bg-white border-gray-300 text-gray-900'} 
                px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200`}
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
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <div>
          <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            Algorithm
          </label>
          <div className="relative">
            <select
              value={algorithm}
              onChange={(e) => setAlgorithm(e.target.value as 'reinforcement' | 'greedy')}
              className={`w-full rounded-md border ${darkMode 
                ? 'bg-gray-700 border-gray-600 text-white' 
                : 'bg-white border-gray-300 text-gray-900'} 
                px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200`}
            >
              <option value="reinforcement" className={darkMode ? 'bg-gray-700' : ''}>
                Reinforcement Learning
              </option>
              <option value="greedy" className={darkMode ? 'bg-gray-700' : ''}>
                Greedy Algorithm
              </option>
            </select>
          </div>
        </div>
      </div>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className={`w-full py-2 px-4 rounded-md flex items-center justify-center transition-all duration-300 ${
          isLoading 
            ? (darkMode ? 'bg-blue-700' : 'bg-blue-400') 
            : (darkMode ? 'bg-blue-600 hover:bg-blue-500' : 'bg-blue-600 hover:bg-blue-700')
        } text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transform hover:scale-[1.02] active:scale-[0.98]`}
      >
        {isLoading ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
            Generating Route...
          </>
        ) : (
          'Generate Optimized Route'
        )}
      </button>
    </form>
  );
}