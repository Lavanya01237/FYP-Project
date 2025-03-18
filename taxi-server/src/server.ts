// server.ts
import express from 'express';
import cors from 'cors';
import { Route, Location } from './types';

const app = express();
app.use(cors());
app.use(express.json());

interface OptimizeRouteRequest {
  startLocation: {
    lat: number;
    lng: number;
  };
  startTime: number;
}

// Extended mock database with real Singapore locations and varied demand patterns
const potentialPickups = [
  // Central Business District
  { lat: 1.2789, lng: 103.8536, demand: 0.95 }, // Raffles Place
  { lat: 1.2819, lng: 103.8495, demand: 0.90 }, // Tanjong Pagar
  { lat: 1.2766, lng: 103.8458, demand: 0.85 }, // Marina Bay
  { lat: 1.2937, lng: 103.8521, demand: 0.88 }, // Clarke Quay
  { lat: 1.3006, lng: 103.8368, demand: 0.82 }, // Orchard

  // East
  { lat: 1.3187, lng: 103.8932, demand: 0.75 }, // Paya Lebar
  { lat: 1.3236, lng: 103.9273, demand: 0.70 }, // Tampines
  { lat: 1.3504, lng: 103.9496, demand: 0.72 }, // Pasir Ris
  { lat: 1.3236, lng: 103.9527, demand: 0.68 }, // Changi Business Park
  { lat: 1.3644, lng: 103.9915, demand: 0.85 }, // Changi Airport

  // North
  { lat: 1.3526, lng: 103.8352, demand: 0.65 }, // Ang Mo Kio
  { lat: 1.3696, lng: 103.8480, demand: 0.60 }, // Yio Chu Kang
  { lat: 1.3817, lng: 103.8451, demand: 0.62 }, // Yishun
  { lat: 1.4019, lng: 103.7855, demand: 0.55 }, // Woodlands
  { lat: 1.3857, lng: 103.7457, demand: 0.50 }, // Kranji

  // West
  { lat: 1.3162, lng: 103.7649, demand: 0.70 }, // Jurong East
  { lat: 1.3329, lng: 103.7436, demand: 0.65 }, // Jurong West
  { lat: 1.3115, lng: 103.7903, demand: 0.68 }, // Clementi
  { lat: 1.2959, lng: 103.7848, demand: 0.62 }, // Dover
  { lat: 1.3234, lng: 103.7652, demand: 0.60 }, // Boon Lay

  // North-East
  { lat: 1.3508, lng: 103.8723, demand: 0.75 }, // Serangoon
  { lat: 1.3604, lng: 103.8853, demand: 0.72 }, // Hougang
  { lat: 1.3721, lng: 103.8931, demand: 0.68 }, // Sengkang
  { lat: 1.3868, lng: 103.8940, demand: 0.65 }, // Punggol
  { lat: 1.3502, lng: 103.8931, demand: 0.70 }, // Kovan

  // Popular Areas
  { lat: 1.3006, lng: 103.8559, demand: 0.92 }, // Bugis
  { lat: 1.3016, lng: 103.8397, demand: 0.88 }, // Somerset
  { lat: 1.3099, lng: 103.8620, demand: 0.85 }, // Kallang
  { lat: 1.3138, lng: 103.8159, demand: 0.80 }, // Holland Village
  { lat: 1.2817, lng: 103.8428, demand: 0.82 }, // Marina Bay Sands

  // Shopping Centers
  { lat: 1.3338, lng: 103.8519, demand: 0.85 }, // NEX
  { lat: 1.3340, lng: 103.7452, demand: 0.80 }, // JEM/Westgate
  { lat: 1.2902, lng: 103.8520, demand: 0.88 }, // Suntec City
  { lat: 1.3009, lng: 103.8392, demand: 0.90 }, // ION Orchard
  { lat: 1.2935, lng: 103.8583, demand: 0.82 }, // Marina Square

  // Business Parks
  { lat: 1.2971, lng: 103.7874, demand: 0.75 }, // One North
  { lat: 1.3236, lng: 103.9527, demand: 0.78 }, // Changi Business Park
  { lat: 1.2988, lng: 103.7876, demand: 0.72 }, // Science Park
  { lat: 1.3165, lng: 103.7647, demand: 0.76 }, // International Business Park
  { lat: 1.3234, lng: 103.8901, demand: 0.74 }, // Tai Seng

  // Residential Areas
  { lat: 1.3290, lng: 103.8472, demand: 0.65 }, // Toa Payoh
  { lat: 1.3424, lng: 103.8530, demand: 0.62 }, // Bishan
  { lat: 1.3170, lng: 103.8810, demand: 0.60 }, // MacPherson
  { lat: 1.3490, lng: 103.8489, demand: 0.58 }, // Ang Mo Kio Central
  { lat: 1.3231, lng: 103.8466, demand: 0.55 }, // Whampoa

  // Entertainment Hubs
  { lat: 1.2580, lng: 103.8186, demand: 0.85 }, // Sentosa
  { lat: 1.2834, lng: 103.8607, demand: 0.82 }, // Esplanade
  { lat: 1.2911, lng: 103.8441, demand: 0.80 }, // Fort Canning
  { lat: 1.3039, lng: 103.8362, demand: 0.78 }, // Dhoby Ghaut
  { lat: 1.3138, lng: 103.7652, demand: 0.75 }  // Chinese Garden
];

// Dynamic demand adjustments based on time
function adjustDemand(baseDemand: number, hour: number): number {
  // Peak hours: 8-10 AM and 5-7 PM
  const morningPeak = hour >= 8 && hour <= 10;
  const eveningPeak = hour >= 17 && hour <= 19;
  
  if (morningPeak || eveningPeak) {
    return Math.min(baseDemand * 1.5, 1.0); // 50% increase during peak hours
  }
  
  // Lunch hours: 11 AM - 2 PM
  if (hour >= 11 && hour <= 14) {
    return Math.min(baseDemand * 1.3, 1.0); // 30% increase during lunch
  }
  
  // Late night: After 8 PM
  if (hour >= 20) {
    return baseDemand * 0.7; // 30% decrease late night
  }
  
  return baseDemand;
}

// Helper function to calculate distance between two points
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Helper function to format time
function formatTime(hour: number, minutes: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const formattedHour = hour % 12 || 12;
  return `${formattedHour}:${minutes.toString().padStart(2, '0')} ${period}`;
}

function generateOptimalRoute(startLat: number, startLng: number, startHour: number): Route {
  const locations: Location[] = [];
  let currentLat = startLat;
  let currentLng = startLng;
  let currentTime = startHour;
  let currentMinutes = 0;
  let tripId = 1;
  let totalRevenue = 0;

  while (currentTime < 21) { // Continue until 9 PM
    // Skip during break time (12 PM - 1 PM)
    if (currentTime === 12) {
      currentTime++;
      continue;
    }

    // Find nearest high-demand pickup point with time-adjusted demand
    const nextPickup = potentialPickups
      .map(loc => ({
        ...loc,
        distance: calculateDistance(currentLat, currentLng, loc.lat, loc.lng),
        adjustedDemand: adjustDemand(loc.demand, currentTime),
        score: adjustDemand(loc.demand, currentTime) / calculateDistance(currentLat, currentLng, loc.lat, loc.lng)
      }))
      .sort((a, b) => b.score - a.score)[0];

    // Calculate trip duration and revenue
    const pickupDistance = nextPickup.distance;
    const pickupDuration = Math.ceil(pickupDistance * 5); // 5 minutes per km
    currentMinutes += pickupDuration;
    
    // Adjust hour and minutes
    while (currentMinutes >= 60) {
      currentTime++;
      currentMinutes -= 60;
    }

    // Generate random dropoff point within reasonable distance
    const dropoffLat = nextPickup.lat + (Math.random() - 0.5) * 0.1;
    const dropoffLng = nextPickup.lng + (Math.random() - 0.5) * 0.1;
    const tripDistance = calculateDistance(nextPickup.lat, nextPickup.lng, dropoffLat, dropoffLng);
    const tripDuration = Math.ceil(tripDistance * 5);
    
    // Calculate revenue with surge pricing during peak hours
    const baseFare = 20;
    const farePerKm = 2;
    const peakMultiplier = adjustDemand(1.0, currentTime);
    const revenue = Math.round((baseFare + tripDistance * farePerKm) * peakMultiplier * 100) / 100;

    // Add pickup location
    locations.push({
      lat: nextPickup.lat,
      lng: nextPickup.lng,
      type: 'pickup',
      time: formatTime(currentTime, currentMinutes),
      tripId,
      revenue
    });

    // Update time for dropoff
    currentMinutes += tripDuration;
    while (currentMinutes >= 60) {
      currentTime++;
      currentMinutes -= 60;
    }

    // Add dropoff location
    locations.push({
      lat: dropoffLat,
      lng: dropoffLng,
      type: 'dropoff',
      time: formatTime(currentTime, currentMinutes),
      tripId,
      revenue
    });

    totalRevenue += revenue;
    tripId++;
    currentLat = dropoffLat;
    currentLng = dropoffLng;
  }

  return {
    locations,
    totalRevenue,
    totalDrivingTime: Math.round((currentTime - startHour + currentMinutes / 60) * 10) / 10,
    breakTime: '12:00 PM - 1:00 PM'
  };
}

app.post('/api/optimize-route', (req: express.Request, res: express.Response) => {
  const { startLocation, startTime }: OptimizeRouteRequest = req.body;
  
  try {
    const optimizedRoute = generateOptimalRoute(
      startLocation.lat,
      startLocation.lng,
      startTime
    );
    
    res.json(optimizedRoute);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate route' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});