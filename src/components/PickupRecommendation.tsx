import React, { useState, useEffect } from 'react';
import { Map } from './Map';
import { Navigation, ThumbsUp, X, ArrowRight, TrendingUp } from 'lucide-react';

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

interface PickupRecommendationProps {
  darkMode?: boolean;
  currentLocation: { lat: number; lng: number };
  onPickupSelected: (location: PickupLocation) => void;
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

export function PickupRecommendation({ 
  darkMode = false, 
  currentLocation, 
  onPickupSelected, 
  onCancel,
  themeColors 
}: PickupRecommendationProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [recommendedPickups, setRecommendedPickups] = useState<PickupLocation[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
  const [aiRecommendedId, setAiRecommendedId] = useState<number | null>(null);

  const colors = themeColors || {
    bg: darkMode ? 'bg-gray-900' : 'bg-purple-50',
    card: darkMode ? 'bg-gray-800' : 'bg-white',
    text: darkMode ? 'text-gray-200' : 'text-gray-800',
    highlight: darkMode ? 'text-purple-400' : 'text-purple-600',
    secondaryBg: darkMode ? 'bg-gray-700' : 'bg-purple-50',
    border: darkMode ? 'border-gray-700' : 'border-purple-100'
  };

  useEffect(() => {
    const fetchRecommendations = async () => {
      setIsLoading(true);
      
      try {
        // In a real implementation, this would call your backend API with the RL algorithm
        // For now, we'll simulate the analysis with a timeout and random locations
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Generate 3-5 pickup recommendations around the current location
        const numRecommendations = Math.floor(Math.random() * 3) + 3; // 3-5 recommendations
        const mockRecommendations: PickupLocation[] = [];
        
        for (let i = 0; i < numRecommendations; i++) {
          // Generate a location within ~1-3km of current location
          const randomDistance = 0.01 + (Math.random() * 0.02); // ~1-3km
          const randomAngle = Math.random() * 2 * Math.PI;
          const lat = currentLocation.lat + (randomDistance * Math.cos(randomAngle));
          const lng = currentLocation.lng + (randomDistance * Math.sin(randomAngle));
          
          // Calculate actual distance
          const distance = haversineDistance(
            currentLocation.lat, 
            currentLocation.lng, 
            lat, 
            lng
          );
          
          // Calculate mock duration (60 km/h average speed)
          const duration = (distance / 60) * 60 * 60; // seconds
          
          // Generate a prediction score (-2 to 2)
          // Negative = more supply than demand (less favorable)
          // Positive = more demand than supply (more favorable)
          const prediction = Math.random() * 4 - 2; 
          
          // Calculate a score based on the prediction and distance
          // Higher score = better pickup location
          const score = (prediction > 0 ? prediction * 2 : 0) - (distance * 0.5);
          
          mockRecommendations.push({
            id: Date.now() + i,
            lat,
            lng,
            label: `Pickup ${String.fromCharCode(65 + i)}`, // A, B, C, etc.
            score,
            distance,
            duration,
            prediction
          });
        }
        
        // Sort by score (highest first)
        mockRecommendations.sort((a, b) => (b.score || 0) - (a.score || 0));
        
        // Set the highest scored location as the AI recommendation
        if (mockRecommendations.length > 0) {
          setAiRecommendedId(mockRecommendations[0].id);
          setSelectedLocationId(mockRecommendations[0].id);
        }
        
        setRecommendedPickups(mockRecommendations);
      } catch (error) {
        console.error('Error fetching pickup recommendations:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchRecommendations();
  }, [currentLocation]);

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
      const selectedLocation = recommendedPickups.find(loc => loc.id === selectedLocationId);
      if (selectedLocation) {
        onPickupSelected(selectedLocation);
      }
    }
  };

  const formatDuration = (seconds: number): string => {
    const minutes = Math.round(seconds / 60);
    return `${minutes} min`;
  };

  const getPredictionLabel = (prediction?: number): string => {
    if (prediction === undefined) return 'Unknown';
    if (prediction > 1) return 'Very High Demand';
    if (prediction > 0.5) return 'High Demand';
    if (prediction > 0) return 'Moderate Demand';
    if (prediction > -0.5) return 'Balanced';
    if (prediction > -1) return 'Low Demand';
    return 'Very Low Demand';
  };

  const getPredictionColor = (prediction?: number): string => {
    if (prediction === undefined) return darkMode ? 'text-gray-400' : 'text-gray-500';
    if (prediction > 0.5) return darkMode ? 'text-green-400' : 'text-green-600';
    if (prediction > 0) return darkMode ? 'text-green-500' : 'text-green-500';
    if (prediction > -0.5) return darkMode ? 'text-yellow-400' : 'text-yellow-600';
    return darkMode ? 'text-red-400' : 'text-red-500';
  };

  return (
    <div className="flex flex-col h-full">
      <div className={`p-4 ${colors.card} border-b ${colors.border}`}>
        <div className="flex justify-between items-center mb-4">
          <h2 className={`text-lg font-semibold ${colors.text}`}>AI Recommended Pickups</h2>
          <button
            onClick={onCancel}
            className={`p-2 rounded-full hover:${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}
          >
            <X size={20} className={colors.text} />
          </button>
        </div>

        <div className={`mb-4 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
          <p className="text-sm">
            Based on our AI analysis of historical data and current conditions, here are the most profitable pickup locations.
          </p>
        </div>

        {isLoading ? (
          <div className={`p-8 flex justify-center items-center ${colors.secondaryBg} rounded-lg mb-4`}>
            <div className="flex flex-col items-center">
              <div className={`animate-spin rounded-full h-10 w-10 border-b-2 ${darkMode ? 'border-purple-400' : 'border-purple-600'}`}></div>
              <p className={`mt-4 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>AI is analyzing optimal pickup locations...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3 mb-4 max-h-56 overflow-y-auto pr-2">
            {recommendedPickups.map((location) => (
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
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full bg-orange-500" />
                      <span className={`font-medium ${colors.text}`}>{location.label}</span>
                      {aiRecommendedId === location.id && (
                        <span className={`text-xs py-0.5 px-2 rounded-full ${darkMode ? 'bg-green-900 text-green-200' : 'bg-green-100 text-green-800'}`}>
                          Top Pick
                        </span>
                      )}
                    </div>
                    
                    <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                      <div className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        <span className="block font-medium">Distance</span>
                        <span>{location.distance?.toFixed(1)} km</span>
                      </div>
                      <div className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        <span className="block font-medium">Est. Travel Time</span>
                        <span>{formatDuration(location.duration || 0)}</span>
                      </div>
                      <div className={`col-span-2 mt-1 ${getPredictionColor(location.prediction)}`}>
                        <span className="flex items-center">
                          <TrendingUp size={14} className="mr-1" />
                          <span className="font-medium">{getPredictionLabel(location.prediction)}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
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
            disabled={selectedLocationId === null || isLoading}
            className={`flex-1 py-2 rounded-full flex items-center justify-center ${
              selectedLocationId === null || isLoading
                ? (darkMode ? 'bg-gray-700 text-gray-500' : 'bg-gray-200 text-gray-400')
                : (darkMode ? 'bg-purple-600 text-white hover:bg-purple-500' : 'bg-purple-500 text-white hover:bg-purple-400')
            } transition-colors duration-200`}
          >
            <Navigation size={18} className="mr-2" />
            Go to Pickup
          </button>
        </div>
      </div>

      <div className="flex-1 relative">
        <Map 
          locations={[]}
          darkMode={darkMode}
          isSelectionMode={false}
          customDropoffs={recommendedPickups.map(loc => ({
            id: loc.id,
            lat: loc.lat,
            lng: loc.lng,
            label: loc.label
          }))}
          themeColors={themeColors}
        />
        
        {!isLoading && recommendedPickups.length > 0 && (
          <div className={`absolute left-4 top-4 z-50 ${colors.card} p-3 rounded-lg shadow-lg border ${colors.border}`}>
            <p className={`text-xs font-medium ${colors.text} mb-1`}>Current Location</p>
            <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              {currentLocation.lat.toFixed(4)}, {currentLocation.lng.toFixed(4)}
            </p>
            <div className={`mt-2 flex items-center text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              <ArrowRight size={12} className="mx-1" />
              <span>AI-recommended pickups shown on map</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}