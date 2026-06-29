import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import {
  buildTravelImageKey,
  getPresignedPutUrl,
  isOssConfigured,
} from "@/lib/oss";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export async function POST(request: Request) {
  const { error } = await requireSession();
  if (error) return error;

  if (!isOssConfigured()) {
    return NextResponse.json(
      { error: "OSS vault is not configured — add Alibaba credentials to .env.local" },
      { status: 503 }
    );
  }

  try {
    const body = (await request.json()) as {
      filename?: string;
      contentType?: string;
    };

    const filename = body.filename?.trim() || "photo.jpg";
    const contentType = body.contentType?.trim() || "image/jpeg";

    if (!ALLOWED_TYPES.has(contentType)) {
      return NextResponse.json({ error: "Unsupported image type" }, { status: 400 });
    }

    const objectKey = buildTravelImageKey(filename);
    const uploadUrl = getPresignedPutUrl(objectKey, contentType);

    return NextResponse.json({ uploadUrl, objectKey });
  } catch (e) {
    console.error("POST /api/media/upload", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create upload URL" },
      { status: 500 }
    );
  }
}
