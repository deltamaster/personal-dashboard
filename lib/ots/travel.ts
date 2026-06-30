import { randomUUID } from "node:crypto";
import {
  CHINA_PROVINCE_NAMES,
  normalizeProvince,
  visitCountry,
} from "@/lib/china-provinces";
import {
  coerceOtsNumber,
  getOtsClient,
  nextStartPrimaryKey,
  rowToObject,
  toAttributeColumns,
  toUpdatePutColumns,
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

function compareDesc(a?: string, b?: string): number {
  return (b ?? "").localeCompare(a ?? "");
}

function compareAsc(a?: string, b?: string): number {
  return (a ?? "").localeCompare(b ?? "");
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeVisit(raw: Record<string, unknown>): Visit {
  const { visit_id, ...rest } = raw as unknown as Visit & Record<string, unknown>;
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rest)) {
    if (/^\d+$/.test(key)) continue;
    cleaned[key] = value;
  }
  return {
    ...(cleaned as unknown as Visit),
    visit_id: String(visit_id),
    rating: coerceOtsNumber(raw.rating),
    cost: coerceOtsNumber(raw.cost),
    revisit: coerceOtsNumber(raw.revisit),
  };
}

function visitAttributes(visit: Visit): Record<string, string | number | undefined> {
  return {
    date: visit.date,
    province: visit.province,
    city: visit.city,
    attraction: visit.attraction,
    attraction_en: visit.attraction_en,
    type: visit.type,
    country: visit.country,
    rating: visit.rating,
    cost: visit.cost,
    cost_currency: visit.cost_currency,
    thoughts: visit.thoughts,
    highlights: visit.highlights,
    tips: visit.tips,
    revisit: visit.revisit,
    created_at: visit.created_at,
    updated_at: visit.updated_at,
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
  const client = await getOtsClient();
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
  return visits.sort((a, b) => compareDesc(a.date, b.date));
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
      compareAsc(a.created_at, b.created_at)
    ),
  }));
}

export async function getVisit(visitId: string): Promise<Visit | null> {
  const client = await getOtsClient();
  try {
    const result = await otsCall<{ row?: unknown }>(client.getRow.bind(client), {
      tableName: VISITS_TABLE,
      primaryKey: [{ visit_id: visitId }],
    });
    if (!result.row) return null;
    return normalizeVisit(rowToObject(result.row as Parameters<typeof rowToObject>[0]));
  } catch {
    return null;
  }
}

export async function updateVisit(
  visitId: string,
  patch: Partial<
    Pick<Visit, "date" | "attraction" | "city" | "province" | "rating" | "thoughts" | "highlights" | "tips" | "revisit">
  >
): Promise<Visit | null> {
  const existing = await getVisit(visitId);
  if (!existing) return null;

  const updated: Visit = {
    ...existing,
    ...patch,
    visit_id: visitId,
    updated_at: nowIso(),
  };

  if (!updated.created_at) {
    updated.created_at = updated.updated_at;
  }

  const updateColumns = toUpdatePutColumns(visitAttributes(updated));
  if (updateColumns.length === 0) {
    return updated;
  }

  const client = await getOtsClient();
  await otsCall(client.updateRow.bind(client), {
    tableName: VISITS_TABLE,
    condition: new TableStore.Condition(TableStore.RowExistenceExpectation.IGNORE, null),
    primaryKey: [{ visit_id: visitId }],
    updateOfAttributeColumns: updateColumns,
  });

  return updated;
}

/** Replace all attribute columns on a visit row (used for recovery / full rewrite). */
export async function replaceVisit(visit: Visit): Promise<Visit> {
  const row: Visit = {
    ...visit,
    updated_at: visit.updated_at || nowIso(),
    created_at: visit.created_at || visit.updated_at || nowIso(),
  };

  const client = await getOtsClient();
  await otsCall(client.putRow.bind(client), {
    tableName: VISITS_TABLE,
    condition: new TableStore.Condition(TableStore.RowExistenceExpectation.IGNORE, null),
    primaryKey: [{ visit_id: row.visit_id }],
    attributeColumns: toAttributeColumns(visitAttributes(row)),
  });

  return row;
}

export interface VisitImageInput {
  image_id?: string;
  visit_id: string;
  oss_url: string;
  width?: number;
  height?: number;
  description?: string;
}

export async function createVisitImage(input: VisitImageInput): Promise<VisitImage> {
  const client = await getOtsClient();
  const ts = nowIso();
  const imageId = input.image_id?.trim() || randomUUID();
  const image: VisitImage = {
    image_id: imageId,
    visit_id: input.visit_id,
    oss_url: input.oss_url,
    width: input.width,
    height: input.height,
    description: input.description,
    created_at: ts,
  };

  await otsCall(client.putRow.bind(client), {
    tableName: IMAGES_TABLE,
    condition: new TableStore.Condition(TableStore.RowExistenceExpectation.IGNORE, null),
    primaryKey: [{ image_id: imageId }],
    attributeColumns: toAttributeColumns({
      visit_id: image.visit_id,
      oss_url: image.oss_url,
      width: image.width,
      height: image.height,
      description: image.description,
      created_at: image.created_at,
    }),
  });

  return image;
}

export async function getVisitWithImages(visitId: string): Promise<VisitWithImages | null> {
  const visit = await getVisit(visitId);
  if (!visit) return null;

  const images = (await listVisitImages())
    .filter((image) => image.visit_id === visitId)
    .sort((a, b) => compareAsc(a.created_at, b.created_at));

  return { ...visit, images };
}

export async function listFlights(): Promise<Flight[]> {
  const flights = await scanTable(FLIGHTS_TABLE, "flight_id", normalizeFlight);
  return flights.sort((a, b) => compareDesc(a.flight_date, b.flight_date));
}

export async function listTrains(): Promise<Train[]> {
  const trains = await scanTable(TRAINS_TABLE, "train_id", normalizeTrain);
  return trains.sort((a, b) => compareDesc(a.train_date, b.train_date));
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
    const country = visitCountry(visit);
    countries.add(country);
    if (visit.city) cities.add(`${country}:${visit.city}`);
    if (visit.province) {
      const province = normalizeProvince(visit.province);
      if (CHINA_PROVINCE_NAMES.has(province)) {
        provinceMap.set(province, (provinceMap.get(province) ?? 0) + 1);
      }
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