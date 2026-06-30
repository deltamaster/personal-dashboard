import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { isOtsConfigured } from "@/lib/ots-config";
import { createVisitImage, getVisitWithImages } from "@/lib/ots/travel";
import { extractObjectKey } from "@/lib/oss";
import {
  addDummyVisitImage,
  createDummyVisitImageRecord,
  shouldUseTravelDummyData,
} from "@/lib/travel-dummy-data";

type RouteContext = { params: { id: string } };

export async function POST(request: Request, context: RouteContext) {
  const { error } = await requireSession();
  if (error) return error;

  const visitId = context.params.id;

  try {
    const body = (await request.json()) as {
      objectKey?: string;
      width?: number;
      height?: number;
      description?: string;
    };

    if (!body.objectKey?.trim()) {
      return NextResponse.json({ error: "objectKey is required" }, { status: 400 });
    }

    const objectKey = extractObjectKey(body.objectKey);
    if (!objectKey.startsWith("travel_images/")) {
      return NextResponse.json({ error: "Invalid object key" }, { status: 400 });
    }

    if (shouldUseTravelDummyData()) {
      const record = createDummyVisitImageRecord(
        visitId,
        objectKey,
        body.width,
        body.height,
        body.description?.trim()
      );
      if (!record) {
        return NextResponse.json({ error: "Visit not found" }, { status: 404 });
      }
      addDummyVisitImage(visitId, record);
      return NextResponse.json(record, { status: 201 });
    }

    if (!isOtsConfigured()) {
      return NextResponse.json({ error: "OTS is not configured" }, { status: 503 });
    }

    const visit = await getVisitWithImages(visitId);
    if (!visit) {
      return NextResponse.json({ error: "Visit not found" }, { status: 404 });
    }

    const image = await createVisitImage({
      visit_id: visitId,
      oss_url: objectKey,
      width: body.width,
      height: body.height,
      description: body.description?.trim(),
    });

    return NextResponse.json(image, { status: 201 });
  } catch (e) {
    console.error(`POST /api/travel/visits/${visitId}/images`, e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to save image" },
      { status: 500 }
    );
  }
}
