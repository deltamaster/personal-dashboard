import type { Visit, VisitWithImages } from "@/lib/types/travel";

function visitSearchHaystack(visit: Visit): string {
  return [
    visit.country,
    visit.province,
    visit.city,
    visit.attraction,
    visit.type,
    visit.highlights,
    visit.thoughts,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** Client-side filter for travel timeline search (country / province / city / attraction / type). */
export function filterVisitsBySearch(
  visits: VisitWithImages[],
  query: string
): VisitWithImages[] {
  const q = query.trim().toLowerCase();
  if (!q) return visits;
  const tokens = q.split(/\s+/).filter(Boolean);
  return visits.filter((visit) => {
    const hay = visitSearchHaystack(visit);
    return tokens.every((token) => hay.includes(token));
  });
}
