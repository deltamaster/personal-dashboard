import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { isOtsConfigured } from "@/lib/ots-config";
import { softDeleteVisitImage } from "@/lib/ots/travel";
import { deleteDummyVisitImage, shouldUseTravelDummyData } from "@/lib/travel-dummy-data";

type RouteContext = { params: { id: string; imageId: string } };

/**
 * Soft-delete a visit photo: marks the pd_visit_images row as deleted in OTS so
 * it stops appearing. The row and the OSS object are intentionally retained.
 */
export async function DELETE(_request: Request, context: RouteContext) {
  const { error } = await requireSession();
  if (error) return error;

  const { id: visitId, imageId } = context.params;

  try {
    if (shouldUseTravelDummyData()) {
      deleteDummyVisitImage(visitId, imageId);
      return NextResponse.json({ ok: true });
    }

    if (!isOtsConfigured()) {
      return NextResponse.json({ error: "OTS is not configured" }, { status: 503 });
    }

    await softDeleteVisitImage(imageId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(`DELETE /api/travel/visits/${visitId}/images/${imageId}`, e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to delete photo" },
      { status: 500 }
    );
  }
}
