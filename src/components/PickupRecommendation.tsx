import React, { useState, useEffect } from 'react';
import { Map } from './Map';
import { Navigation, ThumbsUp, X, ArrowRight, TrendingUp, MapPin, PlusCircle, RefreshCw } from 'lucide-react';

interface PickupLocation {
  id: number;
  lat: number;
  lng: number;
  label: string;
  score?: number;
  distance?: number;
  duration?: number;
  prediction?: number;
  isCustom?: boolean;
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
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [recommendedPickups, setRecommendedPickups] = useState<PickupLocation[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
  const [aiRecommendedId, setAiRecommendedId] = useState<number | null>(null);
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customLocation, setCustomLocation] = useState<{lat: number, lng: number} | null>(null);
  const [customLabel, setCustomLabel] = useState('');

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

  // Function to analyze a custom location
  const analyzeCustomLocation = async (location: PickupLocation): Promise<PickupLocation> => {
    // In a real implementation, you would call your backend API to get ML predictions
    // For now, we'll simulate with random values
    
    // Generate a prediction score (-2 to 2) for demand
    const prediction = Math.random() * 4 - 2;
    
    // Calculate a score based on the prediction and distance
    const score = (prediction > 0 ? prediction * 2 : 0) - (location.distance || 0) * 0.5;
    
    return {
      ...location,
      prediction,
      score
    };
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

  // Handle custom location selection on map
  const handleCustomLocationSelected = async (lat: number, lng: number) => {
    setCustomLocation({ lat, lng });
    
    // Calculate distance from current location
    const distance = haversineDistance(
      currentLocation.lat,
      currentLocation.lng,
      lat,
      lng
    );
    
    // Calculate duration (estimated)
    const duration = (distance / 60) * 60 * 60; // seconds
    
    // Create a custom pickup location
    let customPickup: PickupLocation = {
      id: Date.now(),
      lat,
      lng,
      label: customLabel || 'Custom Pickup',
      distance,
      duration,
      isCustom: true
    };
    
    // Analyze the custom location to get demand prediction
    setIsAnalyzing(true);
    
    try {
      // Simulate short delay for analysis
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Get demand prediction and score for custom location
      customPickup = await analyzeCustomLocation(customPickup);
      
      // Add to recommendations and select it
      setRecommendedPickups([...recommendedPickups, customPickup]);
      setSelectedLocationId(customPickup.id);
    } catch (error) {
      console.error('Error analyzing custom location:', error);
    } finally {
      setIsAnalyzing(false);
      // Exit custom mode
      setIsCustomMode(false);
      setCustomLabel('');
    }
  };

  // Function to re-analyze all custom pickup locations
  const handleReanalyzeCustomPickups = async () => {
    setIsAnalyzing(true);
    
    try {
      // Create a copy of the current recommendations
      const updatedPickups = [...recommendedPickups];
      
      // Find all custom locations and re-analyze them
      for (let i = 0; i < updatedPickups.length; i++) {
        if (updatedPickups[i].isCustom) {
          // Re-analyze the custom location
          updatedPickups[i] = await analyzeCustomLocation(updatedPickups[i]);
        }
      }
      
      // Update the recommendations state
      setRecommendedPickups(updatedPickups);
    } catch (error) {
      console.error('Error re-analyzing custom locations:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Check if there are any custom locations
  const hasCustomLocations = recommendedPickups.some(loc => loc.isCustom);

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

        {isCustomMode ? (
          <div className={`p-4 rounded-lg ${colors.secondaryBg} mb-4`}>
            <h3 className={`text-sm font-medium ${colors.text} mb-2`}>Choose Custom Pickup Location</h3>
            <div className="relative mb-3">
              <input
                type="text"
                placeholder="Enter custom pickup label"
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
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
            <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'} mb-2`}>
              Click on the map to select your custom pickup location. We'll analyze the demand at this location.
            </p>
            <button
              onClick={() => setIsCustomMode(false)}
              className={`w-full py-2 rounded-full ${
                darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'
              } transition-colors duration-200`}
            >
              Cancel Custom Selection
            </button>
          </div>
        ) : (
          <>
            {isLoading || isAnalyzing ? (
              <div className={`p-8 flex justify-center items-center ${colors.secondaryBg} rounded-lg mb-4`}>
                <div className="flex flex-col items-center">
                  <div className={`animate-spin rounded-full h-10 w-10 border-b-2 ${darkMode ? 'border-purple-400' : 'border-purple-600'}`}></div>
                  <p className={`mt-4 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    {isAnalyzing ? 'Analyzing location...' : 'AI is analyzing optimal pickup locations...'}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-3 mb-4 max-h-56 overflow-y-auto pr-2">
                  {recommendedPickups.map((location) => (
                    <div 
                      key={location.id}
                      onClick={() => handleLocationSelect(location.id)}
                      className={`p-3 rounded-lg cursor-pointer transition-all duration-200 border relative ${
                        selectedLocationId === location.id 
                          ? (darkMode ? 'bg-gray-700 border-purple-500' : 'bg-purple-50 border-purple-400')
                          : (darkMode ? 'bg-gray-800 border-gray-700 hover:bg-gray-700' : 'bg-white border-gray-200 hover:bg-purple-50')
                      } ${aiRecommendedId === location.id && !location.isCustom ? 'border-2' : 'border'}`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className={`w-2 h-2 rounded-full ${location.isCustom ? 'bg-blue-500' : 'bg-orange-500'}`} />
                            <span className={`font-medium ${colors.text}`}>{location.label}</span>
                            {aiRecommendedId === location.id && !location.isCustom && (
                              <span className={`text-xs py-0.5 px-2 rounded-full ${darkMode ? 'bg-green-900 text-green-200' : 'bg-green-100 text-green-800'}`}>
                                Top Pick
                              </span>
                            )}
                            {location.isCustom && (
                              <span className={`text-xs py-0.5 px-2 rounded-full ${darkMode ? 'bg-blue-900 text-blue-200' : 'bg-blue-100 text-blue-800'}`}>
                                Custom
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
                
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => setIsCustomMode(true)}
                    className={`flex-1 py-2 rounded-full flex items-center justify-center ${
                      darkMode ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-blue-500 text-white hover:bg-blue-400'
                    } transition-colors duration-200`}
                  >
                    <PlusCircle size={18} className="mr-2" />
                    Choose Custom Pickup
                  </button>
                  
                  {hasCustomLocations && (
                    <button
                      onClick={handleReanalyzeCustomPickups}
                      className={`py-2 px-3 rounded-full flex items-center justify-center ${
                        darkMode ? 'bg-indigo-600 text-white hover:bg-indigo-500' : 'bg-indigo-500 text-white hover:bg-indigo-400'
                      } transition-colors duration-200`}
                    >
                      <RefreshCw size={18} />
                    </button>
                  )}
                </div>
              </>
            )}
          </>
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
            disabled={selectedLocationId === null || isLoading || isAnalyzing || isCustomMode}
            className={`flex-1 py-2 rounded-full flex items-center justify-center ${
              selectedLocationId === null || isLoading || isAnalyzing || isCustomMode
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
          locations={[{
            lat: currentLocation.lat,
            lng: currentLocation.lng,
            type: 'pickup',
            time: 'Current Location',
            revenue: 0,
            tripId: 0
          }]}
          darkMode={darkMode}
          isSelectionMode={isCustomMode}
          onLocationSelected={isCustomMode ? handleCustomLocationSelected : undefined}
          customDropoffs={recommendedPickups.map(loc => ({
            id: loc.id,
            lat: loc.lat,
            lng: loc.lng,
            label: loc.label
          }))}
          themeColors={colors}
        />
        
        {!isLoading && recommendedPickups.length > 0 && (
          <div className={`absolute left-4 top-4 z-50 ${colors.card} p-3 rounded-lg shadow-lg border ${colors.border}`}>
            <p className={`text-xs font-medium ${colors.text} mb-1`}>Current Location</p>
            <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              {currentLocation.lat.toFixed(4)}, {currentLocation.lng.toFixed(4)}
            </p>
            {isCustomMode ? (
              <div className={`mt-2 flex items-center text-xs ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                <ArrowRight size={12} className="mx-1" />
                <span>Click on map to choose custom pickup</span>
              </div>
            ) : (
              <div className={`mt-2 flex items-center text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                <ArrowRight size={12} className="mx-1" />
                <span>AI-recommended pickups shown on map</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}