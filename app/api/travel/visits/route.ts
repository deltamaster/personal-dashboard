import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { isOtsConfigured } from "@/lib/ots-config";
import { computeTravelStats, createVisit, listFlights, listTrains, listVisitsWithImages } from "@/lib/ots/travel";
import { createDummyVisit, getDummyTravelData, shouldUseTravelDummyData } from "@/lib/travel-dummy-data";
import { parseVisitCreate } from "@/lib/travel-visit-input";
import type { VisitCreateInput } from "@/lib/types/travel";

export async function GET() {
  const { error } = await requireSession();
  if (error) return error;

  if (shouldUseTravelDummyData()) {
    return NextResponse.json(getDummyTravelData());
  }

  if (!isOtsConfigured()) {
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

export async function POST(request: Request) {
  const { error } = await requireSession();
  if (error) return error;

  try {
    const body = (await request.json()) as Partial<VisitCreateInput>;
    const { input, error: validationError } = parseVisitCreate(body);
    if (validationError || !input) {
      return NextResponse.json({ error: validationError ?? "Invalid input" }, { status: 400 });
    }

    if (shouldUseTravelDummyData()) {
      const visit = createDummyVisit(input);
      return NextResponse.json(visit, { status: 201 });
    }

    if (!isOtsConfigured()) {
      return NextResponse.json({ error: "OTS is not configured" }, { status: 503 });
    }

    const visit = await createVisit(input);
    return NextResponse.json(visit, { status: 201 });
  } catch (e) {
    console.error("POST /api/travel/visits", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create visit" },
      { status: 500 }
    );
  }
}
