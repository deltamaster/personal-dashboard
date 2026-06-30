import { computeMovieStats } from "@/lib/ots/movies";
import type { Movie, MovieStats } from "@/lib/types/movie";

const CREATED = "2024-06-01T00:00:00Z";

/** Dev/QA sample data — QA_DUMMY_DATA (any env) or MOVIES_DUMMY_DATA=1 (dev only). */
export function shouldUseMoviesDummyData(): boolean {
  if (process.env.QA_DUMMY_DATA === "1") return true;
  if (process.env.NODE_ENV !== "development") return false;
  return process.env.MOVIES_DUMMY_DATA === "1";
}

function mkMovie(m: Partial<Movie> & Pick<Movie, "douban_subject_id" | "title_primary" | "user_rating" | "watched_date">): Movie {
  return {
    movie_url: `https://movie.douban.com/subject/${m.douban_subject_id}/`,
    created_at: CREATED,
    updated_at: CREATED,
    ...m,
  } as Movie;
}

const dummyMovies: Movie[] = [
  mkMovie({
    douban_subject_id: "dummy-1292052",
    title_primary: "肖申克的救赎",
    title_alt: "The Shawshank Redemption",
    user_rating: 5,
    watched_date: "2024-05-10",
    release_year: 1994,
    director: "弗兰克·德拉邦特",
    country: "美国",
    language: "英语",
    duration_minutes: 142,
    genres: "剧情 / 犯罪",
  }),
  mkMovie({
    douban_subject_id: "dummy-1291546",
    title_primary: "霸王别姬",
    title_alt: "Farewell My Concubine",
    user_rating: 5,
    watched_date: "2024-04-02",
    release_year: 1993,
    director: "陈凯歌",
    country: "中国大陆 / 中国香港",
    language: "汉语普通话",
    duration_minutes: 171,
    genres: "剧情 / 爱情 / 同性",
  }),
  mkMovie({
    douban_subject_id: "dummy-1292720",
    title_primary: "阿甘正传",
    title_alt: "Forrest Gump",
    user_rating: 4,
    watched_date: "2024-03-18",
    release_year: 1994,
    director: "罗伯特·泽米吉斯",
    country: "美国",
    language: "英语",
    duration_minutes: 142,
    genres: "剧情 / 爱情",
  }),
  mkMovie({
    douban_subject_id: "dummy-1295644",
    title_primary: "千与千寻",
    title_alt: "千と千尋の神隠し",
    user_rating: 5,
    watched_date: "2024-02-21",
    release_year: 2001,
    director: "宫崎骏",
    country: "日本",
    language: "日语",
    duration_minutes: 125,
    genres: "剧情 / 动画 / 奇幻",
  }),
  mkMovie({
    douban_subject_id: "dummy-1889243",
    title_primary: "星际穿越",
    title_alt: "Interstellar",
    user_rating: 4,
    watched_date: "2024-01-09",
    release_year: 2014,
    director: "克里斯托弗·诺兰",
    country: "美国 / 英国",
    language: "英语",
    duration_minutes: 169,
    genres: "剧情 / 科幻 / 冒险",
  }),
];

export function getDummyMoviesData(): { movies: Movie[]; stats: MovieStats } {
  const movies = [...dummyMovies].sort((a, b) =>
    b.watched_date.localeCompare(a.watched_date)
  );
  return { movies, stats: computeMovieStats(movies) };
}
