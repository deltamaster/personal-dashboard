import crypto from "crypto";

const TRAVEL_IMAGE_PREFIX = "travel_images/";

export function isOssConfigured(): boolean {
  return !!(
    process.env.ALIBABA_CLOUD_ACCESS_KEY_ID &&
    process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET &&
    process.env.OSS_VAULT_BUCKET
  );
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

/** Issue a short-lived presigned GET URL for a vault object. */
export function getPresignedGetUrl(objectKey: string, expiresInSec = 3600): string {
  const bucket = process.env.OSS_VAULT_BUCKET;
  const endpoint = process.env.OSS_VAULT_ENDPOINT ?? "oss-cn-shanghai.aliyuncs.com";
  const accessKeyId = process.env.ALIBABA_CLOUD_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET;

  if (!bucket || !accessKeyId || !accessKeySecret) {
    throw new Error("OSS vault is not configured");
  }

  const key = extractObjectKey(objectKey);
  const expires = Math.floor(Date.now() / 1000) + expiresInSec;
  const resource = `/${bucket}/${key}`;
  const stringToSign = `GET\n\n\n${expires}\n${resource}`;
  const signature = crypto
    .createHmac("sha1", accessKeySecret)
    .update(stringToSign)
    .digest("base64");

  return `https://${bucket}.${endpoint}/${key}?OSSAccessKeyId=${encodeURIComponent(accessKeyId)}&Expires=${expires}&Signature=${encodeURIComponent(signature)}`;
}

/** Issue a short-lived presigned PUT URL for direct browser upload to the vault. */
export function getPresignedPutUrl(
  objectKey: string,
  contentType: string,
  expiresInSec = 3600
): string {
  const bucket = process.env.OSS_VAULT_BUCKET;
  const endpoint = process.env.OSS_VAULT_ENDPOINT ?? "oss-cn-shanghai.aliyuncs.com";
  const accessKeyId = process.env.ALIBABA_CLOUD_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET;

  if (!bucket || !accessKeyId || !accessKeySecret) {
    throw new Error("OSS vault is not configured");
  }

  const key = extractObjectKey(objectKey);
  const expires = Math.floor(Date.now() / 1000) + expiresInSec;
  const resource = `/${bucket}/${key}`;
  const stringToSign = `PUT\n\n${contentType}\n${expires}\n${resource}`;
  const signature = crypto
    .createHmac("sha1", accessKeySecret)
    .update(stringToSign)
    .digest("base64");

  return `https://${bucket}.${endpoint}/${key}?OSSAccessKeyId=${encodeURIComponent(accessKeyId)}&Expires=${expires}&Signature=${encodeURIComponent(signature)}`;
}

/** New vault object key for a visit photo. */
export function buildTravelImageKey(filename: string): string {
  const ext = filename.includes(".") ? filename.slice(filename.lastIndexOf(".")).toLowerCase() : ".jpg";
  const safeExt = /^\.(jpe?g|png|gif|webp|heic)$/i.test(ext) ? ext : ".jpg";
  const id = crypto.randomBytes(8).toString("hex");
  return `${TRAVEL_IMAGE_PREFIX}img_${id}${safeExt}`;
}
