const crypto = require("crypto");

const REFRESH_SKEW_MS = 5 * 60 * 1000;
let cached = null;

function percentEncode(value) {
  return encodeURIComponent(value).replace(/\+/g, "%20").replace(/\*/g, "%2A").replace(/%7E/g, "~");
}

async function assumeRole(roleArn) {
  const accessKeyId = process.env.ALIBABA_CLOUD_ACCESS_KEY_ID?.trim();
  const accessKeySecret = process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET?.trim();
  if (!accessKeyId || !accessKeySecret) {
    throw new Error("Missing ALIBABA_CLOUD_ACCESS_KEY_ID or ALIBABA_CLOUD_ACCESS_KEY_SECRET");
  }

  const params = {
    Action: "AssumeRole",
    Format: "JSON",
    Version: "2015-04-01",
    AccessKeyId: accessKeyId,
    SignatureMethod: "HMAC-SHA1",
    SignatureVersion: "1.0",
    SignatureNonce: crypto.randomUUID(),
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    RoleArn: roleArn,
    RoleSessionName: process.env.ALIBABA_CLOUD_ROLE_SESSION_NAME?.trim() || "www-songs",
    DurationSeconds: "3600",
  };

  const canonicalized = Object.keys(params)
    .sort()
    .map((key) => `${percentEncode(key)}=${percentEncode(params[key])}`)
    .join("&");
  const stringToSign = `GET&${percentEncode("/")}&${percentEncode(canonicalized)}`;
  const signature = crypto.createHmac("sha1", `${accessKeySecret}&`).update(stringToSign).digest("base64");
  const url = `https://sts.${process.env.ALIBABA_CLOUD_REGION?.trim() || "cn-shanghai"}.aliyuncs.com/?${canonicalized}&Signature=${percentEncode(signature)}`;

  const res = await fetch(url, { method: "GET" });
  const body = await res.json();
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

async function getCredentials() {
  const roleArn = process.env.ALIBABA_CLOUD_ROLE_ARN?.trim();
  if (!roleArn) {
    const accessKeyId = process.env.ALIBABA_CLOUD_ACCESS_KEY_ID?.trim();
    const accessKeySecret = process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET?.trim();
    if (!accessKeyId || !accessKeySecret) {
      throw new Error("Missing Alibaba credentials for the song list function");
    }
    return { accessKeyId, accessKeySecret };
  }

  const now = Date.now();
  if (cached && cached.expiresAtMs - REFRESH_SKEW_MS > now) return cached.creds;
  const creds = await assumeRole(roleArn);
  cached = { creds, expiresAtMs: creds.expiration?.getTime() ?? now + 3600_000 };
  return creds;
}

module.exports = { getCredentials };
