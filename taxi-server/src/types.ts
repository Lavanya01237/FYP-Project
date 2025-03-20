export interface Location {
  lat: number;
  lng: number;
  type: 'pickup' | 'dropoff';
  time: string;
  revenue: number;
  tripId: number;
}

export interface Route {
  locations: Location[];
  totalRevenue: number;
  totalDrivingTime: number;
  breakTime: string;
  tripCount?: number; // Make it optional with ?
}