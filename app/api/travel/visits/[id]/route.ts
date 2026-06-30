import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { isOtsConfigured } from "@/lib/ots-config";
import { getVisitWithImages, updateVisit } from "@/lib/ots/travel";
import { shouldUseTravelDummyData, updateDummyVisit } from "@/lib/travel-dummy-data";

type RouteContext = { params: { id: string } };

type VisitUpdateBody = {
  rating?: number;
  date?: string;
  attraction?: string;
  city?: string;
  province?: string;
  thoughts?: string;
  highlights?: string;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseVisitUpdate(body: VisitUpdateBody): { patch: VisitUpdateBody; error?: string } {
  const patch: VisitUpdateBody = {};
  let count = 0;

  if (body.rating !== undefined) {
    if (body.rating < 1 || body.rating > 5) {
      return { patch, error: "rating must be 1–5" };
    }
    patch.rating = body.rating;
    count += 1;
  }

  if (body.date !== undefined) {
    const date = body.date.trim();
    if (!DATE_RE.test(date)) {
      return { patch, error: "date must be YYYY-MM-DD" };
    }
    patch.date = date;
    count += 1;
  }

  if (body.attraction !== undefined) {
    const attraction = body.attraction.trim();
    if (!attraction) {
      return { patch, error: "attraction is required" };
    }
    patch.attraction = attraction;
    count += 1;
  }

  if (body.city !== undefined) {
    const city = body.city.trim();
    if (!city) {
      return { patch, error: "city is required" };
    }
    patch.city = city;
    count += 1;
  }

  if (body.province !== undefined) {
    const province = body.province.trim();
    if (!province) {
      return { patch, error: "province is required" };
    }
    patch.province = province;
    count += 1;
  }

  if (body.thoughts !== undefined) {
    patch.thoughts = body.thoughts.trim();
    count += 1;
  }

  if (body.highlights !== undefined) {
    patch.highlights = body.highlights.trim();
    count += 1;
  }

  if (count === 0) {
    return { patch, error: "At least one field is required" };
  }

  return { patch };
}

export async function PUT(request: Request, context: RouteContext) {
  const { error } = await requireSession();
  if (error) return error;

  const visitId = context.params.id;

  try {
    const body = (await request.json()) as VisitUpdateBody;
    const { patch, error: validationError } = parseVisitUpdate(body);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    if (shouldUseTravelDummyData()) {
      const visit = updateDummyVisit(visitId, patch);
      if (!visit) {
        return NextResponse.json({ error: "Visit not found" }, { status: 404 });
      }
      return NextResponse.json(visit);
    }

    if (!isOtsConfigured()) {
      return NextResponse.json({ error: "OTS is not configured" }, { status: 503 });
    }

    const updated = await updateVisit(visitId, patch);
    if (!updated) {
      return NextResponse.json({ error: "Visit not found" }, { status: 404 });
    }

    const visit = await getVisitWithImages(visitId);
    if (!visit) {
      return NextResponse.json({ error: "Visit not found" }, { status: 404 });
    }

    return NextResponse.json(visit);
  } catch (e) {
    console.error(`PUT /api/travel/visits/${visitId}`, e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to update visit" },
      { status: 500 }
    );
  }
}
