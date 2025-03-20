import { MapContainer, TileLayer, Marker, Popup, GeoJSON, Polyline, useMapEvents } from 'react-leaflet';
import { Icon, DivIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Location } from '../types';
import { useEffect, useState, useRef } from 'react';

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
}

// Create custom pickup icon
const pickupIcon = new Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Create custom dropoff icon
const dropoffIcon = new Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Create custom planned dropoff icon (for custom dropoffs)
const plannedDropoffIcon = new Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Location selection component that captures map clicks
function LocationSelector({ onLocationSelected }: { onLocationSelected: (lat: number, lng: number) => void }) {
  const map = useMapEvents({
    click: (e) => {
      onLocationSelected(e.latlng.lat, e.latlng.lng);
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
  customDropoffs = [] 
}: MapProps) {
  const center = locations.length > 0 ? locations[0] : { lat: 1.3521, lng: 103.8198 };
  const [routeGeometry, setRouteGeometry] = useState<any>(null);
  const [routes, setRoutes] = useState<Array<{ pickup: Location, dropoff: Location, coordinates: [number, number][] }>>([]);
  const [activeTrip, setActiveTrip] = useState<number | null>(null);
  const [tempMarker, setTempMarker] = useState<{lat: number, lng: number} | null>(null);
  const mapRef = useRef<any>(null);
  const tempMarkerRef = useRef<any>(null);

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
                // Extract coordinates from GeoJSON with better error handling - using alternative approach
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

  // Effect to open popup when tempMarker is set
  useEffect(() => {
    if (tempMarker && tempMarkerRef.current) {
      // Access the underlying Leaflet marker and open its popup
      const leafletElement = tempMarkerRef.current;
      if (leafletElement && leafletElement.leafletElement) {
        setTimeout(() => {
          leafletElement.leafletElement.openPopup();
        }, 100);
      }
    }
  }, [tempMarker]);

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

  const createMarkerLabel = (index: number) => {
    return new DivIcon({
      html: `<div style="background-color: ${darkMode ? '#1F2937' : 'white'}; 
                      color: ${darkMode ? 'white' : 'black'}; 
                      border: 1px solid ${darkMode ? '#374151' : '#D1D5DB'};
                      border-radius: 4px;
                      padding: 2px 6px;
                      font-size: 10px;
                      font-weight: bold;
                      box-shadow: 0 1px 3px rgba(0,0,0,0.2);">
              ${index + 1}
             </div>`,
      className: '',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });
  };

  // Handle map clicks for location selection
  const handleLocationSelected = (lat: number, lng: number) => {
    // Set temporary marker
    setTempMarker({ lat, lng });
    
    // Call the callback with the selected location
    if (onLocationSelected) {
      onLocationSelected(lat, lng);
    }
  };

  return (
    <div className="relative h-full">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={12}
        className="h-full w-full rounded-lg"
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
              color: darkMode ? '#60A5FA' : '#2563EB',
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
                  color: isActive ? (darkMode ? '#10B981' : '#059669') : (darkMode ? '#374151' : '#D1D5DB'),
                  weight: isActive ? 3 : 2,
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

        {/* Render regular locations when not in selection mode */}
        {!isSelectionMode && locations.map((location, index) => (
          <Marker
            key={`${location.tripId}-${location.type}`}
            position={[location.lat, location.lng]}
            icon={location.type === 'pickup' ? pickupIcon : dropoffIcon}
            eventHandlers={{
              click: () => handleTripClick(location.tripId)
            }}
          >
            <Popup className={darkMode ? 'dark-popup' : ''}>
              <div className={`text-sm p-1 rounded-lg`}>
                <div className="flex items-center space-x-2 mb-2">
                  <span className={`w-2 h-2 rounded-full ${location.type === 'pickup' ? 'bg-green-500' : 'bg-blue-500'}`} />
                  <span className="font-medium">
                    {location.type === 'pickup' ? 'Pick-up' : 'Drop-off'}
                  </span>
                </div>
                <p className="text-sm mb-1">Time: {location.time}</p>
                {location.type === 'dropoff' && (
                  <p className="text-green-600 font-medium text-sm">Revenue: ${location.revenue.toFixed(2)}</p>
                )}
                <p className="text-xs mt-2">
                  {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Render custom dropoff locations */}
        {customDropoffs.map((dropoff) => (
          <Marker
            key={`custom-dropoff-${dropoff.id}`}
            position={[dropoff.lat, dropoff.lng]}
            icon={plannedDropoffIcon}
          >
            <Popup className={darkMode ? 'dark-popup' : ''}>
              <div className={`text-sm p-1 rounded-lg`}>
                <div className="flex items-center space-x-2 mb-2">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="font-medium">
                    Custom Drop-off
                  </span>
                </div>
                <p className="text-sm mb-1">{dropoff.label}</p>
                <p className="text-xs mt-2">
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
            ref={tempMarkerRef}
          >
            <Popup className={darkMode ? 'dark-popup' : ''}>
              <div className={`text-sm p-1 rounded-lg`}>
                <p className="font-medium">Selected Location</p>
                <p className="text-xs mt-1">
                  {tempMarker.lat.toFixed(4)}, {tempMarker.lng.toFixed(4)}
                </p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Sequential marker labels */}
        {!isSelectionMode && locations.map((location, index) => (
          <Marker
            key={`label-${location.tripId}-${location.type}`}
            position={[location.lat, location.lng]}
            icon={createMarkerLabel(index)}
            zIndexOffset={1000}
          />
        ))}
      </MapContainer>

      {/* Selection mode indicator */}
      {isSelectionMode && (
        <div className={`absolute top-4 left-4 z-10 ${darkMode ? 'bg-blue-900' : 'bg-blue-600'} text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium`}>
          Click on the map to select a drop-off location
        </div>
      )}

      {/* Trip selection legend - only show when not in selection mode */}
      {!isSelectionMode && routes.length > 0 && (
        <div className={`absolute bottom-4 left-4 z-10 ${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg p-2 shadow-lg`}>
          <div className="text-xs font-medium mb-1.5">Trip Selection:</div>
          {routes.map((route, index) => (
            <div 
              key={route.pickup.tripId}
              className={`text-xs flex items-center space-x-1 py-0.5 cursor-pointer transition-colors duration-200 ${
                activeTrip === route.pickup.tripId 
                  ? (darkMode ? 'text-green-400' : 'text-green-600')
                  : (darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-600 hover:text-gray-800')
              }`}
              onClick={() => handleTripClick(route.pickup.tripId)}
            >
              <div className={`w-2 h-2 rounded-full ${
                activeTrip === route.pickup.tripId 
                  ? (darkMode ? 'bg-green-400' : 'bg-green-600')
                  : (darkMode ? 'bg-gray-500' : 'bg-gray-400')
              }`} />
              <span>Trip {index + 1}: {route.pickup.time} → {route.dropoff.time}</span>
            </div>
          ))}
        </div>
      )}

      {/* Reset view button - only show when not in selection mode */}
      {!isSelectionMode && locations.length > 0 && (
        <button 
          className={`absolute top-4 right-4 z-10 ${darkMode ? 'bg-gray-800 text-blue-400' : 'bg-white text-blue-600'} rounded-lg px-3 py-1.5 text-xs font-medium shadow-lg hover:${darkMode ? 'bg-gray-700' : 'bg-blue-50'} transition-colors duration-200`}
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