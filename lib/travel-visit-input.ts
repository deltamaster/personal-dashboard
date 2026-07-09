import type { VisitCreateInput } from "@/lib/types/travel";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const VISIT_TYPES = new Set(["景点", "美食", "酒店", "博物馆", "购物", "其他"]);

export function parseVisitCreate(body: Partial<VisitCreateInput>): {
  input?: VisitCreateInput;
  error?: string;
} {
  const date = body.date?.trim() ?? "";
  const province = body.province?.trim() ?? "";
  const city = body.city?.trim() ?? "";
  const attraction = body.attraction?.trim() ?? "";

  if (!DATE_RE.test(date)) {
    return { error: "date must be YYYY-MM-DD" };
  }
  if (!attraction) {
    return { error: "attraction is required" };
  }
  if (!city) {
    return { error: "city is required" };
  }
  if (!province) {
    return { error: "province is required" };
  }

  const type = body.type?.trim() || "景点";
  if (!VISIT_TYPES.has(type)) {
    return { error: "type is invalid" };
  }

  let rating: number | undefined;
  if (body.rating !== undefined && body.rating !== null && body.rating !== ("" as unknown)) {
    const n = Number(body.rating);
    if (!Number.isFinite(n) || n < 1 || n > 5) {
      return { error: "rating must be 1–5" };
    }
    rating = Math.round(n);
  }

  const country = body.country?.trim() || "中国";
  const attraction_en = body.attraction_en?.trim() || undefined;
  const thoughts = body.thoughts?.trim() || undefined;
  const highlights = body.highlights?.trim() || undefined;
  const tips = body.tips?.trim() || undefined;

  return {
    input: {
      date,
      province,
      city,
      attraction,
      attraction_en,
      type,
      country,
      rating,
      thoughts,
      highlights,
      tips,
    },
  };
}

export const VISIT_TYPE_OPTIONS = Array.from(VISIT_TYPES);
