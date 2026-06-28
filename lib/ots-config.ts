import type { MovieStats } from "@/lib/types/movie";

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
