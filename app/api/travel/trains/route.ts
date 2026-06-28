import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { emptyTravelStats, isOtsConfigured } from "@/lib/ots-config";
import { computeTravelStats, listFlights, listTrains, listVisits } from "@/lib/ots/travel";

export async function GET() {
  const { error } = await requireSession();
  if (error) return error;

  if (!isOtsConfigured()) {
    if (process.env.NODE_ENV === "development") {
      return NextResponse.json({ trains: [], stats: emptyTravelStats.trains });
    }
    return NextResponse.json({ error: "OTS is not configured" }, { status: 503 });
  }

  try {
    const [visits, flights, trains] = await Promise.all([
      listVisits(),
      listFlights(),
      listTrains(),
    ]);
    const stats = computeTravelStats(visits, flights, trains);
    return NextResponse.json({ trains, stats: stats.trains });
  } catch (e) {
    console.error("GET /api/travel/trains", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to list trains" },
      { status: 500 }
    );
  }
}
