import React, { useState } from 'react';
import { Map } from './components/Map';
import { RouteForm } from './components/RouteForm';
import { RouteSummary } from './components/RouteSummary';
import { Route } from './types';
import { Navigation } from 'lucide-react';

function App() {
  const [route, setRoute] = useState<Route | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRouteSubmit = async (data: { lat: number; lng: number; startTime: number }) => {
    try {
      setLoading(true);
      setError(null);
      
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
          startTime: data.startTime
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate route');
      }

      const optimizedRoute = await response.json();
      setRoute(optimizedRoute);
    } catch (err) {
      setError('Failed to generate route. Please try again.');
      console.error('Error generating route:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center">
            <Navigation className="h-10 w-10 text-blue-600 mr-4" />
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
              Taxi Route Optimizer
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-8">
            <RouteForm onSubmit={handleRouteSubmit} isLoading={loading} />
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}
            {route && <RouteSummary route={route} />}
          </div>
          <div className="lg:col-span-2">
            <div className="bg-white p-4 rounded-xl shadow-lg">
              {loading ? (
                <div className="h-[700px] flex items-center justify-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
              ) : route ? (
                <Map locations={route.locations} />
              ) : (
                <div className="h-[700px] flex items-center justify-center text-gray-500">
                  Enter a starting location and time to generate a route
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;