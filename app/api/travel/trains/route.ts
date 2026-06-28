import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { isOtsConfigured } from "@/lib/ots-config";
import { computeTravelStats, listFlights, listTrains, listVisits } from "@/lib/ots/travel";
import { getDummyTravelData, shouldUseTravelDummyData } from "@/lib/travel-dummy-data";

export async function GET() {
  const { error } = await requireSession();
  if (error) return error;

  if (shouldUseTravelDummyData()) {
    const { trains, stats } = getDummyTravelData();
    return NextResponse.json({ trains, stats: stats.trains });
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
    return NextResponse.json({ trains, stats: stats.trains });
  } catch (e) {
    console.error("GET /api/travel/trains", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to list trains" },
      { status: 500 }
    );
  }
}
