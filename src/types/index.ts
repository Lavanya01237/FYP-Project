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
}

export interface DynamicPricing {
  baseFare: number;
  ratePerKm: number;
  premiumFactor: number;
  demandSupplyGap: number;
}