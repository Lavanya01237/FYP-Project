import React, { useState } from 'react';
import { Map } from './components/Map';
import { RouteForm } from './components/RouteForm';
import { RouteSummary } from './components/RouteSummary';
import { Route } from './types';
import { Navigation, MoonIcon, SunIcon } from 'lucide-react';

function App() {
  const [route, setRoute] = useState<Route | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<'reinforcement' | 'greedy'>('reinforcement');

  const handleRouteSubmit = async (data: { lat: number; lng: number; startTime: number; endTime: number; algorithm: 'reinforcement' | 'greedy' }) => {
    try {
      setLoading(true);
      setError(null);
      setSelectedAlgorithm(data.algorithm);
      
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
          startTime: data.startTime,
          endTime: data.endTime,
          algorithm: data.algorithm
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

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'bg-gray-900 text-gray-100' : 'bg-gradient-to-br from-blue-50 to-indigo-100'}`}>
      <header className={`${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg transition-colors duration-300`}>
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Navigation className={`h-8 w-8 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} />
              <h1 className={`text-2xl font-bold tracking-tight ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                Taxi Route Optimizer
              </h1>
            </div>
            <button 
              onClick={toggleDarkMode}
              className={`p-2 rounded-full ${darkMode ? 'bg-gray-700 text-yellow-300' : 'bg-indigo-100 text-indigo-800'}`}
            >
              {darkMode ? <SunIcon size={20} /> : <MoonIcon size={20} />}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <RouteForm onSubmit={handleRouteSubmit} isLoading={loading} darkMode={darkMode} />
            
            {error && (
              <div className={`${darkMode ? 'bg-red-900 border-red-700' : 'bg-red-50 border-red-200'} border text-red-600 px-4 py-3 rounded-lg transition-all duration-300 animate-fadeIn`}>
                {error}
              </div>
            )}
            
            {route && <RouteSummary route={route} darkMode={darkMode} algorithm={selectedAlgorithm} />}
          </div>
          
          <div className="lg:col-span-2">
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} p-4 rounded-xl shadow-lg transition-colors duration-300 h-[700px]`}>
              {loading ? (
                <div className="h-full flex items-center justify-center">
                  <div className="flex flex-col items-center">
                    <div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${darkMode ? 'border-blue-400' : 'border-blue-600'}`}></div>
                    <p className={`mt-4 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Optimizing your route...</p>
                  </div>
                </div>
              ) : route ? (
                <Map locations={route.locations} darkMode={darkMode} />
              ) : (
                <div className="h-full flex flex-col items-center justify-center">
                  <Navigation className={`h-16 w-16 mb-4 ${darkMode ? 'text-gray-600' : 'text-gray-300'}`} />
                  <p className={`text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Enter a starting location and time<br />to generate an optimized taxi route
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      
      <footer className={`py-4 mt-8 ${darkMode ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'}`}>
        <div className="max-w-7xl mx-auto px-4 text-center text-sm">
          © {new Date().getFullYear()} Taxi Route Optimizer | Optimizing routes for maximum efficiency
        </div>
      </footer>
    </div>
  );
}

export default App;