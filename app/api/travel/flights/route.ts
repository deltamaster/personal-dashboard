import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { isOtsConfigured } from "@/lib/ots-config";
import { computeTravelStats, listFlights, listTrains, listVisits } from "@/lib/ots/travel";
import { getDummyTravelData, shouldUseTravelDummyData } from "@/lib/travel-dummy-data";

export async function GET() {
  const { error } = await requireSession();
  if (error) return error;

  if (shouldUseTravelDummyData()) {
    const { flights, stats } = getDummyTravelData();
    return NextResponse.json({ flights, stats: stats.flights });
  }

  if (!isOtsConfigured()) {
    return NextResponse.json({ error: "OTS is not configured" }, { status: 503 });
  }

  try {
    const [visits, flights, trains] = await Promise.all([
      listVisits(),
      listFlights(),
      listTrains(),
    ]);
    const stats = computeTravelStats(visits, flights, trains);
    return NextResponse.json({ flights, stats: stats.flights });
  } catch (e) {
    console.error("GET /api/travel/flights", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to list flights" },
      { status: 500 }
    );
  }
}
