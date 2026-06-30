import crypto from "crypto";
import { getAlibabaCredentials, isAlibabaBaseConfigured } from "@/lib/alibaba-credentials";

const TRAVEL_IMAGE_PREFIX = "travel_images/";

export function isOssConfigured(): boolean {
  return !!(isAlibabaBaseConfigured() && process.env.OSS_VAULT_BUCKET);
}

/** Strip bucket URL prefix or return bare object key. */
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

function ossResource(bucket: string, key: string, securityToken?: string): string {
  const base = `/${bucket}/${key}`;
  if (!securityToken) return base;
  return `${base}?security-token=${encodeURIComponent(securityToken)}`;
}

/** Issue a short-lived presigned GET URL for a vault object. */
export async function getPresignedGetUrl(objectKey: string, expiresInSec = 3600): Promise<string> {
  const bucket = process.env.OSS_VAULT_BUCKET;
  const endpoint = process.env.OSS_VAULT_ENDPOINT ?? "oss-ap-southeast-1.aliyuncs.com";
  if (!bucket) {
    throw new Error("OSS vault is not configured");
  }

  const creds = await getAlibabaCredentials();
  const key = extractObjectKey(objectKey);
  const expires = Math.floor(Date.now() / 1000) + expiresInSec;
  const resource = ossResource(bucket, key, creds.securityToken);
  const stringToSign = `GET\n\n\n${expires}\n${resource}`;
  const signature = crypto
    .createHmac("sha1", creds.accessKeySecret)
    .update(stringToSign)
    .digest("base64");

  const params = new URLSearchParams({
    OSSAccessKeyId: creds.accessKeyId,
    Expires: String(expires),
    Signature: signature,
  });
  if (creds.securityToken) {
    params.set("security-token", creds.securityToken);
  }

  return `https://${bucket}.${endpoint}/${key}?${params.toString()}`;
}

/** Issue a short-lived presigned PUT URL for direct browser upload to the vault. */
export async function getPresignedPutUrl(
  objectKey: string,
  contentType: string,
  expiresInSec = 3600
): Promise<string> {
  const bucket = process.env.OSS_VAULT_BUCKET;
  const endpoint = process.env.OSS_VAULT_ENDPOINT ?? "oss-ap-southeast-1.aliyuncs.com";
  if (!bucket) {
    throw new Error("OSS vault is not configured");
  }

  const creds = await getAlibabaCredentials();
  const key = extractObjectKey(objectKey);
  const expires = Math.floor(Date.now() / 1000) + expiresInSec;
  const resource = ossResource(bucket, key, creds.securityToken);
  const stringToSign = `PUT\n\n${contentType}\n${expires}\n${resource}`;
  const signature = crypto
    .createHmac("sha1", creds.accessKeySecret)
    .update(stringToSign)
    .digest("base64");

  const params = new URLSearchParams({
    OSSAccessKeyId: creds.accessKeyId,
    Expires: String(expires),
    Signature: signature,
  });
  if (creds.securityToken) {
    params.set("security-token", creds.securityToken);
  }

  return `https://${bucket}.${endpoint}/${key}?${params.toString()}`;
}

/** New vault object key for a visit photo. */
export function buildTravelImageKey(filename: string): string {
  const ext = filename.includes(".") ? filename.slice(filename.lastIndexOf(".")).toLowerCase() : ".jpg";
  const safeExt = /^\.(jpe?g|png|gif|webp|heic)$/i.test(ext) ? ext : ".jpg";
  const id = crypto.randomBytes(8).toString("hex");
  return `${TRAVEL_IMAGE_PREFIX}img_${id}${safeExt}`;
}
