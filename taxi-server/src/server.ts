import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import axios from 'axios';
import { Route, Location } from './types';

const app = express();
app.use(cors());
app.use(express.json());

// Update the interface in server.ts
interface OptimizeRouteRequest {
  startLocation: {
    lat: number;
    lng: number;
  };
  startTime: number;
  endTime: number; 
  algorithm: 'reinforcement' | 'greedy';
  breakStartTime: number; // Add this
  breakEndTime: number;   // Add this
}

// NEW INTERFACES - ADD THESE HERE
// -----------------------------------
interface DropOffLocation {
  id: number;
  lat: number;
  lng: number;
  label: string;
  score?: number;
  revenue?: number;
  distance?: number;
  duration?: number;
  prediction?: number;
}

interface EvaluateDropOffsRequest {
  startLocation: {
    lat: number;
    lng: number;
  };
  dropOffLocations: DropOffLocation[];
  currentTime: number; // Hour (0-23)
  breakStartTime: number; // Add break time parameters 
  breakEndTime: number;
}

interface RecommendPickupsRequest {
  dropOffLocation: {
    lat: number;
    lng: number;
  };
  currentTime: number; // Hour (0-23)
  breakStartTime: number; // Add break time parameters
  breakEndTime: number;
}
// -----------------------------------

// Add your DataRow interface here
interface DataRow {
  week: number;
  dayofweek: number;
  time_window: number;
  LONGITUDE: number;
  LATITUDE: number;
  demand: number;
  supply: number;
  hour: number;
  predictions: number;
  drop_grouped_points: any[];
  // Add other fields as needed
}

// Load and parse CSV data
const csvData = fs.readFileSync(path.join(__dirname, '../data/merged_df_new.csv'), 'utf8');
const records = parse(csvData, {
  columns: true,
  skip_empty_lines: true,
  cast: (value, context) => {
    if (context.header) return value;
    return context.column === 'drop_grouped_points' ? JSON.parse(value || '[]') : Number(value);
  }
});

// Add drop_grouped_points to the data based on demand-supply gaps
const processedData = records.map((record: any) => {
  // Generate drop-off points based on the prediction value
  // Negative predictions mean more supply than demand (good drop-off locations)
  const dropOffPoints = [];
  
  if (record.predictions < 0) {
    // This location has more supply than demand - good for drop-offs
    // The more negative the prediction, the more drop-off points we generate
    const numPoints = Math.min(Math.ceil(Math.abs(record.predictions)), 5);
    
    for (let i = 0; i < numPoints; i++) {
      // Generate points slightly offset from the current location
      const offsetLat = record.LATITUDE + (Math.random() - 0.5) * 0.01;
      const offsetLng = record.LONGITUDE + (Math.random() - 0.5) * 0.01;
      dropOffPoints.push([offsetLat, offsetLng] as [number, number]);
    }
  }
  
  return {
    ...record,
    drop_grouped_points: dropOffPoints.length > 0 ? dropOffPoints : [0]
  };
});

// Helper function to calculate distance between two points (haversine formula)
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

// OSRM Connection - to get route information from OSRM server
class OSRMConnection {
  private baseUrl: string;
  
  constructor(host = 'router.project-osrm.org', port?: string) {
    this.baseUrl = port ? 
      `http://${host}:${port}/route/v1/driving/` : 
      `https://${host}/route/v1/driving/`;
  }
  
  async routeDistTime(lon1: number, lat1: number, lon2: number, lat2: number) {
    try {
      const url = `${this.baseUrl}${lon1},${lat1};${lon2},${lat2}?overview=full`;
      const response = await axios.get(url);
      const data = response.data;
      
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        return {
          distance: route.distance,
          duration: route.duration,
          geometry: route.geometry
        };
      }
    } catch (error) {
      console.error('Error fetching route:', error);
    }
    
    // Return an estimated distance/duration if OSRM fails
    const distKm = calculateDistance(lat1, lon1, lat2, lon2);
    return {
      distance: distKm * 1000, // Convert to meters
      duration: distKm * 120, // Roughly 30 km/h speed (120 seconds per km)
      geometry: null
    };
  }
}

// Helper function to format time
function formatTime(hour: number, minutes: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const formattedHour = hour % 12 || 12;
  return `${formattedHour}:${minutes.toString().padStart(2, '0')} ${period}`;
}

// Helper function to calculate total driving time correctly
function calculateTotalDrivingTime(locations: Location[]): number {
  if (locations.length <= 1) return 0;
  
  // Calculate the time difference between first and last locations
  const firstTime = locations[0].time;
  const lastTime = locations[locations.length - 1].time;
  
  // Parse the times
  const firstTimeParts = firstTime.split(':');
  const firstHour = parseInt(firstTimeParts[0]);
  const firstMinutes = parseInt(firstTimeParts[1].split(' ')[0]);
  const firstIsPM = firstTime.includes('PM') && firstHour !== 12;
  
  const lastTimeParts = lastTime.split(':');
  const lastHour = parseInt(lastTimeParts[0]);
  const lastMinutes = parseInt(lastTimeParts[1].split(' ')[0]);
  const lastIsPM = lastTime.includes('PM') && lastHour !== 12;
  
  // Convert to 24-hour format
  const firstHour24 = firstIsPM ? firstHour + 12 : (firstHour === 12 && !firstIsPM ? 0 : firstHour);
  const lastHour24 = lastIsPM ? lastHour + 12 : (lastHour === 12 && !lastIsPM ? 0 : lastHour);
  
  // Calculate total minutes
  const firstTotalMinutes = firstHour24 * 60 + firstMinutes;
  const lastTotalMinutes = lastHour24 * 60 + lastMinutes;
  
  // Get the difference in hours
  const diffMinutes = lastTotalMinutes - firstTotalMinutes;
  
  // Handle cases where the trip goes past midnight
  const totalMinutes = diffMinutes < 0 ? diffMinutes + 24 * 60 : diffMinutes;
  
  // Convert to hours with one decimal place
  return Math.round(totalMinutes / 6) / 10;
}

// Calculate revenue based on distance
function calculateRevenue(distanceM: number): number {
  const distanceKm = distanceM / 1000;
  return 4.5 + (distanceKm * 0.70);
}

// Implementation of the Reinforcement Learning approach
class ReinforcementLearningAlgorithm {
  private data: any[];
  private osrm: OSRMConnection;
  private qTable: Map<string, Map<string, number>>;
  private locationMapping: Map<string, [number, number]>;
  
  constructor(data: any[], osrm: OSRMConnection) {
    this.data = data;
    this.osrm = osrm;
    this.qTable = new Map();
    this.locationMapping = new Map();
    
    // Train the model with a small number of episodes
    this.train(50);
  }
  
  private getGridCell(latitude: number, longitude: number): [number, number] {
    // Define the boundaries of the grid based on Singapore's coordinates
    const latMin = 1.2;
    const latMax = 1.5;
    const lonMin = 103.6;
    const lonMax = 104.1;
    const gridSize = 20;
    
    const gridX = Math.min(gridSize - 1, 
      Math.max(0, Math.floor((latitude - latMin) / (latMax - latMin) * gridSize)));
    const gridY = Math.min(gridSize - 1, 
      Math.max(0, Math.floor((longitude - lonMin) / (lonMax - lonMin) * gridSize)));
    
    return [gridX, gridY];
  }
  
  private getState(latitude: number, longitude: number, hour: number): string {
    const [gridX, gridY] = this.getGridCell(latitude, longitude);
    return `${gridX},${gridY},${hour}`;
  }
  
  private getPossibleActions(state: string): string[] {
    const [gridX, gridY, hour] = state.split(',').map(Number);
    
    const hourData = this.data.filter((row: DataRow) => row.hour === hour);

    const validPickupLocations = hourData.filter((row: DataRow) => 
      row.drop_grouped_points && 
      Array.isArray(row.drop_grouped_points) &&
      row.drop_grouped_points.length > 0 &&
      row.drop_grouped_points[0] !== 0
    );
    
    let actions: string[] = [];
    
    if (validPickupLocations.length === 0) {
      // If no locations have drop-offs, use all locations in this hour
      hourData.forEach(row => {
        const gridCell = this.getGridCell(row.LATITUDE, row.LONGITUDE);
        const actionKey = `${gridCell[0]},${gridCell[1]}`;
        actions.push(actionKey);
        this.locationMapping.set(actionKey, [row.LATITUDE, row.LONGITUDE]);
      });
    } else {
      // Use locations that have drop-offs
      validPickupLocations.forEach(row => {
        const gridCell = this.getGridCell(row.LATITUDE, row.LONGITUDE);
        const actionKey = `${gridCell[0]},${gridCell[1]}`;
        actions.push(actionKey);
        this.locationMapping.set(actionKey, [row.LATITUDE, row.LONGITUDE]);
      });
    }
    
    // Remove duplicates
    return [...new Set(actions)];
  }
  
  async train(episodes: number) {
    console.log(`Starting RL training with ${episodes} episodes`);
    
    for (let episode = 0; episode < episodes; episode++) {
      // Randomly select starting point and hour
      const startHour = Math.floor(Math.random() * 24);
      const startData = this.data.filter(row => row.hour === startHour);
      
      if (startData.length === 0) continue;
      
      const startRow = startData[Math.floor(Math.random() * startData.length)];
      let currentLat = startRow.LATITUDE;
      let currentLon = startRow.LONGITUDE;
      let currentHour = startHour;
      
      // Run one episode
      for (let step = 0; step < 10; step++) {
        const currentState = this.getState(currentLat, currentLon, currentHour);
        const possibleActions = this.getPossibleActions(currentState);
        
        if (possibleActions.length === 0) break;
        
        // Epsilon-greedy policy
        let action;
        if (Math.random() < 0.5) {
          // Explore: choose random action
          action = possibleActions[Math.floor(Math.random() * possibleActions.length)];
        } else {
          // Exploit: choose best action based on Q-values
          const qValues: {[key: string]: number} = {};
          possibleActions.forEach(a => {
            const stateMap = this.qTable.get(currentState) || new Map();
            qValues[a] = stateMap.get(a) || 0.1;
          });
          
          const entries = Object.entries(qValues);
          action = entries.length > 0 ? 
            entries.reduce((a, b) => a[1] > b[1] ? a : b)[0] : 
            possibleActions[0];
        }
        
        const [pickupLat, pickupLon] = this.locationMapping.get(action) || [currentLat, currentLon];
        
        // Calculate time and distance to pickup
        const routeToPickup = await this.osrm.routeDistTime(currentLon, currentLat, pickupLon, pickupLat);
        
        if (!routeToPickup || routeToPickup.distance === Infinity) continue;
        
        // Calculate reward
        const reward = this.calculateReward(currentState, action, routeToPickup.distance);
        
        // Update Q-value
        const pickupTime = currentHour + (routeToPickup.duration / 3600);
        const nextHour = Math.floor(pickupTime) % 24;
        
        // Find drop-off location
        const nextState = this.getState(pickupLat, pickupLon, nextHour);
        const nextPossibleActions = this.getPossibleActions(nextState);
        
        // Get maximum Q-value for next state
        let maxNextQ = 0;
        if (nextPossibleActions.length > 0) {
          const nextStateMap = this.qTable.get(nextState) || new Map();
          maxNextQ = Math.max(...nextPossibleActions.map(a => nextStateMap.get(a) || 0.1));
        }
        
        // Get or create state map
        let stateMap = this.qTable.get(currentState);
        if (!stateMap) {
          stateMap = new Map();
          this.qTable.set(currentState, stateMap);
        }
        
        // Q-learning update rule
        const currentQ = stateMap.get(action) || 0.1;
        const learningRate = 0.1;
        const discountFactor = 0.9;
        stateMap.set(action, currentQ + learningRate * (reward + discountFactor * maxNextQ - currentQ));
        
        // Move to next state
        currentLat = pickupLat;
        currentLon = pickupLon;
        currentHour = nextHour;
      }
    }
    console.log("RL training completed");
  }
  
  private calculateReward(state: string, action: string, distanceToPickup: number): number {
    const [gridX, gridY, hour] = state.split(',').map(Number);
    const [nextGridX, nextGridY] = action.split(',').map(Number);
    
    // Get actual lat/long coordinates
    const currentCoords = this.locationMapping.get(`${gridX},${gridY}`);
    const nextCoords = this.locationMapping.get(action);
    
    if (!currentCoords || !nextCoords) return -10;
    
    // Calculate cost of moving to the pick-up (fuel cost per km)
    const movingCost = distanceToPickup / 1000 * 0.3;
    
    // Get demand-supply information at the next pick-up location
    const nextLocationData = this.data.filter(row => 
      row.hour === hour && 
      Math.round(row.LATITUDE * 100) === Math.round(nextCoords[0] * 100) && 
      Math.round(row.LONGITUDE * 100) === Math.round(nextCoords[1] * 100)
    );
    
    let demandSupplyFactor = 1.0;
    if (nextLocationData.length > 0) {
      const prediction = nextLocationData[0].predictions;
      if (prediction > 0) {
        demandSupplyFactor = 2.0 + Math.min(Math.abs(prediction), 3.0);
      } else {
        demandSupplyFactor = Math.max(0.5, 1.0 - Math.min(prediction, 0.5));
      }
    }
    
    // Final reward = Demand factor - Moving cost
    return demandSupplyFactor - movingCost;
  }
  
  getRecommendation(latitude: number, longitude: number, hour: number): [number, number] {
    const state = this.getState(latitude, longitude, hour);
    const possibleActions = this.getPossibleActions(state);
    
    if (possibleActions.length === 0) {
      return [latitude, longitude];  // Stay put if no actions available
    }
    
    // Get Q-values for possible actions
    const qValues: {[key: string]: number} = {};
    const stateMap = this.qTable.get(state) || new Map();
    possibleActions.forEach(a => {
      qValues[a] = stateMap.get(a) || 0.1;
    });
    
    // Use epsilon-greedy policy for recommendation
    let action;
    if (Math.random() < 0.1) {  // 10% exploration
      action = possibleActions[Math.floor(Math.random() * possibleActions.length)];
    } else if (Object.values(qValues).every(v => v <= 0)) {
      // If all Q-values are zero or negative, use demand prediction
      const locationData: [string, number][] = [];
      possibleActions.forEach(a => {
        const loc = this.locationMapping.get(a);
        if (!loc) return;
        
        const matchingRows = this.data.filter(row => 
          row.hour === hour && 
          Math.round(row.LATITUDE * 100) === Math.round(loc[0] * 100) && 
          Math.round(row.LONGITUDE * 100) === Math.round(loc[1] * 100)
        );
        
        const baseScore = stateMap.get(a) || 0;
        
        if (matchingRows.length > 0) {
          const prediction = matchingRows[0].predictions;
          const demandScore = prediction < 0 ? -prediction : 0;
          const finalScore = baseScore + demandScore * 0.5;
          locationData.push([a, finalScore]);
        } else {
          locationData.push([a, baseScore]);
        }
      });
      
      if (locationData.length > 0) {
        // Choose location with highest combined score
        action = locationData.reduce((max, current) => current[1] > max[1] ? current : max)[0];
      } else {
        // If no data available, choose randomly
        action = possibleActions[Math.floor(Math.random() * possibleActions.length)];
      }
    } else {
      // Use best Q-value
      const entries = Object.entries(qValues);
      action = entries.reduce((max, current) => current[1] > max[1] ? current : max)[0];
    }
    
    // Return actual coordinates
    return this.locationMapping.get(action) || [latitude, longitude];
  }
  
  // Update the findRoute method to include break time parameters
  async findRoute(
    startLat: number, 
    startLon: number, 
    startHour: number, 
    endHour: number,
    breakStartHour: number = 12,  // Default lunch break 12-1
    breakEndHour: number = 13
  ): Promise<Route> {
    const locations: Location[] = [];
    let currentLat = startLat;
    let currentLon = startLon;
    let currentTime = startHour;
    let currentMinutes = 0;
    let tripId = 1;
    let totalRevenue = 0;
    
    // Add initial location
    locations.push({
      lat: currentLat,
      lng: currentLon,
      type: 'pickup',
      time: formatTime(currentTime, currentMinutes),
      revenue: 0,
      tripId: 0  // Starting point has trip ID 0
    });
    
    while (currentTime < endHour) {
      // Skip during break time
      if (currentTime >= breakStartHour && currentTime < breakEndHour) {
        currentTime = breakEndHour;
        currentMinutes = 0;
        continue;
      }
      
      // Get drop-off location first
      const dropOffData = this.data.filter(row => 
        row.hour === currentTime &&
        Math.round(row.LATITUDE * 100) === Math.round(currentLat * 100) && 
        Math.round(row.LONGITUDE * 100) === Math.round(currentLon * 100)
      );
      
      let dropLat = currentLat;
      let dropLon = currentLon;
      let dropDistance = 0;
      let dropDuration = 0;
      let dropGeometry = null;
      
      if (dropOffData.length > 0 && dropOffData[0].drop_grouped_points && 
        Array.isArray(dropOffData[0].drop_grouped_points) && 
        !(dropOffData[0].drop_grouped_points.length === 1 && dropOffData[0].drop_grouped_points[0] === 0)) {
      
        const dropPoints = dropOffData[0].drop_grouped_points;
        
        if (dropPoints && dropPoints.length > 0 && dropPoints[0] !== 0) {
          // Find the best drop-off point
          let bestDrop = null;
          let bestScore = -Infinity;
          
          for (const point of dropPoints) {
            const [lat, lon] = point;
            
            // Calculate distance
            const route = await this.osrm.routeDistTime(currentLon, currentLat, lon, lat);
            
            if (!route || route.distance === Infinity) continue;
            
            // Calculate revenue
            const revenue = calculateRevenue(route.distance);
            
            // Get demand score
            const locationData = this.data.filter(row => 
              row.hour === currentTime &&
              Math.round(row.LATITUDE * 100) === Math.round(lat * 100) && 
              Math.round(row.LONGITUDE * 100) === Math.round(lon * 100)
            );
            
            let demandScore = 0;
            if (locationData.length > 0) {
              const prediction = locationData[0].predictions;
              demandScore = prediction < 0 ? -prediction : 0;
            }
            
            // Combined score
            const score = revenue * (1 + Math.max(0, demandScore));
            
            if (score > bestScore) {
              bestScore = score;
              bestDrop = { lat, lon, distance: route.distance, duration: route.duration, geometry: route.geometry };
            }
          }
          
          if (bestDrop) {
            dropLat = bestDrop.lat;
            dropLon = bestDrop.lon;
            dropDistance = bestDrop.distance;
            dropDuration = bestDrop.duration;
            dropGeometry = bestDrop.geometry;
          }
        }
      }
      
      // Calculate drop-off revenue
      const dropRevenue = dropDistance > 0 ? calculateRevenue(dropDistance) : 0;
      totalRevenue += dropRevenue;
      
      // Update time for drop-off, checking for break time crossing
      currentMinutes += Math.ceil(dropDuration / 60);  // Convert seconds to minutes
      while (currentMinutes >= 60) {
        currentTime++;
        currentMinutes -= 60;
        
        // Check if we entered break time
        if (currentTime >= breakStartHour && currentTime < breakEndHour) {
          currentTime = breakEndHour;
          currentMinutes = 0;
        }
      }
      
      // Add drop-off location
      if (dropDistance > 0) {
        locations.push({
          lat: dropLat,
          lng: dropLon,
          type: 'dropoff',
          time: formatTime(currentTime, currentMinutes),
          tripId,
          revenue: dropRevenue
        });
      }
      
      // If we've reached the end time, break
      if (currentTime >= endHour) {
        break;
      }
      
      // Get next pickup using RL
      const [nextLat, nextLon] = this.getRecommendation(dropLat, dropLon, currentTime);
      
      // Calculate time to reach next pickup
      const pickupRoute = await this.osrm.routeDistTime(dropLon, dropLat, nextLon, nextLat);
      
      if (!pickupRoute || pickupRoute.distance === Infinity) {
        // If we can't reach the next pickup, end the route
        break;
      }
      
      // Update time for pickup, checking for break time crossing
      currentMinutes += Math.ceil(pickupRoute.duration / 60);  // Convert seconds to minutes
      while (currentMinutes >= 60) {
        currentTime++;
        currentMinutes -= 60;
        
        // Check if we entered break time
        if (currentTime >= breakStartHour && currentTime < breakEndHour) {
          currentTime = breakEndHour;
          currentMinutes = 0;
        }
      }
      
      // Add pickup location
      locations.push({
        lat: nextLat,
        lng: nextLon,
        type: 'pickup',
        time: formatTime(currentTime, currentMinutes),
        tripId: tripId + 1,
        revenue: 0
      });
      
      // Update current location and trip id
      currentLat = nextLat;
      currentLon = nextLon;
      tripId++;
    }
    
    return {
      locations,
      totalRevenue,
      totalDrivingTime: calculateTotalDrivingTime(locations),
      breakTime: `${formatTime(breakStartHour, 0)} - ${formatTime(breakEndHour, 0)}`,
    };
  }
}

// Implementation of the Greedy Algorithm
class GreedyAlgorithm {
  private data: any[];
  private osrm: OSRMConnection;
  private chosenPickupsByHour: Map<number, Set<string>>;
  
  constructor(data: any[], osrm: OSRMConnection) {
    this.data = data;
    this.osrm = osrm;
    this.chosenPickupsByHour = new Map();
  }
  
  // Helper function to find nearest location in our dataset
  private getNearestLocation(lat: number, lon: number, hour: number): [number, number, number] {
    // Filter dataframe for the current hour
    const filteredData = this.data.filter(row => row.hour === hour);
    
    if (filteredData.length === 0) {
      // Fallback to the minimum hour if data not found
      const minHour = Math.min(...this.data.map(row => row.hour));
      return this.getNearestLocation(lat, lon, minHour);
    }
    
    // Calculate distances
    const withDistances = filteredData.map(row => {
      const distance = calculateDistance(lat, lon, row.LATITUDE, row.LONGITUDE);
      return { ...row, distance };
    });
    
    // Find the nearest location
    const nearest = withDistances.reduce((min, current) => 
      current.distance < min.distance ? current : min, { distance: Infinity });
    
    return [nearest.LATITUDE, nearest.LONGITUDE, nearest.predictions];
  }

  // Find the best drop-off location
  async getBestDropOffLocation(currentLat: number, currentLon: number, currentHour: number): Promise<any> {
    // Search for drop-off points in the current hour
    const currentHourData = this.data.filter(row => 
      row.hour === currentHour &&
      Math.round(row.LATITUDE * 100) === Math.round(currentLat * 100) && 
      Math.round(row.LONGITUDE * 100) === Math.round(currentLon * 100)
    );
    
    let dropOffLocations = null;
    
    if (currentHourData.length > 0) {
      dropOffLocations = currentHourData[0].drop_grouped_points;
    } else {
      // Search subsequent and previous hours if no drop-off points are found
      for (let hour = currentHour + 1; hour <= Math.max(...this.data.map(row => row.hour)); hour++) {
        const hourData = this.data.filter(row => 
          row.hour === hour &&
          Math.round(row.LATITUDE * 100) === Math.round(currentLat * 100) && 
          Math.round(row.LONGITUDE * 100) === Math.round(currentLon * 100)
        );
        
        if (hourData.length > 0) {
          dropOffLocations = hourData[0].drop_grouped_points;
          break;
        }
      }
      
      if (!dropOffLocations || 
        !Array.isArray(dropOffLocations) || 
        dropOffLocations.length === 0 || 
        (dropOffLocations.length === 1 && dropOffLocations[0] === 0)) {
        for (let hour = currentHour - 1; hour >= Math.min(...this.data.map(row => row.hour)); hour--) {
          const hourData = this.data.filter(row => 
            row.hour === hour &&
            Math.round(row.LATITUDE * 100) === Math.round(currentLat * 100) && 
            Math.round(row.LONGITUDE * 100) === Math.round(currentLon * 100)
          );
          
          if (hourData.length > 0) {
            dropOffLocations = hourData[0].drop_grouped_points;
            break;
          }
        }
      }
    }
        // If still no drop-off locations, find locations with positive predicted gap
        if (!dropOffLocations || 
          !Array.isArray(dropOffLocations) || 
          dropOffLocations.length === 0 || 
          (dropOffLocations.length === 1 && dropOffLocations[0] === 0)) {
          const potentialDropOffs = this.data.filter(row => 
            row.hour === currentHour && row.predictions > 0
          );
          
          if (potentialDropOffs.length > 0) {
            // Calculate distances
            const withRoutes = await Promise.all(potentialDropOffs.map(async row => {
              const route = await this.osrm.routeDistTime(currentLon, currentLat, row.LONGITUDE, row.LATITUDE);
              const distance = route ? route.distance : Infinity;
              return { ...row, distance, route };
            }));
            
            // Get closest drop-offs
            const closestDropOffs = withRoutes
              .filter(row => row.distance !== Infinity)
              .sort((a, b) => a.distance - b.distance)
              .slice(0, 20);
            
            if (closestDropOffs.length > 0) {
              // Randomly select one drop-off
              const selectedDropOff = closestDropOffs[Math.floor(Math.random() * closestDropOffs.length)];
              const dropOffLocation = [selectedDropOff.LATITUDE, selectedDropOff.LONGITUDE];
              const bestRevenue = calculateRevenue(selectedDropOff.distance);
              
              return {
                location: dropOffLocation,
                revenue: bestRevenue,
                distance: selectedDropOff.distance,
                duration: selectedDropOff.route.duration,
                geometry: selectedDropOff.route.geometry
              };
            }
          }
          
          // If still nothing found, stay at current location
          return {
            location: [currentLat, currentLon],
            revenue: 0,
            distance: 0,
            duration: 0,
            geometry: null
          };
        }
        // Calculate distances, durations, and revenues for all drop-off candidates
        const dropOffCandidates = [];
      
        for (const [lat, lon] of dropOffLocations) {
          const route = await this.osrm.routeDistTime(currentLon, currentLat, lon, lat);
          
          if (!route || route.distance === Infinity) {
            continue;
          }
          
          const revenue = calculateRevenue(route.distance);
          dropOffCandidates.push({
            location: [lat, lon],
            revenue,
            distance: route.distance,
            duration: route.duration,
            geometry: route.geometry
          });
        }
        
        // Select the drop-off location with maximum revenue
        if (dropOffCandidates.length > 0) {
          return dropOffCandidates.reduce((max, current) => 
            current.revenue > max.revenue ? current : max,
            dropOffCandidates[0] // Provide initial value here
          );
        }
        
        // If no drop-off candidates, return null or the current location
        return {
          location: [currentLat, currentLon],
          revenue: 0,
          distance: 0,
          duration: 0,
          geometry: null
        };
      }
      // Find the best pickup location
      async getBestPickupLocation(dropLat: number, dropLon: number, currentHour: number): Promise<any> {
        // Filter the data for the current hour
        const currentHourData = this.data.filter(row => row.hour === currentHour);
        
        // Initialize chosen pick-ups for the current hour if not already present
        if (!this.chosenPickupsByHour.has(currentHour)) {
          this.chosenPickupsByHour.set(currentHour, new Set());
        }
        
        const chosenPickups = this.chosenPickupsByHour.get(currentHour)!;
        
        // Exclude the drop-off location and previously chosen locations
        const availableLocations = currentHourData.filter(row => 
          !(Math.round(row.LATITUDE * 100) === Math.round(dropLat * 100) && 
            Math.round(row.LONGITUDE * 100) === Math.round(dropLon * 100)) &&
          !chosenPickups.has(`${row.LATITUDE},${row.LONGITUDE}`)
        );
        
        if (availableLocations.length === 0) {
          return null;
        }
        
        // Calculate distances and filter for positive predictions
        const withRoutes = await Promise.all(availableLocations.map(async row => {
          const route = await this.osrm.routeDistTime(dropLon, dropLat, row.LONGITUDE, row.LATITUDE);
          const distance = route ? route.distance : Infinity;
          return { ...row, distance, route };
        }));
        
        // Filter for positive predicted gap
        const positiveGapLocations = withRoutes.filter(row => row.predictions > 0 && row.distance !== Infinity);
        
        if (positiveGapLocations.length === 0) {
          // If no positive gap locations, use all available locations
          const closestLocations = withRoutes
            .filter(row => row.distance !== Infinity)
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 7);
          
          if (closestLocations.length === 0) {
            return null;
          }
          
          // Pick a random location from the closest
          const selectedLocation = closestLocations[Math.floor(Math.random() * closestLocations.length)];
          const coords = [selectedLocation.LATITUDE, selectedLocation.LONGITUDE];
          
          // Mark as chosen
          chosenPickups.add(`${coords[0]},${coords[1]}`);
          
          return {
            location: coords,
            geometry: selectedLocation.route.geometry
          };
        }
        
        // Get the closest locations with positive gap
        const closestPositiveLocations = positiveGapLocations
          .sort((a, b) => a.distance - b.distance)
          .slice(0, 7);
        
        // Pick a random location from the closest
        const selectedLocation = closestPositiveLocations[Math.floor(Math.random() * closestPositiveLocations.length)];
        const coords = [selectedLocation.LATITUDE, selectedLocation.LONGITUDE];
        
        // Mark as chosen
        chosenPickups.add(`${coords[0]},${coords[1]}`);
        
        return {
          location: coords,
          geometry: selectedLocation.route.geometry
        };
      }
      
      // Update findRoute method to include break time parameters
      async findRoute(
        startLat: number, 
        startLon: number, 
        startHour: number, 
        endHour: number,
        breakStartHour: number = 12,  // Default lunch break 12-1
        breakEndHour: number = 13
      ): Promise<Route> {
        const locations: Location[] = [];
        let currentLat = startLat;
        let currentLon = startLon;
        let currentTime = startHour;
        let currentMinutes = 0;
        let tripId = 1;
        let totalRevenue = 0;
        
        // Add initial location
        locations.push({
          lat: currentLat,
          lng: currentLon,
          type: 'pickup',
          time: formatTime(currentTime, currentMinutes),
          revenue: 0,
          tripId: 0  // Starting point has trip ID 0
        });
        
        while (currentTime < endHour) {
          // Skip during break time
          if (currentTime >= breakStartHour && currentTime < breakEndHour) {
            currentTime = breakEndHour;
            currentMinutes = 0;
            continue;
          }
          
          // Find best drop-off location
          const dropOffResult = await this.getBestDropOffLocation(currentLat, currentLon, currentTime);
          
          if (dropOffResult && dropOffResult.distance > 0) {
            const [dropLat, dropLon] = dropOffResult.location;
            totalRevenue += dropOffResult.revenue;
            
            // Update time for drop-off, checking for break time
            currentMinutes += Math.ceil(dropOffResult.duration / 60);
            while (currentMinutes >= 60) {
              currentTime++;
              currentMinutes -= 60;
              
              // Check if we entered break time
              if (currentTime >= breakStartHour && currentTime < breakEndHour) {
                currentTime = breakEndHour;
                currentMinutes = 0;
              }
            }
            
            // Add drop-off location
            locations.push({
              lat: dropLat,
              lng: dropLon,
              type: 'dropoff',
              time: formatTime(currentTime, currentMinutes),
              tripId,
              revenue: dropOffResult.revenue
            });
            
            // Update current location
            currentLat = dropLat;
            currentLon = dropLon;
          }
          
          // If we've reached the end time, break
          if (currentTime >= endHour) {
            break;
          }
          
          // Find best pickup location
          const pickupResult = await this.getBestPickupLocation(currentLat, currentLon, currentTime);
          
          if (!pickupResult) {
            // If no pickup location found, try the next hour
            currentTime++;
            continue;
          }
          
          const [pickupLat, pickupLon] = pickupResult.location;
          
          // Calculate time to pickup
          const pickupRoute = await this.osrm.routeDistTime(currentLon, currentLat, pickupLon, pickupLat);
          
          if (!pickupRoute || pickupRoute.distance === Infinity) {
            // If we can't reach the pickup, try another hour
            currentTime++;
            continue;
          }
          
          // Update time for pickup, checking for break time
          currentMinutes += Math.ceil(pickupRoute.duration / 60);
          while (currentMinutes >= 60) {
            currentTime++;
            currentMinutes -= 60;
            
            // Check if we entered break time
            if (currentTime >= breakStartHour && currentTime < breakEndHour) {
              currentTime = breakEndHour;
              currentMinutes = 0;
            }
          }
          
          // Add pickup location
          locations.push({
            lat: pickupLat,
            lng: pickupLon,
            type: 'pickup',
            time: formatTime(currentTime, currentMinutes),
            tripId: tripId + 1,
            revenue: 0
          });
          
          // Update current location and trip id
          currentLat = pickupLat;
          currentLon = pickupLon;
          tripId++;
        }
        
        return {
          locations,
          totalRevenue,
          totalDrivingTime: calculateTotalDrivingTime(locations),
          breakTime: `${formatTime(breakStartHour, 0)} - ${formatTime(breakEndHour, 0)}`
        };
      }
    }
    
    // Initialize the OSRM connection with your local server
    const osrm = new OSRMConnection('localhost', '5001');
    let reinforcementAlgorithm: ReinforcementLearningAlgorithm | null = null;
    let greedyAlgorithm: GreedyAlgorithm | null = null;
    
    // Update the route handler to include break time parameters
    app.post('/api/optimize-route', async (req: express.Request, res: express.Response) => {
      const { 
        startLocation, 
        startTime, 
        endTime, 
        algorithm = 'reinforcement',
        breakStartTime = 12,  // Default lunch break
        breakEndTime = 13
      }: OptimizeRouteRequest = req.body;
      
      try {
        // Initialize algorithms on first request
        if (!reinforcementAlgorithm) {
          reinforcementAlgorithm = new ReinforcementLearningAlgorithm(processedData, osrm);
        }
        
        if (!greedyAlgorithm) {
          greedyAlgorithm = new GreedyAlgorithm(processedData, osrm);
        }
        
        let optimizedRoute: Route;
        
        if (algorithm === 'greedy') {
          console.log(`Using greedy algorithm from ${startTime} to ${endTime} with break ${breakStartTime}-${breakEndTime}`);
          optimizedRoute = await greedyAlgorithm.findRoute(
            startLocation.lat,
            startLocation.lng,
            startTime,
            endTime,
            breakStartTime,
            breakEndTime
          );
        } else {
          console.log(`Using reinforcement learning algorithm from ${startTime} to ${endTime} with break ${breakStartTime}-${breakEndTime}`);
          optimizedRoute = await reinforcementAlgorithm.findRoute(
            startLocation.lat,
            startLocation.lng,
            startTime,
            endTime,
            breakStartTime,
            breakEndTime
          );
        }
        
        // Before sending the response, update the trip count to match
        // First, count the actual trips (each trip has a pickup and dropoff)
        const allTripIds = optimizedRoute.locations
          .filter(loc => loc.type === 'dropoff')
          .map(loc => loc.tripId);
        
        // Update the tripCount in the route summary to be accurate
        optimizedRoute.tripCount = allTripIds.length;
        
        res.json(optimizedRoute);
      } catch (error) {
        console.error('Error generating route:', error);
        res.status(500).json({ error: 'Failed to generate route' });
      }
    });
    
    // Update the other API endpoints to include break time parameters
    // -----------------------------------
    /**
     * Endpoint to evaluate potential drop-off locations
     * Takes driver-inputted drop-off locations and evaluates them using the RL algorithm
     */
    app.post('/api/evaluate-drop-offs', async (req: express.Request, res: express.Response) => {
      const { 
        startLocation, 
        dropOffLocations, 
        currentTime,
        breakStartTime = 12,  // Default break time
        breakEndTime = 13
      }: EvaluateDropOffsRequest = req.body;
      
      try {
        // Initialize RL algorithm if not already done
        if (!reinforcementAlgorithm) {
          reinforcementAlgorithm = new ReinforcementLearningAlgorithm(processedData, osrm);
        }
        
        const hour = currentTime;
        const startLat = startLocation.lat;
        const startLng = startLocation.lng;
        
        console.log(`Evaluating ${dropOffLocations.length} drop-off locations from (${startLat}, ${startLng}) at hour ${hour}`);
        
        // Evaluate each drop-off location
        const evaluatedLocations = await Promise.all(dropOffLocations.map(async (location) => {
          const dropLat = location.lat;
          const dropLng = location.lng;
          const locationId = location.id;
          
          try {
            // Get route information using OSRM
            const route = await osrm.routeDistTime(startLng, startLat, dropLng, dropLat);
            
            if (!route || route.distance === Infinity) {
              throw new Error('Unable to route to this location');
            }
            
            // Calculate revenue based on distance
            const revenue = calculateRevenue(route.distance);
            
            // Find location-specific data from our dataset
            const locationData = processedData.filter((row:any) => 
              row.hour === hour &&
              Math.round(row.LATITUDE * 100) === Math.round(dropLat * 100) && 
              Math.round(row.LONGITUDE * 100) === Math.round(dropLng * 100)
            );
            
            // Get prediction value and calculate demand-supply factor
            let prediction = 0;
            let demandSupplyFactor = 1.0;
            
            if (locationData.length > 0) {
              prediction = locationData[0].predictions;
              
              // Use the same demand-supply calculation from your RL algorithm
              if (prediction > 0) {
                demandSupplyFactor = 2.0 + Math.min(Math.abs(prediction), 3.0);
              } else {
                demandSupplyFactor = Math.max(0.5, 1.0 - Math.min(prediction, 0.5));
              }
            }
            
            // Calculate moving cost (same as in calculateReward)
            const movingCost = route.distance / 1000 * 0.3;
            
            // Calculate score using the same logic as in calculateReward
            const score = demandSupplyFactor - movingCost;
            
            // Check if the arrival time would be during break time
            const estimatedDuration = Math.ceil(route.duration / 60); // minutes
            const estimatedTotalMinutes = hour * 60 + estimatedDuration;
            const estimatedHour = Math.floor(estimatedTotalMinutes / 60);
            const isDuringBreak = estimatedHour >= breakStartTime && estimatedHour < breakEndTime;
            
            console.log(`Evaluated location (${dropLat}, ${dropLng}): score=${score.toFixed(2)}, revenue=$${revenue.toFixed(2)}, during break: ${isDuringBreak}`);
            
            return {
              id: locationId,
              lat: dropLat,
              lng: dropLng,
              label: location.label || 'Drop-off',
              distance: route.distance / 1000, // Convert to km for display
              duration: route.duration,
              revenue,
              prediction,
              score: isDuringBreak ? -10 : score, // Penalize locations that would arrive during break
              isDuringBreak
            };
          } catch (error) {
            console.error(`Error evaluating drop-off location: ${error}`);
            // Return the location with minimal data if we can't route to it
            return {
              id: locationId,
              lat: dropLat,
              lng: dropLng,
              label: location.label || 'Drop-off',
              distance: 0,
              duration: 0,
              revenue: 0,
              prediction: 0,
              score: -1, // Negative score for unreachable locations
              isDuringBreak: false
            };
          }
        }));
        
        // Sort by score (highest first)
        const sortedLocations = evaluatedLocations.sort((a, b) => b.score - a.score);
        
        // Get the recommended location (highest score)
        let recommendedId = null;
        if (sortedLocations.length > 0 && sortedLocations[0].score > 0) {
          recommendedId = sortedLocations[0].id;
        }
        
        res.json({
          evaluatedLocations: sortedLocations,
          recommendedLocationId: recommendedId
        });
      } catch (error) {
        console.error('Error evaluating drop-off locations:', error);
        res.status(500).json({ error: 'Failed to evaluate drop-off locations' });
      }
    });
    
    /**
     * Endpoint to get recommended pickup locations
     * After a drop-off is selected, this endpoint recommends the next pickup locations
     */
    app.post('/api/recommend-pickups', async (req: express.Request, res: express.Response) => {
      const { 
        dropOffLocation, 
        currentTime,
        breakStartTime = 12,
        breakEndTime = 13 
      }: RecommendPickupsRequest = req.body;
      
      try {
        // Initialize RL algorithm if not already done
        if (!reinforcementAlgorithm) {
          reinforcementAlgorithm = new ReinforcementLearningAlgorithm(processedData, osrm);
        }
        
        const hour = currentTime;
        const dropLat = dropOffLocation.lat;
        const dropLng = dropOffLocation.lng;
        
        console.log(`Finding pickup recommendations from drop-off at (${dropLat}, ${dropLng}) at hour ${hour}`);
        
        // Skip if the current hour is during break time
        if (hour >= breakStartTime && hour < breakEndTime) {
          return res.json({
            recommendedPickups: [],
            primaryRecommendationId: null,
            isBreakTime: true,
            breakEndsAt: formatTime(breakEndTime, 0)
          });
        }
        
        // Use the RL algorithm to get the best pickup recommendation
        const [nextLat, nextLon] = reinforcementAlgorithm.getRecommendation(dropLat, dropLng, hour);
        
        // Get route information for the primary recommendation
        const pickupRoute = await osrm.routeDistTime(dropLng, dropLat, nextLon, nextLat);
        
        if (!pickupRoute || pickupRoute.distance === Infinity) {
          throw new Error('Unable to route to recommended pickup location');
        }
        
        // Check if the estimated arrival time would be during break time
        const estimatedDuration = Math.ceil(pickupRoute.duration / 60); // minutes
        const estimatedTotalMinutes = hour * 60 + estimatedDuration;
        const estimatedHour = Math.floor(estimatedTotalMinutes / 60);
        const isDuringBreak = estimatedHour >= breakStartTime && estimatedHour < breakEndTime;
        
        // If arrival would be during break, adjust the recommendation
        let adjustedDuration = pickupRoute.duration;
        let adjustedNextLat = nextLat;
        let adjustedNextLon = nextLon;
        
        if (isDuringBreak) {
          // Try to find an alternative that doesn't lead into break time
          const alternativeRecommendations = [];
          
          for (let i = 0; i < 5; i++) {
            const [altLat, altLon] = reinforcementAlgorithm.getRecommendation(dropLat, dropLng, hour);
            
            const altRoute = await osrm.routeDistTime(dropLng, dropLat, altLon, altLat);
            if (altRoute && altRoute.distance !== Infinity) {
              const altDuration = Math.ceil(altRoute.duration / 60); // minutes
              const altTotalMinutes = hour * 60 + altDuration;
              const altHour = Math.floor(altTotalMinutes / 60);
              
              if (!(altHour >= breakStartTime && altHour < breakEndTime)) {
                adjustedDuration = altRoute.duration;
                adjustedNextLat = altLat;
                adjustedNextLon = altLon;
                break; // Found a good alternative
              }
            }
          }
        }
        
        // Get prediction data for the recommended location
        const locationData = processedData.filter((row:any) => 
          row.hour === hour &&
          Math.round(row.LATITUDE * 100) === Math.round(adjustedNextLat * 100) && 
          Math.round(row.LONGITUDE * 100) === Math.round(adjustedNextLon * 100)
        );
        
        let prediction = 0;
        if (locationData.length > 0) {
          prediction = locationData[0].predictions;
        }
        
        // Create the primary recommendation
        const recommendedPickups = [{
          id: 1, // Use ID 1 for the primary recommendation
          lat: adjustedNextLat,
          lng: adjustedNextLon,
          label: 'Primary Pickup',
          distance: pickupRoute.distance / 1000, // Convert to km for display
          duration: adjustedDuration,
          prediction,
          score: 1.0, // Highest score for primary recommendation
          wouldCrossBreakTime: isDuringBreak
        }];
        
        console.log(`Primary recommendation: (${adjustedNextLat}, ${adjustedNextLon}), prediction=${prediction}`);
        
        // Find alternative pickup locations with high demand
        const demandLocations = processedData.filter((row: any) => 
          row.hour === hour && 
          row.predictions > 0 &&
          // Skip if too close to primary recommendation
          (Math.sqrt((row.LATITUDE - adjustedNextLat)**2 + (row.LONGITUDE - adjustedNextLon)**2) > 0.005)
        );
        
        // Sort by prediction value (highest demand first)
        demandLocations.sort((a:any, b:any) => b.predictions - a.predictions);
        
        // Find top alternative pickup locations
        const alternativePickups = await Promise.all(
          demandLocations.slice(0, 10).map(async (row: any) => {
            const altLat = row.LATITUDE;
            const altLng = row.LONGITUDE;
            
            try {
              // Calculate route to this location
              const route = await osrm.routeDistTime(dropLng, dropLat, altLng, altLat);
              
              if (!route || route.distance === Infinity || route.duration > 900) {
                // Skip if too far (more than 15 minutes drive)
                return null;
              }
              
              // Check if arrival would be during break time
              const altDuration = Math.ceil(route.duration / 60); // minutes
              const altTotalMinutes = hour * 60 + altDuration;
              const altHour = Math.floor(altTotalMinutes / 60);
              const altDuringBreak = altHour >= breakStartTime && altHour < breakEndTime;
              
              return {
                lat: altLat,
                lng: altLng,
                distance: route.distance,
                duration: route.duration,
                prediction: row.predictions,
                score: row.predictions - (route.distance / 10000), // Balance demand with distance
                wouldCrossBreakTime: altDuringBreak
              };
            } catch (error) {
              console.error('Error calculating route to alternative pickup:', error);
              return null;
            }
          })
        );
        
        // Filter out null values and sort by score
        const validAlternatives = alternativePickups
          .filter(pickup => pickup !== null)
          .sort((a, b) => b.score - a.score);
        
        // Add top alternatives to recommendations (max 3)
        validAlternatives.slice(0, 3).forEach((pickup, i) => {
          recommendedPickups.push({
            id: i + 2, // IDs 2, 3, 4
            lat: pickup.lat,
            lng: pickup.lng,
            label: `Alternative ${i+1}`,
            distance: pickup.distance / 1000, // Convert to km for display
            duration: pickup.duration,
            prediction: pickup.prediction,
            score: pickup.score,
            wouldCrossBreakTime: pickup.wouldCrossBreakTime
          });
          
          console.log(`Alternative ${i+1}: (${pickup.lat}, ${pickup.lng}), prediction=${pickup.prediction}`);
        });
        
        res.json({
          recommendedPickups,
          primaryRecommendationId: 1,
          isBreakTime: false
        });
      } catch (error) {
        console.error('Error generating pickup recommendations:', error);
        res.status(500).json({ error: 'Failed to generate pickup recommendations' });
      }
    });
    // -----------------------------------
    
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });