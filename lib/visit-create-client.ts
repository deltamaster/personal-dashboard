import type { VisitCreateInput, VisitWithImages } from "@/lib/types/travel";

/** Copy visit fields for a quick adjacent insert (attraction + rating left blank). */
export function visitCreateTemplateFromVisit(
  visit: VisitWithImages
): Omit<VisitCreateInput, "attraction" | "rating"> {
  return {
    date: visit.date,
    city: visit.city,
    province: visit.province,
    type: visit.type ?? "景点",
    country: visit.country ?? "中国",
    attraction_en: visit.attraction_en,
    thoughts: visit.thoughts,
    highlights: visit.highlights,
    tips: visit.tips,
  };
}

export async function postNewVisit(body: VisitCreateInput): Promise<VisitWithImages> {
  const res = await fetch("/api/travel/visits/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Failed to add visit");
  }

  return res.json() as Promise<VisitWithImages>;
}

export type VisitInsertPosition = {
  anchorVisitId: string;
  position: "above" | "below";
};
