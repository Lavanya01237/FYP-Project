import { useState } from 'react';
import { Clock, MapPin } from 'lucide-react';

interface RouteFormProps {
  onSubmit: (data: { lat: number; lng: number; startTime: number }) => void;
  isLoading?: boolean;
}

export function RouteForm({ onSubmit, isLoading }: RouteFormProps) {
  const [lat, setLat] = useState<number>(1.3521);
  const [lng, setLng] = useState<number>(103.8198);
  const [startTime, setStartTime] = useState<number>(7);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ lat, lng, startTime });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-lg shadow-md">
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Starting Location</label>
        <div className="flex gap-2">
          <div className="flex-1">
            <div className="relative">
              <MapPin className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              <input
                type="number"
                step="0.0001"
                placeholder="Latitude"
                value={lat}
                onChange={(e) => setLat(parseFloat(e.target.value))}
                className="pl-10 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex-1">
            <input
              type="number"
              step="0.0001"
              placeholder="Longitude"
              value={lng}
              onChange={(e) => setLng(parseFloat(e.target.value))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Start Time</label>
        <div className="relative">
          <Clock className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          <select
            value={startTime}
            onChange={(e) => setStartTime(parseInt(e.target.value, 10))}
            className="pl-10 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            {Array.from({ length: 15 }, (_, i) => i + 7).map((hour) => (
              <option key={hour} value={hour}>
                {hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Generating Route...' : 'Generate Route'}
      </button>
    </form>
  );
}
