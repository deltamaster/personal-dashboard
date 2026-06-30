import crypto from "crypto";
import { getAlibabaCredentials, isAlibabaBaseConfigured } from "@/lib/alibaba-credentials";

const TRAVEL_IMAGE_PREFIX = "travel/images/";

/**
 * Bucket that stores publicly-served visit photos (the CDN `/*` origin).
 * Prod: the public web bucket (`pd-web-sg`); QA: the CDN-fronted bucket
 * (`pd-vault-qa`). Configured via OSS_MEDIA_BUCKET, falling back to
 * OSS_WEB_BUCKET then OSS_VAULT_BUCKET.
 */
function getMediaBucket(): string | undefined {
  return (
    process.env.OSS_MEDIA_BUCKET?.trim() ||
    process.env.OSS_WEB_BUCKET?.trim() ||
    process.env.OSS_VAULT_BUCKET?.trim() ||
    undefined
  );
}

function getMediaEndpoint(): string {
  const explicit = process.env.OSS_MEDIA_ENDPOINT?.trim() || process.env.OSS_VAULT_ENDPOINT?.trim();
  if (explicit) return explicit;
  const region = process.env.ALIBABA_CLOUD_REGION?.trim() || "ap-southeast-1";
  return `oss-${region}.aliyuncs.com`;
}

export function isOssConfigured(): boolean {
  return !!(isAlibabaBaseConfigured() && getMediaBucket());
}

/** Strip bucket/domain prefix or return bare object key. */
export function extractObjectKey(ossUrl: string): string {
  const trimmed = ossUrl.trim();
  if (!trimmed.includes("://")) {
    return trimmed.replace(/^\//, "");
  }

  try {
    const url = new URL(trimmed);
    return url.pathname.replace(/^\//, "");
  } catch {
    return trimmed.replace(/^\//, "");
  }
}

/**
 * Public base URL for serving media (CDN custom domain), if explicitly set
 * (e.g. QA `https://pd-qa.huhansen.com`). Trailing slash stripped.
 */
export function getMediaPublicBaseUrl(): string | undefined {
  const v = process.env.MEDIA_PUBLIC_BASE_URL?.trim();
  return v ? v.replace(/\/$/, "") : undefined;
}

/**
 * Normalize a stored URL/key to a browser-loadable URL on read.
 * Only rewrites when MEDIA_PUBLIC_BASE_URL is explicitly set (idempotent for
 * values already on that base). When unset (prod), returns the input unchanged
 * so existing full URLs (`https://pd.huhansen.com/...`) are preserved.
 */
export function toPublicMediaUrl(ossUrlOrKey: string): string {
  if (!ossUrlOrKey) return ossUrlOrKey;
  const base = getMediaPublicBaseUrl();
  if (!base) return ossUrlOrKey;
  return `${base}/${extractObjectKey(ossUrlOrKey)}`;
}

/** Base used to construct the stored URL for a NEW upload (app's public domain). */
function uploadBaseUrl(): string {
  const explicit = getMediaPublicBaseUrl();
  if (explicit) return explicit;
  const authUrl = process.env.AUTH_URL?.trim();
  if (authUrl) return authUrl.replace(/\/$/, "");
  const bucket = getMediaBucket();
  return bucket ? `https://${bucket}.${getMediaEndpoint()}` : "";
}

/** Full, browser-loadable URL to persist for a freshly uploaded object key. */
export function buildStoredImageUrl(objectKey: string): string {
  const key = extractObjectKey(objectKey);
  const base = uploadBaseUrl();
  return base ? `${base}/${key}` : key;
}

/** New object key for a visit photo (matches existing prod layout). */
export function buildTravelImageKey(filename: string): string {
  const ext = filename.includes(".") ? filename.slice(filename.lastIndexOf(".")).toLowerCase() : ".jpg";
  const safeExt = /^\.(jpe?g|png|gif|webp|heic)$/i.test(ext) ? ext : ".jpg";
  return `${TRAVEL_IMAGE_PREFIX}${crypto.randomUUID()}${safeExt}`;
}

/**
 * Upload bytes to the media bucket server-side (from the FC/API), so the browser
 * never talks to OSS directly. Uses AssumeRole/STS credentials.
 */
export async function putMediaObject(
  objectKey: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  const bucket = getMediaBucket();
  if (!bucket) throw new Error("OSS media bucket is not configured");

  const endpoint = getMediaEndpoint();
  const key = extractObjectKey(objectKey);
  const creds = await getAlibabaCredentials();
  const date = new Date().toUTCString();
  const canonicalizedOSSHeaders = creds.securityToken
    ? `x-oss-security-token:${creds.securityToken}\n`
    : "";
  const stringToSign = `PUT\n\n${contentType}\n${date}\n${canonicalizedOSSHeaders}/${bucket}/${key}`;
  const signature = crypto
    .createHmac("sha1", creds.accessKeySecret)
    .update(stringToSign)
    .digest("base64");

  const headers: Record<string, string> = {
    Date: date,
    "Content-Type": contentType,
    Authorization: `OSS ${creds.accessKeyId}:${signature}`,
  };
  if (creds.securityToken) headers["x-oss-security-token"] = creds.securityToken;

  const res = await fetch(`https://${bucket}.${endpoint}/${key}`, {
    method: "PUT",
    headers,
    body: new Uint8Array(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OSS upload failed (${res.status}): ${text.slice(0, 300)}`);
  }
}
