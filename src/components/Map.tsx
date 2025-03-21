import { MapContainer, TileLayer, Marker, Popup, GeoJSON, Polyline, useMapEvents } from 'react-leaflet';
import { Icon, DivIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Location } from '../types';
import { useEffect, useState, useRef } from 'react';

// Define icon URLs explicitly
const ICON_URL = 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png';
const ICON_RETINA_URL = 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png';
const SHADOW_URL = 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png';

// Fix Leaflet icon issue
import L from 'leaflet';

// Properly initialize Leaflet icons
// Set default icon globally with type assertion
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: ICON_URL,
  iconRetinaUrl: ICON_RETINA_URL,
  shadowUrl: SHADOW_URL,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

interface MapProps {
  locations: Location[];
  darkMode?: boolean;
  isSelectionMode?: boolean;
  onLocationSelected?: (lat: number, lng: number) => void;
  customDropoffs?: Array<{
    id: number;
    lat: number;
    lng: number;
    label: string;
  }>;
  themeColors?: {
    bg: string;
    card: string;
    text: string;
    highlight: string;
    secondaryBg: string;
    border: string;
  };
}

// Create custom pickup icon
const pickupIcon = new Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-yellow.png',
  iconSize: [30, 45],
  iconAnchor: [15, 45],
  popupAnchor: [1, -34],
  shadowUrl: SHADOW_URL,
  shadowSize: [41, 41]
});

// Create custom dropoff icon
const dropoffIcon = new Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png',
  iconSize: [30, 45],
  iconAnchor: [15, 45],
  popupAnchor: [1, -34],
  shadowUrl: SHADOW_URL,
  shadowSize: [41, 41]
});

// Create custom planned dropoff icon
const plannedDropoffIcon = new Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  iconSize: [30, 45],
  iconAnchor: [15, 45],
  popupAnchor: [1, -34],
  shadowUrl: SHADOW_URL,
  shadowSize: [41, 41]
});

// Create custom current location icon (blue)
const currentLocationIcon = new Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  iconSize: [30, 45],
  iconAnchor: [15, 45],
  popupAnchor: [1, -34],
  shadowUrl: SHADOW_URL,
  shadowSize: [41, 41]
});

// Create the marker label (for the numbered markers)
const createMarkerLabel = (index: number, darkMode: boolean) => {
  return new DivIcon({
    html: `<div style="background-color: ${darkMode ? '#1F2937' : 'white'}; 
                      color: ${darkMode ? 'white' : '#6B46C1'}; 
                      border: 1px solid ${darkMode ? '#374151' : '#D6BCFA'};
                      border-radius: 50%;
                      width: 24px;
                      height: 24px;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      font-size: 12px;
                      font-weight: bold;
                      box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              ${index + 1}
             </div>`,
    className: '',
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
};

// Location selection component that captures map clicks
function LocationSelector({ onLocationSelected }: { onLocationSelected: (lat: number, lng: number) => void }) {
  const map = useMapEvents({
    click: (e) => {
      console.log("Map clicked at:", e.latlng);
      onLocationSelected(e.latlng.lat, e.latlng.lng);
      
      // Center map on the selected location
      map.panTo(e.latlng);
    }
  });

  return null;
}

function createWaypoints(locations: Location[]): string {
  return locations
    .map(loc => `${loc.lng},${loc.lat}`)
    .join(';');
}

export function Map({ 
  locations, 
  darkMode = false, 
  isSelectionMode = false, 
  onLocationSelected, 
  customDropoffs = [],
  themeColors 
}: MapProps) {
  const center = locations.length > 0 ? locations[0] : { lat: 1.3521, lng: 103.8198 };
  const [routeGeometry, setRouteGeometry] = useState<any>(null);
  const [routes, setRoutes] = useState<Array<{ pickup: Location, dropoff: Location, coordinates: [number, number][] }>>([]);
  const [activeTrip, setActiveTrip] = useState<number | null>(null);
  const [tempMarker, setTempMarker] = useState<{lat: number, lng: number} | null>(null);
  const mapRef = useRef<any>(null);
  const colors = themeColors || {
    bg: darkMode ? 'bg-gray-900' : 'bg-purple-50',
    card: darkMode ? 'bg-gray-800' : 'bg-white',
    text: darkMode ? 'text-gray-200' : 'text-gray-800',
    highlight: darkMode ? 'text-purple-400' : 'text-purple-600',
    secondaryBg: darkMode ? 'bg-gray-700' : 'bg-purple-50',
    border: darkMode ? 'border-gray-700' : 'border-purple-100'
  };

  // Find the most recent location (the one that should have the blue marker)
  const getMostRecentLocation = () => {
    if (locations.length <= 0) return null;
    
    // If in selection mode, return the current location (first location)
    if (isSelectionMode) return locations[0];
    
    // Sort locations by tripId in descending order to find the most recent
    const sortedLocations = [...locations].sort((a, b) => b.tripId - a.tripId);
    
    // Return the location with the highest tripId
    return sortedLocations[0];
  };

  // Fetch individual trip routes using OSRM
  useEffect(() => {
    const fetchTripRoutes = async () => {
      const tripRoutes: Array<{ pickup: Location, dropoff: Location, coordinates: [number, number][] }> = [];
      
      for (let i = 0; i < locations.length; i++) {
        if (locations[i].type === 'pickup') {
          const dropoff = locations.find(
            loc => loc.tripId === locations[i].tripId && loc.type === 'dropoff'
          );
          
          if (dropoff) {
            try {
              // Fetch route between pickup and dropoff
              const waypoints = `${locations[i].lng},${locations[i].lat};${dropoff.lng},${dropoff.lat}`;
              const response = await fetch(
                `https://router.project-osrm.org/route/v1/driving/${waypoints}?overview=full&geometries=geojson`
              );
              const data = await response.json();
              
              if (data.routes && data.routes[0] && data.routes[0].geometry && data.routes[0].geometry.coordinates) {
                // Extract coordinates from GeoJSON with better error handling
                const coordinates: [number, number][] = [];
                for (const coord of data.routes[0].geometry.coordinates) {
                  if (Array.isArray(coord) && coord.length >= 2) {
                    coordinates.push([coord[1], coord[0]]);
                  }
                }
                
                // Only add if we have valid coordinates
                if (coordinates.length > 0) {
                  tripRoutes.push({
                    pickup: locations[i],
                    dropoff: dropoff,
                    coordinates: coordinates
                  });
                } else {
                  // Fallback to straight line if no valid coordinates
                  tripRoutes.push({
                    pickup: locations[i],
                    dropoff: dropoff,
                    coordinates: [
                      [locations[i].lat, locations[i].lng],
                      [dropoff.lat, dropoff.lng]
                    ]
                  });
                }
              } else {
                throw new Error('Invalid route data structure');
              }
            } catch (error) {
              console.error('Error fetching trip route:', error);
              // Fallback to straight line if route fetch fails
              tripRoutes.push({
                pickup: locations[i],
                dropoff: dropoff,
                coordinates: [
                  [locations[i].lat, locations[i].lng],
                  [dropoff.lat, dropoff.lng]
                ]
              });
            }
          }
        }
      }
      
      setRoutes(tripRoutes);
    };

    if (locations.length > 0) {
      fetchTripRoutes();
    }
  }, [locations]);

  // Fetch main route using OSRM
  useEffect(() => {
    const fetchRoute = async () => {
      try {
        const waypoints = createWaypoints(locations);
        const response = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${waypoints}?overview=full&geometries=geojson`
        );
        const data = await response.json();
        if (data.routes && data.routes[0]) {
          setRouteGeometry(data.routes[0].geometry);
        }
      } catch (error) {
        console.error('Error fetching route:', error);
      }
    };

    if (locations.length > 0) {
      fetchRoute();
    }
  }, [locations]);

  const handleTripClick = (tripId: number) => {
    setActiveTrip(prevId => prevId === tripId ? null : tripId);
    
    const pickup = locations.find(loc => loc.tripId === tripId && loc.type === 'pickup');
    const dropoff = locations.find(loc => loc.tripId === tripId && loc.type === 'dropoff');
    
    if (pickup && dropoff && mapRef.current) {
      // Get map bounds for pickup and dropoff
      const bounds = [
        [pickup.lat, pickup.lng],
        [dropoff.lat, dropoff.lng]
      ];
      
      // Get map from ref
      const map = mapRef.current;
      
      // Set bounds with some padding
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  };

  // Handle map clicks for location selection
  const handleLocationSelected = (lat: number, lng: number) => {
    // Set the temporary marker at the clicked location
    setTempMarker({ lat, lng });
    
    // Log to verify marker was set
    console.log("Setting temporary marker at:", lat, lng);
    
    // Call the callback with the selected location
    if (onLocationSelected) {
      onLocationSelected(lat, lng);
    }
    
    // If we have a map reference, pan to the selected location
    if (mapRef.current) {
      mapRef.current.panTo([lat, lng]);
    }
  };

  // Get the most recent location
  const mostRecentLocation = getMostRecentLocation();

  return (
    <div className="relative h-full rounded-lg overflow-hidden">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={12}
        className="h-full w-full rounded-lg z-0"
        ref={mapRef}
      >
        <TileLayer
          url={darkMode 
            ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          }
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        {/* Add location selector when in selection mode */}
        {isSelectionMode && onLocationSelected && (
          <LocationSelector onLocationSelected={handleLocationSelected} />
        )}
        
        {routeGeometry && !isSelectionMode && (
          <GeoJSON
            data={routeGeometry}
            style={{
              color: darkMode ? '#C084FC' : '#9333EA',
              weight: 3,
              opacity: 0.7
            }}
          />
        )}

        {/* Render each individual trip route */}
        {!isSelectionMode && routes.map((route, index) => {
          const isActive = activeTrip === null || activeTrip === route.pickup.tripId;
          return (
            <div key={route.pickup.tripId}>
              <Polyline
                positions={route.coordinates}
                pathOptions={{
                  color: isActive ? (darkMode ? '#C084FC' : '#9333EA') : (darkMode ? '#374151' : '#E9D5FF'),
                  weight: isActive ? 4 : 2,
                  opacity: isActive ? 0.8 : 0.4,
                  dashArray: '6 8',
                }}
                eventHandlers={{
                  click: () => handleTripClick(route.pickup.tripId)
                }}
              />
            </div>
          );
        })}

        {/* Render regular locations (excluding the most recent one) */}
        {!isSelectionMode && locations.map((location, index) => {
          // Skip the most recent location as it will be rendered with a different marker
          if (mostRecentLocation && location.lat === mostRecentLocation.lat && 
              location.lng === mostRecentLocation.lng) {
            return null;
          }
          
          return (
            <Marker
              key={`${location.tripId}-${location.type}`}
              position={[location.lat, location.lng]}
              icon={location.type === 'pickup' ? pickupIcon : dropoffIcon}
              eventHandlers={{
                click: () => handleTripClick(location.tripId)
              }}
            >
              <Popup className={darkMode ? 'dark-popup' : ''}>
                <div className={`text-sm p-2 ${darkMode ? 'text-white' : ''}`}>
                  <div className="flex items-center space-x-2 mb-2">
                    <span className={`w-3 h-3 rounded-full ${location.type === 'pickup' ? 'bg-yellow-500' : 'bg-purple-500'}`} />
                    <span className="font-medium">
                      {location.type === 'pickup' ? 'Pick-up' : 'Drop-off'}
                    </span>
                  </div>
                  {location.time && <p className="text-sm mb-2">Time: {location.time}</p>}
                  {location.type === 'dropoff' && (
                    <p className="text-green-600 font-medium text-sm mb-2">Revenue: ${location.revenue.toFixed(2)}</p>
                  )}
                  <p className="text-xs mt-1 text-gray-500">
                    {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                  </p>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Render the most recent location with a blue marker */}
        {mostRecentLocation && (
          <Marker
            key={`most-recent-${mostRecentLocation.tripId}-${mostRecentLocation.type}`}
            position={[mostRecentLocation.lat, mostRecentLocation.lng]}
            icon={currentLocationIcon}
            zIndexOffset={1000} // Ensure this marker appears on top
          >
            <Popup className={darkMode ? 'dark-popup' : ''} autoClose={false}>
              <div className={`text-sm p-2 ${darkMode ? 'text-white' : ''}`}>
                <div className="flex items-center space-x-2 mb-2">
                  <span className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="font-medium">
                    {isSelectionMode ? 'Current Location' : 
                    (mostRecentLocation.type === 'pickup' ? 'Current Pickup Location' : 'Current Dropoff Location')}
                  </span>
                </div>
                {mostRecentLocation.time && <p className="text-sm mb-2">Time: {mostRecentLocation.time}</p>}
                {mostRecentLocation.type === 'dropoff' && mostRecentLocation.revenue > 0 && (
                  <p className="text-green-600 font-medium text-sm mb-2">Revenue: ${mostRecentLocation.revenue.toFixed(2)}</p>
                )}
                <p className="text-xs mt-1 text-gray-500">
                  {mostRecentLocation.lat.toFixed(4)}, {mostRecentLocation.lng.toFixed(4)}
                </p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Render custom dropoff locations */}
        {customDropoffs && customDropoffs.length > 0 && customDropoffs.map((dropoff) => (
          <Marker
            key={`custom-dropoff-${dropoff.id}`}
            position={[dropoff.lat, dropoff.lng]}
            icon={plannedDropoffIcon}
          >
            <Popup className={darkMode ? 'dark-popup' : ''} autoClose={false}>
              <div className={`text-sm p-2 ${darkMode ? 'text-white' : ''}`}>
                <div className="flex items-center space-x-2 mb-2">
                  <span className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="font-medium">
                    {dropoff.label}
                  </span>
                </div>
                <p className="text-xs mt-1 text-gray-500">
                  {dropoff.lat.toFixed(4)}, {dropoff.lng.toFixed(4)}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Show temporary marker when selecting a location */}
        {tempMarker && (
          <Marker
            position={[tempMarker.lat, tempMarker.lng]}
            icon={plannedDropoffIcon}
          >
            <Popup className={darkMode ? 'dark-popup' : ''} autoClose={false} closeOnClick={false}>
              <div className={`text-sm p-2 ${darkMode ? 'text-white' : ''}`}>
                <p className="font-medium mb-2">Selected Location</p>
                <p className="text-xs text-gray-500">
                  {tempMarker.lat.toFixed(4)}, {tempMarker.lng.toFixed(4)}
                </p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Sequential marker labels - Fixed to ensure they appear */}
        {!isSelectionMode && locations.map((location, index) => {
          // Skip the most recent location for numbered markers
          if (mostRecentLocation && location.lat === mostRecentLocation.lat && 
              location.lng === mostRecentLocation.lng) {
            return null;
          }
          
          // Create a DivIcon for this marker
          const markerLabel = createMarkerLabel(index, darkMode);
          
          return (
            <Marker
              key={`label-${location.tripId}-${location.type}-${index}`}
              position={[location.lat, location.lng]}
              icon={markerLabel}
              zIndexOffset={1000 + index} // High z-index to ensure visibility
            />
          );
        })}
      </MapContainer>

      {/* Selection mode indicator */}
      {isSelectionMode && (
        <div className={`absolute top-4 left-4 z-10 ${darkMode ? 'bg-purple-900' : 'bg-purple-600'} text-white px-4 py-2 rounded-full shadow-lg text-sm font-medium`}>
          Click on the map to select a drop-off location
        </div>
      )}

      {/* Reset view button - only show when not in selection mode */}
      {!isSelectionMode && locations.length > 0 && (
        <button 
          className={`absolute top-4 right-4 z-10 ${darkMode ? 'bg-gray-800 text-purple-300' : 'bg-white text-purple-700'} rounded-full px-4 py-2 text-xs font-medium shadow-lg hover:${darkMode ? 'bg-gray-700' : 'bg-purple-50'} transition-colors duration-200`}
          onClick={() => {
            setActiveTrip(null);
            if (mapRef.current) {
              const allCoordinates = locations.map(loc => [loc.lat, loc.lng]);
              mapRef.current.fitBounds(allCoordinates.length > 0 ? allCoordinates : [[1.3521, 103.8198]]);
            }
          }}
        >
          Reset View
        </button>
      )}
    </div>
  );
}