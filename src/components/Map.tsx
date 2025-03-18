import { MapContainer, TileLayer, Marker, Popup, GeoJSON } from 'react-leaflet';
import { Icon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Location } from '../types';
import { useEffect, useState } from 'react';

interface MapProps {
  locations: Location[];
}

const pickupIcon = new Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const dropoffIcon = new Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function createWaypoints(locations: Location[]): string {
  return locations
    .map(loc => `${loc.lng},${loc.lat}`)
    .join(';');
}

export function Map({ locations }: MapProps) {
  const center = locations[0] || { lat: 1.3521, lng: 103.8198 };
  const [routeGeometry, setRouteGeometry] = useState<any>(null);

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

    fetchRoute();
  }, [locations]);

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={12}
      className="h-[700px] w-full rounded-lg"
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      
      {routeGeometry && (
        <GeoJSON
          data={routeGeometry}
          style={{
            color: '#2563eb',
            weight: 3,
            opacity: 0.7
          }}
        />
      )}

      {locations.map((location, index) => (
        <Marker
          key={index}
          position={[location.lat, location.lng]}
          icon={location.type === 'pickup' ? pickupIcon : dropoffIcon}
        >
          <Popup>
            <div className="text-sm bg-white p-2 rounded-lg shadow-sm">
              <div className="flex items-center space-x-2 mb-2">
                <span className={`w-2 h-2 rounded-full ${location.type === 'pickup' ? 'bg-green-500' : 'bg-blue-500'}`} />
                <span className="font-medium text-gray-800">
                  {location.type === 'pickup' ? 'Pick-up' : 'Drop-off'}
                </span>
              </div>
              <p className="text-gray-600 mb-1">Time: {location.time}</p>
              {location.type === 'dropoff' && (
                <p className="text-green-600 font-medium">Revenue: ${location.revenue.toFixed(2)}</p>
              )}
              <p className="text-gray-500 text-xs mt-2">
                {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
              </p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}