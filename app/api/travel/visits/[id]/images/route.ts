import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { isOtsConfigured } from "@/lib/ots-config";
import { createVisitImage, getVisitWithImages } from "@/lib/ots/travel";
import { buildStoredImageUrl, buildTravelImageKey, isOssConfigured, putMediaObject } from "@/lib/oss";
import {
  addDummyVisitImage,
  createDummyVisitImageRecord,
  shouldUseTravelDummyData,
} from "@/lib/travel-dummy-data";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB

type RouteContext = { params: { id: string } };

/**
 * Atomic "add photo": the browser POSTs the image file (multipart/form-data) to
 * this single endpoint. The server uploads it to OSS on the user's behalf,
 * rewrites the URL to the public domain, and writes the pd_visit_images row — no
 * direct browser→OSS upload, no presigned URLs.
 */
export async function POST(request: Request, context: RouteContext) {
  const { error } = await requireSession();
  if (error) return error;

  const visitId = context.params.id;

  try {
    const form = await request.formData().catch(() => null);
    if (!form) {
      return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
    }

    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    const contentType = file.type || "image/jpeg";
    if (!ALLOWED_TYPES.has(contentType)) {
      return NextResponse.json({ error: "Unsupported image type" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Image too large (max 15 MB)" }, { status: 413 });
    }

    const width = form.get("width") ? Number(form.get("width")) : undefined;
    const height = form.get("height") ? Number(form.get("height")) : undefined;
    const description = (form.get("description") as string | null)?.trim() || undefined;

    if (!isOssConfigured()) {
      return NextResponse.json(
        { error: "OSS is not configured — add Alibaba credentials and a media bucket" },
        { status: 503 }
      );
    }

    const objectKey = buildTravelImageKey(file.name || "photo.jpg");
    const buffer = Buffer.from(await file.arrayBuffer());
    await putMediaObject(objectKey, buffer, contentType);
    const ossUrl = buildStoredImageUrl(objectKey);

    if (shouldUseTravelDummyData()) {
      const record = createDummyVisitImageRecord(visitId, ossUrl, width, height, description);
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
      oss_url: ossUrl,
      width,
      height,
      description,
    });

    return NextResponse.json(image, { status: 201 });
  } catch (e) {
    console.error(`POST /api/travel/visits/${visitId}/images`, e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to add photo" },
      { status: 500 }
    );
  }
}
