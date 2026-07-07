import crypto from "crypto";

export interface AlibabaCredentials {
  accessKeyId: string;
  accessKeySecret: string;
  securityToken?: string;
  expiration?: Date;
}

interface CachedCredentials {
  creds: AlibabaCredentials;
  expiresAtMs: number;
}

let cached: CachedCredentials | null = null;

const REFRESH_SKEW_MS = 5 * 60 * 1000;

function percentEncode(value: string): string {
  return encodeURIComponent(value)
    .replace(/\+/g, "%20")
    .replace(/\*/g, "%2A")
    .replace(/%7E/g, "~");
}

function isoTimestamp(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function randomNonce(): string {
  return crypto.randomUUID();
}

function stsRegion(): string {
  return process.env.ALIBABA_CLOUD_REGION?.trim() || "cn-shanghai";
}

function roleSessionName(): string {
  return process.env.ALIBABA_CLOUD_ROLE_SESSION_NAME?.trim() || "personal-dashboard";
}

export function isAlibabaBaseConfigured(): boolean {
  return !!(
    process.env.ALIBABA_CLOUD_ACCESS_KEY_ID?.trim() &&
    process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET?.trim()
  );
}

export function isAlibabaRoleConfigured(): boolean {
  return !!process.env.ALIBABA_CLOUD_ROLE_ARN?.trim();
}

async function assumeRole(roleArn: string): Promise<AlibabaCredentials> {
  const accessKeyId = process.env.ALIBABA_CLOUD_ACCESS_KEY_ID?.trim();
  const accessKeySecret = process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET?.trim();
  if (!accessKeyId || !accessKeySecret) {
    throw new Error("Missing ALIBABA_CLOUD_ACCESS_KEY_ID or ALIBABA_CLOUD_ACCESS_KEY_SECRET");
  }

  const params: Record<string, string> = {
    Action: "AssumeRole",
    Format: "JSON",
    Version: "2015-04-01",
    AccessKeyId: accessKeyId,
    SignatureMethod: "HMAC-SHA1",
    SignatureVersion: "1.0",
    SignatureNonce: randomNonce(),
    Timestamp: isoTimestamp(),
    RoleArn: roleArn,
    RoleSessionName: roleSessionName(),
    DurationSeconds: "3600",
  };

  const sorted = Object.keys(params).sort();
  const canonicalized = sorted
    .map((key) => `${percentEncode(key)}=${percentEncode(params[key])}`)
    .join("&");
  const stringToSign = `GET&${percentEncode("/")}&${percentEncode(canonicalized)}`;
  const signature = crypto
    .createHmac("sha1", `${accessKeySecret}&`)
    .update(stringToSign)
    .digest("base64");

  const query = `${canonicalized}&Signature=${percentEncode(signature)}`;
  const url = `https://sts.${stsRegion()}.aliyuncs.com/?${query}`;

  const res = await fetch(url, { method: "GET" });
  const body = (await res.json()) as {
    Credentials?: {
      AccessKeyId: string;
      AccessKeySecret: string;
      SecurityToken: string;
      Expiration: string;
    };
    Code?: string;
    Message?: string;
  };

  if (!res.ok || !body.Credentials) {
    throw new Error(body.Message ?? `AssumeRole failed (HTTP ${res.status})`);
  }

  return {
    accessKeyId: body.Credentials.AccessKeyId,
    accessKeySecret: body.Credentials.AccessKeySecret,
    securityToken: body.Credentials.SecurityToken,
    expiration: new Date(body.Credentials.Expiration),
  };
}

/** Runtime credentials: AssumeRole when ALIBABA_CLOUD_ROLE_ARN is set, else base AK (legacy). */
export async function getAlibabaCredentials(): Promise<AlibabaCredentials> {
  const roleArn = process.env.ALIBABA_CLOUD_ROLE_ARN?.trim();
  if (!roleArn) {
    const accessKeyId = process.env.ALIBABA_CLOUD_ACCESS_KEY_ID?.trim();
    const accessKeySecret = process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET?.trim();
    if (!accessKeyId || !accessKeySecret) {
      throw new Error(
        "Missing Alibaba credentials. Set ALIBABA_CLOUD_ACCESS_KEY_ID, ALIBABA_CLOUD_ACCESS_KEY_SECRET, and ALIBABA_CLOUD_ROLE_ARN."
      );
    }
    return { accessKeyId, accessKeySecret };
  }

  const now = Date.now();
  if (cached && cached.expiresAtMs - REFRESH_SKEW_MS > now) {
    return cached.creds;
  }

  const creds = await assumeRole(roleArn);
  const expiresAtMs = creds.expiration?.getTime() ?? now + 3600_000;
  cached = { creds, expiresAtMs };
  return creds;
}
