import type { MovieStats } from "@/lib/types/movie";
import type { TravelStats } from "@/lib/types/travel";

export function isOtsConfigured(): boolean {
  return !!(
    process.env.ALIBABA_CLOUD_ACCESS_KEY_ID &&
    process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET &&
    process.env.OTS_ENDPOINT &&
    process.env.OTS_INSTANCE_NAME
  );
}

export const emptyMovieStats: MovieStats = {
  total: 0,
  byYear: [],
  directors: [],
  fiveStar: [],
};

export const emptyTravelStats: TravelStats = {
  visits: {
    total: 0,
    provinces: 0,
    cities: 0,
    countries: 0,
    byProvince: [],
    byType: [],
  },
  flights: { total: 0, totalDistanceKm: 0, byAirline: [] },
  trains: { total: 0, totalDurationMinutes: 0, byType: [] },
};
