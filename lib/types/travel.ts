export type VisitType = "景点" | "美食" | "酒店" | "博物馆" | "购物" | "其他";

export interface Visit {
  visit_id: string;
  date: string;
  province: string;
  city: string;
  attraction: string;
  attraction_en?: string;
  type: VisitType | string;
  country: string;
  rating?: number;
  cost?: number;
  cost_currency?: string;
  thoughts?: string;
  highlights?: string;
  tips?: string;
  revisit?: number;
  created_at: string;
  updated_at: string;
}

export interface VisitImage {
  image_id: string;
  visit_id: string;
  oss_url: string;
  width?: number;
  height?: number;
  description?: string;
  created_at: string;
  /** Soft-delete marker (ISO timestamp). Present => hidden from listings. */
  deleted_at?: string;
}

export interface VisitWithImages extends Visit {
  images: VisitImage[];
}

export interface Flight {
  flight_id: string;
  flight_date: string;
  airline: string;
  flight_number: string;
  departure_city: string;
  departure_time?: string;
  arrival_city: string;
  arrival_time?: string;
  distance_km?: number;
  ticket_no?: string;
  status: string;
  created_at: string;
}

export interface Train {
  train_id: string;
  train_date: string;
  train_type?: string;
  train_number: string;
  departure_station: string;
  departure_time?: string;
  arrival_station: string;
  arrival_time?: string;
  duration_minutes?: number;
  seat_type?: string;
  ticket_no?: string;
  status: string;
  created_at: string;
}

export interface ProvinceStat {
  province: string;
  count: number;
}

export interface AirlineStat {
  airline: string;
  count: number;
  distanceKm: number;
}

export interface TrainTypeStat {
  trainType: string;
  count: number;
  durationMinutes: number;
}

export interface TravelStats {
  visits: {
    total: number;
    provinces: number;
    cities: number;
    countries: number;
    byProvince: ProvinceStat[];
    byType: { type: string; count: number }[];
  };
  flights: {
    total: number;
    totalDistanceKm: number;
    byAirline: AirlineStat[];
  };
  trains: {
    total: number;
    totalDurationMinutes: number;
    byType: TrainTypeStat[];
  };
}
