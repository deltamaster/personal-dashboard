import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { emptyTravelStats, isOtsConfigured } from "@/lib/ots-config";
import { computeTravelStats, listFlights, listTrains, listVisitsWithImages } from "@/lib/ots/travel";

export async function GET() {
  const { error } = await requireSession();
  if (error) return error;

  if (!isOtsConfigured()) {
    if (process.env.NODE_ENV === "development") {
      return NextResponse.json({
        visits: [],
        flights: [],
        trains: [],
        stats: emptyTravelStats,
      });
    }
    return NextResponse.json({ error: "OTS is not configured" }, { status: 503 });
  }

  try {
    const visits = await listVisitsWithImages();
    const [flights, trains] = await Promise.all([listFlights(), listTrains()]);
    const stats = computeTravelStats(visits, flights, trains);
    return NextResponse.json({ visits, flights, trains, stats });
  } catch (e) {
    console.error("GET /api/travel/visits", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to list visits" },
      { status: 500 }
    );
  }
}
