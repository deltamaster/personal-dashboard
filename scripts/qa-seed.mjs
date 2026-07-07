#!/usr/bin/env node
/**
 * QA environment bootstrap: clone the production OTS schema into a QA instance
 * and fill it with dummy data. Reads OTS_* / ALIBABA_CLOUD_* from the
 * environment (or .env.local) and accesses OTS via STS AssumeRole when
 * ALIBABA_CLOUD_ROLE_ARN is set, otherwise with the raw RAM keys.
 *
 * Safety: refuses to touch a production instance. The target OTS_INSTANCE_NAME
 * must contain "qa" (override with --force only if you know what you're doing).
 *
 * Usage:
 *   node scripts/qa-seed.mjs --dry-run     # print planned actions, no writes
 *   node scripts/qa-seed.mjs               # create tables + seed dummy data
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import TableStorePkg from "tablestore";
import { buildQaSeed } from "./qa-seed-data.mjs";

const TableStore = TableStorePkg.default ?? TableStorePkg;

const DRY_RUN = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");
const PROD_INSTANCES = new Set(["pd-dashboard"]);

// --- load .env.local if present (does not override real env) ---
function loadEnvLocal() {
  const p = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}
loadEnvLocal();

const { OTS_ENDPOINT, OTS_INSTANCE_NAME } = process.env;
const accessKeyId = process.env.ALIBABA_CLOUD_ACCESS_KEY_ID;
const accessKeySecret = process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET;
const roleArn = process.env.ALIBABA_CLOUD_ROLE_ARN;
const stsRegion = process.env.ALIBABA_CLOUD_REGION?.trim() || "ap-southeast-1";

if (!OTS_ENDPOINT || !OTS_INSTANCE_NAME || !accessKeyId || !accessKeySecret) {
  console.error(
    "Missing OTS config. Need OTS_ENDPOINT, OTS_INSTANCE_NAME, ALIBABA_CLOUD_ACCESS_KEY_ID, ALIBABA_CLOUD_ACCESS_KEY_SECRET."
  );
  process.exit(1);
}

if (PROD_INSTANCES.has(OTS_INSTANCE_NAME) || (!/qa/i.test(OTS_INSTANCE_NAME) && !FORCE)) {
  console.error(
    `Refusing to seed instance "${OTS_INSTANCE_NAME}" — it looks like production.\n` +
      `Point OTS_INSTANCE_NAME/OTS_ENDPOINT at a QA instance (name containing "qa").`
  );
  process.exit(1);
}

// --- schema cloned from terraform/locals.tf (table => primary key) ---
const TABLES = {
  pd_holdings: "holding_id",
  pd_snapshots: "snapshot_date",
  pd_visits: "visit_id",
  pd_visit_images: "image_id",
  pd_flights: "flight_id",
  pd_trains: "train_id",
  pd_movies: "douban_subject_id",
};

// --- dummy rows (see scripts/qa-seed-data.mjs) ---
const NOW = new Date().toISOString();
const SEED = buildQaSeed(NOW);

// --- STS AssumeRole (raw signed request; mirrors lib/alibaba-credentials.ts) ---
function percentEncode(v) {
  return encodeURIComponent(v).replace(/\+/g, "%20").replace(/\*/g, "%2A").replace(/%7E/g, "~");
}

async function assumeRole() {
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
    RoleSessionName: process.env.ALIBABA_CLOUD_ROLE_SESSION_NAME?.trim() || "qa-seed",
    DurationSeconds: "3600",
  };
  const canonical = Object.keys(params)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(params[k])}`)
    .join("&");
  const stringToSign = `GET&${percentEncode("/")}&${percentEncode(canonical)}`;
  const signature = crypto.createHmac("sha1", `${accessKeySecret}&`).update(stringToSign).digest("base64");
  const url = `https://sts.${stsRegion}.aliyuncs.com/?${canonical}&Signature=${percentEncode(signature)}`;
  const res = await fetch(url, { method: "GET" });
  const body = await res.json();
  if (!res.ok || !body.Credentials) {
    throw new Error(body.Message ?? `AssumeRole failed (HTTP ${res.status})`);
  }
  return {
    accessKeyId: body.Credentials.AccessKeyId,
    secretAccessKey: body.Credentials.AccessKeySecret,
    stsToken: body.Credentials.SecurityToken,
  };
}

async function getClient() {
  let creds = { accessKeyId, secretAccessKey: accessKeySecret };
  if (roleArn) {
    creds = await assumeRole();
    console.log("Using STS AssumeRole credentials.");
  } else {
    console.log("Using raw RAM keys (no ALIBABA_CLOUD_ROLE_ARN set).");
  }
  return new TableStore.Client({ ...creds, endpoint: OTS_ENDPOINT, instancename: OTS_INSTANCE_NAME });
}

function call(client, method, params) {
  return new Promise((resolve, reject) => {
    client[method](params, (err, data) => (err ? reject(err) : resolve(data)));
  });
}

async function listTables(client) {
  const res = await call(client, "listTable", {});
  return new Set(res.tableNames ?? []);
}

async function createTable(client, tableName, pk) {
  await call(client, "createTable", {
    tableMeta: { tableName, primaryKey: [{ name: pk, type: "STRING" }] },
    reservedThroughput: { capacityUnit: { read: 0, write: 0 } },
    tableOptions: { timeToLive: -1, maxVersions: 1 },
  });
}

async function putRow(client, tableName, pk, row) {
  await call(client, "putRow", {
    tableName,
    condition: new TableStore.Condition(TableStore.RowExistenceExpectation.IGNORE, null),
    primaryKey: [{ [pk]: String(row[pk]) }],
    attributeColumns: Object.entries(row)
      .filter(([k, v]) => k !== pk && v !== undefined && v !== null)
      .map(([k, v]) => ({ [k]: v })),
  });
}

async function main() {
  console.log(`Target OTS instance: ${OTS_INSTANCE_NAME} (${OTS_ENDPOINT})`);
  if (DRY_RUN) {
    console.log("[dry-run] Would create tables:", Object.keys(TABLES).join(", "));
    for (const [t, rows] of Object.entries(SEED)) {
      console.log(`[dry-run] Would seed ${rows.length} row(s) into ${t}`);
    }
    return;
  }

  const client = await getClient();
  const existing = await listTables(client);

  for (const [table, pk] of Object.entries(TABLES)) {
    if (existing.has(table)) {
      console.log(`Table ${table} already exists — skipping create.`);
    } else {
      await createTable(client, table, pk);
      console.log(`Created table ${table} (PK ${pk}).`);
    }
  }

  // OTS needs a moment after table creation before writes.
  await new Promise((r) => setTimeout(r, 8000));

  for (const [table, rows] of Object.entries(SEED)) {
    const pk = TABLES[table];
    for (const row of rows) {
      await putRow(client, table, pk, row);
    }
    if (rows.length) console.log(`Seeded ${rows.length} row(s) into ${table}.`);
  }

  console.log("QA seed complete.");
}

main().catch((e) => {
  console.error("QA seed failed:", e.message ?? e);
  process.exit(1);
});
