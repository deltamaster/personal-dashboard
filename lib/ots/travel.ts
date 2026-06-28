import { normalizeProvince } from "@/lib/china-provinces";
import {
  coerceOtsNumber,
  getOtsClient,
  nextStartPrimaryKey,
  rowToObject,
} from "@/lib/ots";
import { otsCall, TableStore } from "@/lib/ots-client";
import type {
  AirlineStat,
  Flight,
  ProvinceStat,
  Train,
  TrainTypeStat,
  TravelStats,
  Visit,
  VisitImage,
  VisitWithImages,
} from "@/lib/types/travel";

const VISITS_TABLE = "pd_visits";
const IMAGES_TABLE = "pd_visit_images";
const FLIGHTS_TABLE = "pd_flights";
const TRAINS_TABLE = "pd_trains";

function normalizeVisit(raw: Record<string, unknown>): Visit {
  return {
    ...(raw as unknown as Visit),
    rating: coerceOtsNumber(raw.rating),
    cost: coerceOtsNumber(raw.cost),
    revisit: coerceOtsNumber(raw.revisit),
  };
}

function normalizeImage(raw: Record<string, unknown>): VisitImage {
  return {
    ...(raw as unknown as VisitImage),
    width: coerceOtsNumber(raw.width),
    height: coerceOtsNumber(raw.height),
  };
}

function normalizeFlight(raw: Record<string, unknown>): Flight {
  return {
    ...(raw as unknown as Flight),
    distance_km: coerceOtsNumber(raw.distance_km),
  };
}

function normalizeTrain(raw: Record<string, unknown>): Train {
  return {
    ...(raw as unknown as Train),
    duration_minutes: coerceOtsNumber(raw.duration_minutes),
  };
}

async function scanTable<T>(
  tableName: string,
  pkName: string,
  normalize: (raw: Record<string, unknown>) => T
): Promise<T[]> {
  const client = getOtsClient();
  const rows: T[] = [];
  let startKey: Record<string, unknown>[] = [{ [pkName]: TableStore.INF_MIN }];
  let done = false;

  while (!done) {
    const result = await otsCall<{
      rows?: unknown[];
      nextStartPrimaryKey?: { name: string; value: unknown }[];
    }>(client.getRange.bind(client), {
      tableName,
      direction: TableStore.Direction.FORWARD,
      inclusiveStartPrimaryKey: startKey,
      exclusiveEndPrimaryKey: [{ [pkName]: TableStore.INF_MAX }],
      limit: 100,
    });

    for (const row of result.rows ?? []) {
      rows.push(normalize(rowToObject(row as Parameters<typeof rowToObject>[0])));
    }

    const next = result.nextStartPrimaryKey;
    if (next?.length) {
      startKey = nextStartPrimaryKey(next);
    } else {
      done = true;
    }
  }

  return rows;
}

export async function listVisits(): Promise<Visit[]> {
  const visits = await scanTable(VISITS_TABLE, "visit_id", normalizeVisit);
  return visits.sort((a, b) => b.date.localeCompare(a.date));
}

export async function listVisitImages(): Promise<VisitImage[]> {
  return scanTable(IMAGES_TABLE, "image_id", normalizeImage);
}

export async function listVisitsWithImages(): Promise<VisitWithImages[]> {
  const [visits, images] = await Promise.all([listVisits(), listVisitImages()]);
  const imagesByVisit = new Map<string, VisitImage[]>();

  for (const image of images) {
    const list = imagesByVisit.get(image.visit_id) ?? [];
    list.push(image);
    imagesByVisit.set(image.visit_id, list);
  }

  return visits.map((visit) => ({
    ...visit,
    images: (imagesByVisit.get(visit.visit_id) ?? []).sort((a, b) =>
      a.created_at.localeCompare(b.created_at)
    ),
  }));
}

export async function listFlights(): Promise<Flight[]> {
  const flights = await scanTable(FLIGHTS_TABLE, "flight_id", normalizeFlight);
  return flights.sort((a, b) => b.flight_date.localeCompare(a.flight_date));
}

export async function listTrains(): Promise<Train[]> {
  const trains = await scanTable(TRAINS_TABLE, "train_id", normalizeTrain);
  return trains.sort((a, b) => b.train_date.localeCompare(a.train_date));
}

export function computeTravelStats(
  visits: Visit[],
  flights: Flight[],
  trains: Train[]
): TravelStats {
  const provinceMap = new Map<string, number>();
  const typeMap = new Map<string, number>();
  const cities = new Set<string>();
  const countries = new Set<string>();

  for (const visit of visits) {
    if (visit.country) countries.add(visit.country);
    if (visit.city) cities.add(`${visit.country}:${visit.city}`);
    if (visit.province) {
      const province = normalizeProvince(visit.province);
      provinceMap.set(province, (provinceMap.get(province) ?? 0) + 1);
    }
    const type = visit.type || "其他";
    typeMap.set(type, (typeMap.get(type) ?? 0) + 1);
  }

  const byProvince: ProvinceStat[] = Array.from(provinceMap.entries())
    .map(([province, count]) => ({ province, count }))
    .sort((a, b) => b.count - a.count || a.province.localeCompare(b.province));

  const byType = Array.from(typeMap.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  const airlineMap = new Map<string, { count: number; distanceKm: number }>();
  let totalDistanceKm = 0;

  for (const flight of flights) {
    const distance = flight.distance_km ?? 0;
    totalDistanceKm += distance;
    const entry = airlineMap.get(flight.airline) ?? { count: 0, distanceKm: 0 };
    entry.count += 1;
    entry.distanceKm += distance;
    airlineMap.set(flight.airline, entry);
  }

  const byAirline: AirlineStat[] = Array.from(airlineMap.entries())
    .map(([airline, { count, distanceKm }]) => ({ airline, count, distanceKm }))
    .sort((a, b) => b.distanceKm - a.distanceKm || b.count - a.count);

  const trainTypeMap = new Map<string, { count: number; durationMinutes: number }>();
  let totalDurationMinutes = 0;

  for (const train of trains) {
    const duration = train.duration_minutes ?? 0;
    totalDurationMinutes += duration;
    const trainType = train.train_type || "其他";
    const entry = trainTypeMap.get(trainType) ?? { count: 0, durationMinutes: 0 };
    entry.count += 1;
    entry.durationMinutes += duration;
    trainTypeMap.set(trainType, entry);
  }

  const byTrainType: TrainTypeStat[] = Array.from(trainTypeMap.entries())
    .map(([trainType, { count, durationMinutes }]) => ({
      trainType,
      count,
      durationMinutes,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    visits: {
      total: visits.length,
      provinces: provinceMap.size,
      cities: cities.size,
      countries: countries.size,
      byProvince,
      byType,
    },
    flights: {
      total: flights.length,
      totalDistanceKm,
      byAirline,
    },
    trains: {
      total: trains.length,
      totalDurationMinutes,
      byType: byTrainType,
    },
  };
}