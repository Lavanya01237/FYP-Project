import React, { useState, useEffect, useRef } from 'react';
import { Map } from './Map';
import { MapPin, ThumbsUp, X, AlertTriangle } from 'lucide-react';

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

interface DropOffSelectionProps {
  darkMode?: boolean;
  currentLocation: { lat: number; lng: number };
  onDropOffSelected: (location: DropOffLocation) => void;
  onCancel: () => void;
  themeColors?: {
    bg: string;
    card: string;
    text: string;
    highlight: string;
    secondaryBg: string;
    border: string;
  };
}

export function DropOffSelection({ 
  darkMode = false, 
  currentLocation, 
  onDropOffSelected, 
  onCancel,
  themeColors 
}: DropOffSelectionProps) {
  const [dropOffLocations, setDropOffLocations] = useState<DropOffLocation[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiRecommendedId, setAiRecommendedId] = useState<number | null>(null);
  const [inputLabel, setInputLabel] = useState('');
  const mapRef = useRef<any>(null);

  const colors = themeColors || {
    bg: darkMode ? 'bg-gray-900' : 'bg-purple-50',
    card: darkMode ? 'bg-gray-800' : 'bg-white',
    text: darkMode ? 'text-gray-200' : 'text-gray-800',
    highlight: darkMode ? 'text-purple-400' : 'text-purple-600',
    secondaryBg: darkMode ? 'bg-gray-700' : 'bg-purple-50',
    border: darkMode ? 'border-gray-700' : 'border-purple-100'
  };

  const handleLocationSelected = (lat: number, lng: number) => {
    const label = inputLabel || `Location ${dropOffLocations.length + 1}`;
    const newLocation: DropOffLocation = {
      id: Date.now(),
      lat,
      lng,
      label
    };
    setDropOffLocations([...dropOffLocations, newLocation]);
    setInputLabel('');
  };

  const handleAnalyzeLocations = async () => {
    if (dropOffLocations.length === 0) return;
    
    setIsAnalyzing(true);
    
    try {
      // In a real implementation, this would call your backend API with the RL algorithm
      // For now, we'll simulate the analysis with a timeout and random scores
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Simulate AI analysis results
      const updatedLocations = dropOffLocations.map(location => {
        const distance = haversineDistance(
          currentLocation.lat, 
          currentLocation.lng, 
          location.lat, 
          location.lng
        );
        
        // Calculate mock duration (60 km/h average speed)
        const duration = (distance / 60) * 60 * 60; // seconds
        
        // Basic revenue calculation based on your formula
        const revenue = 4.5 + (distance * 0.70);
        
        // Generate a score based on the algorithm logic
        // Higher score = better option
        const prediction = Math.random() * 2 - 1; // Random value between -1 and 1
        const demandScore = prediction < 0 ? -prediction : 0;
        const score = revenue * (1 + Math.max(0, demandScore));
        
        return {
          ...location,
          score,
          revenue,
          distance,
          duration
        };
      });
      
      // Find the location with the highest score
      const bestLocation = updatedLocations.reduce(
        (best, current) => (current.score! > best.score! ? current : best),
        updatedLocations[0]
      );
      
      setAiRecommendedId(bestLocation.id);
      setSelectedLocationId(bestLocation.id);
      setDropOffLocations(updatedLocations);
    } catch (error) {
      console.error('Error analyzing drop-off locations:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Helper function to calculate distance between two points (in km)
  const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const handleLocationSelect = (id: number) => {
    setSelectedLocationId(id);
  };

  const handleConfirmSelection = () => {
    if (selectedLocationId !== null) {
      const selectedLocation = dropOffLocations.find(loc => loc.id === selectedLocationId);
      if (selectedLocation) {
        onDropOffSelected(selectedLocation);
      }
    }
  };

  const handleRemoveLocation = (id: number) => {
    setDropOffLocations(dropOffLocations.filter(loc => loc.id !== id));
    if (selectedLocationId === id) {
      setSelectedLocationId(null);
    }
    if (aiRecommendedId === id) {
      setAiRecommendedId(null);
    }
  };

  const formatDuration = (seconds: number): string => {
    const minutes = Math.round(seconds / 60);
    return `${minutes} min`;
  };

  return (
    <div className="flex flex-col h-full">
      <div className={`p-4 ${colors.card} border-b ${colors.border}`}>
        <div className="flex justify-between items-center mb-4">
          <h2 className={`text-lg font-semibold ${colors.text}`}>Select Drop-off Location</h2>
          <button
            onClick={onCancel}
            className={`p-2 rounded-full hover:${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}
          >
            <X size={20} className={colors.text} />
          </button>
        </div>

        <div className="flex items-center mb-4">
          <div className="relative flex-1 mr-2">
            <input
              type="text"
              placeholder="Enter location label (optional)"
              value={inputLabel}
              onChange={(e) => setInputLabel(e.target.value)}
              className={`pl-10 w-full rounded-full h-10 border ${
                darkMode 
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                  : 'bg-white border-purple-200 text-gray-900 placeholder-gray-400'
              } px-4 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors duration-200`}
            />
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <MapPin className={`h-5 w-5 ${darkMode ? 'text-gray-500' : 'text-purple-400'}`} />
            </div>
          </div>
        </div>

        <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'} mb-4`}>
          Click on the map to add potential drop-off locations. Our AI will analyze and recommend the best option.
        </p>

        {dropOffLocations.length > 0 && (
          <div className="mb-4">
            <div className="flex justify-between mb-2">
              <span className={`text-sm font-medium ${colors.text}`}>Potential Drop-offs ({dropOffLocations.length})</span>
              <button 
                onClick={handleAnalyzeLocations}
                disabled={isAnalyzing || dropOffLocations.length === 0}
                className={`text-xs py-1 px-3 rounded-full ${
                  isAnalyzing || dropOffLocations.length === 0
                    ? (darkMode ? 'bg-gray-700 text-gray-500' : 'bg-gray-200 text-gray-400')
                    : (darkMode ? 'bg-purple-700 text-white' : 'bg-purple-500 text-white')
                } transition-colors duration-200`}
              >
                {isAnalyzing ? 'Analyzing...' : 'Analyze Drop-offs'}
              </button>
            </div>
            
            <div className="max-h-40 overflow-y-auto pr-2 space-y-2">
              {dropOffLocations.map((location) => (
                <div 
                  key={location.id}
                  onClick={() => handleLocationSelect(location.id)}
                  className={`p-3 rounded-lg cursor-pointer transition-all duration-200 border relative ${
                    selectedLocationId === location.id 
                      ? (darkMode ? 'bg-gray-700 border-purple-500' : 'bg-purple-50 border-purple-400')
                      : (darkMode ? 'bg-gray-800 border-gray-700 hover:bg-gray-700' : 'bg-white border-gray-200 hover:bg-purple-50')
                  } ${aiRecommendedId === location.id ? 'border-2' : 'border'}`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="w-2 h-2 rounded-full bg-purple-500" />
                        <span className={`font-medium ${colors.text}`}>{location.label}</span>
                        {aiRecommendedId === location.id && (
                          <span className={`text-xs py-0.5 px-2 rounded-full ${darkMode ? 'bg-green-900 text-green-200' : 'bg-green-100 text-green-800'}`}>
                            AI Recommended
                          </span>
                        )}
                      </div>
                      <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'} mt-1`}>
                        {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                      </p>
                      {location.score !== undefined && (
                        <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                          <div className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            <span className="block font-medium">Distance</span>
                            <span>{location.distance?.toFixed(1)} km</span>
                          </div>
                          <div className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            <span className="block font-medium">Time</span>
                            <span>{formatDuration(location.duration || 0)}</span>
                          </div>
                          <div className={`${darkMode ? 'text-green-400' : 'text-green-600'}`}>
                            <span className="block font-medium">Revenue</span>
                            <span>${location.revenue?.toFixed(2)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveLocation(location.id);
                      }}
                      className={`p-1 rounded-full ${darkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'}`}
                    >
                      <X size={16} className={darkMode ? 'text-gray-400' : 'text-gray-500'} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3 mt-4">
          <button
            onClick={onCancel}
            className={`flex-1 py-2 rounded-full border ${darkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-600 hover:bg-gray-100'} transition-colors duration-200`}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmSelection}
            disabled={selectedLocationId === null}
            className={`flex-1 py-2 rounded-full flex items-center justify-center ${
              selectedLocationId === null
                ? (darkMode ? 'bg-gray-700 text-gray-500' : 'bg-gray-200 text-gray-400')
                : (darkMode ? 'bg-purple-600 text-white hover:bg-purple-500' : 'bg-purple-500 text-white hover:bg-purple-400')
            } transition-colors duration-200`}
          >
            <ThumbsUp size={18} className="mr-2" />
            Confirm Selection
          </button>
        </div>
      </div>

      <div className="flex-1 relative">
        <Map 
          locations={[]}  // No existing route locations
          darkMode={darkMode}
          isSelectionMode={true}
          onLocationSelected={handleLocationSelected}
          customDropoffs={dropOffLocations}
          themeColors={themeColors}
        />
      </div>
    </div>
  );
}