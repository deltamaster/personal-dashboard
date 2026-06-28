export interface Movie {
  douban_subject_id: string;
  title_primary: string;
  title_alt?: string;
  intro?: string;
  user_rating: number;
  watched_date: string;
  movie_url?: string;
  poster_url?: string;
  comment_id?: string;
  release_year?: number;
  director?: string;
  actors?: string;
  country?: string;
  language?: string;
  duration_minutes?: number;
  genres?: string;
  created_at: string;
  updated_at: string;
}

export type MovieInput = Omit<Movie, "created_at" | "updated_at"> & {
  created_at?: string;
  updated_at?: string;
};

export interface DirectorStat {
  director: string;
  count: number;
  avgRating: number;
}

export interface MovieStats {
  total: number;
  byYear: { year: number; count: number }[];
  directors: DirectorStat[];
  fiveStar: Movie[];
}
