#!/usr/bin/env node
/**
 * Manage the public song list in OTS table www_songs (www.huhansen.cn/songs).
 * The page reads this table through the www-songs function. Nothing is stored in git.
 *
 *   node scripts/www-songs.mjs --dry-run import ./songs.json
 *   node scripts/www-songs.mjs --dry-run import --from mysonglist
 *   node scripts/www-songs.mjs --prod add --name "妥协" --singer "en"
 *   node scripts/www-songs.mjs --prod list
 *
 * --prod is required when OTS_INSTANCE_NAME is pd-dashboard (the live www site).
 * A name+singers pair that already exists is skipped. Set status to HIDDEN in
 * OTS to drop a song from the page without deleting the row.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  TABLE,
  PK,
  normalizeSongInput,
  rowToSong,
  planSongWrites,
} = require("../functions/www-songs/song-record.js");

const UPSTREAM =
  "https://raw.githubusercontent.com/deltamaster/mysonglist/main/public/songs.json";
const PROD_INSTANCES = new Set(["pd-dashboard"]);

function usage(exitCode = 1) {
  const write = exitCode === 0 ? console.log : console.error;
  write(`Usage:
  node scripts/www-songs.mjs [--prod] [--dry-run] import <songs.json>
  node scripts/www-songs.mjs [--prod] [--dry-run] import --from mysonglist
  node scripts/www-songs.mjs [--prod] [--dry-run] add --name "妥协" --singer "en" [--id rxxxxx]
  node scripts/www-songs.mjs [--prod] list
`);
  process.exit(exitCode);
}

function loadEnvLocal() {
  const file = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
}

function parseArgs(argv) {
  const opts = { prod: false, dryRun: false, command: "", from: "", file: "", songs: [] };
  let current = {};
  const flush = () => {
    if (current.name || current.singer || current.id) {
      opts.songs.push(current);
      current = {};
    }
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--prod") opts.prod = true;
    else if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--help" || arg === "-h") opts.command = "help";
    else if (arg === "--from") {
      if (!next) usage();
      opts.from = next;
      i++;
    } else if (arg === "--name") {
      if (current.name) flush();
      if (!next) usage();
      current.name = next;
      i++;
    } else if (arg === "--singer" || arg === "--singers") {
      if (!next) usage();
      current.singer = next;
      i++;
    } else if (arg === "--id") {
      if (!next) usage();
      current.id = next;
      i++;
    } else if (!opts.command && !arg.startsWith("-")) {
      opts.command = arg;
    } else if (opts.command === "import" && !arg.startsWith("-") && !opts.file) {
      opts.file = arg;
    } else {
      usage();
    }
  }
  flush();
  return opts;
}

function percentEncode(value) {
  return encodeURIComponent(value).replace(/\+/g, "%20").replace(/\*/g, "%2A").replace(/%7E/g, "~");
}

async function assumeRole(accessKeyId, accessKeySecret, roleArn) {
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
  const canonical = Object.keys(params)
    .sort()
    .map((key) => `${percentEncode(key)}=${percentEncode(params[key])}`)
    .join("&");
  const stringToSign = `GET&${percentEncode("/")}&${percentEncode(canonical)}`;
  const signature = crypto.createHmac("sha1", `${accessKeySecret}&`).update(stringToSign).digest("base64");
  const region = process.env.ALIBABA_CLOUD_REGION?.trim() || "cn-shanghai";
  const url = `https://sts.${region}.aliyuncs.com/?${canonical}&Signature=${percentEncode(signature)}`;
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

function call(client, method, params) {
  return new Promise((resolve, reject) => {
    client[method](params, (err, data) => (err ? reject(err) : resolve(data)));
  });
}

function rowToObject(row) {
  const result = {};
  for (const pk of row.primaryKey ?? []) result[pk.name] = pk.value;
  for (const attr of row.attributes ?? []) {
    const name = attr.columnName || attr.name;
    result[name] = attr.columnValue !== undefined ? attr.columnValue : attr.value;
  }
  return result;
}

async function listExisting(client, TableStore) {
  const songs = [];
  let startKey = [{ [PK]: TableStore.INF_MIN }];
  let done = false;
  while (!done) {
    const result = await call(client, "getRange", {
      tableName: TABLE,
      direction: TableStore.Direction.FORWARD,
      inclusiveStartPrimaryKey: startKey,
      exclusiveEndPrimaryKey: [{ [PK]: TableStore.INF_MAX }],
      limit: 100,
    });
    for (const row of result.rows ?? []) {
      const song = rowToSong(rowToObject(row));
      if (song) songs.push(song);
    }
    const next = result.nextStartPrimaryKey;
    if (next?.length) {
      const key = {};
      for (const item of next) key[item.name] = item.value;
      startKey = [key];
    } else done = true;
  }
  return songs;
}

async function loadIncoming(opts) {
  if (opts.command === "add") {
    if (!opts.songs.length) usage();
    return opts.songs.map(normalizeSongInput);
  }
  if (opts.command !== "import") usage();
  let text;
  if (opts.from === "mysonglist") {
    const res = await fetch(UPSTREAM);
    if (!res.ok) throw new Error(`Failed to fetch mysonglist songs.json (HTTP ${res.status})`);
    text = await res.text();
  } else if (opts.file) {
    text = fs.readFileSync(opts.file, "utf8");
  } else {
    usage();
  }
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error("Song file must be a JSON array");
  return parsed.map(normalizeSongInput);
}

async function connect() {
  const endpoint = process.env.OTS_ENDPOINT;
  const instancename = process.env.OTS_INSTANCE_NAME;
  const accessKeyId = process.env.ALIBABA_CLOUD_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET;
  const roleArn = process.env.ALIBABA_CLOUD_ROLE_ARN?.trim();
  if (!endpoint || !instancename) {
    throw new Error("Missing OTS_ENDPOINT or OTS_INSTANCE_NAME.");
  }
  const looksProd = PROD_INSTANCES.has(instancename) || !/qa/i.test(instancename);
  if (looksProd && !process.env.WWW_SONGS_ALLOW_PROD) {
    throw new Error(
      `Refusing instance "${instancename}". Pass --prod to manage the www.huhansen.cn song list.`
    );
  }
  if (!accessKeyId || !accessKeySecret) {
    throw new Error("Missing ALIBABA_CLOUD_ACCESS_KEY_ID or ALIBABA_CLOUD_ACCESS_KEY_SECRET.");
  }
  const TableStorePkg = require("tablestore");
  const TableStore = TableStorePkg.default ?? TableStorePkg;
  const creds = roleArn
    ? await assumeRole(accessKeyId, accessKeySecret, roleArn)
    : { accessKeyId, secretAccessKey: accessKeySecret };
  const client = new TableStore.Client({ ...creds, endpoint, instancename });
  return { client, TableStore, instancename };
}

async function putSong(client, TableStore, song) {
  await call(client, "putRow", {
    tableName: TABLE,
    condition: new TableStore.Condition(TableStore.RowExistenceExpectation.IGNORE, null),
    primaryKey: [{ [PK]: song.id }],
    attributeColumns: [
      { name: song.name },
      { singers: JSON.stringify(song.singers) },
      { status: song.status },
    ],
  });
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.command === "help") usage(0);
  if (!opts.command) usage(1);
  if (opts.prod) process.env.WWW_SONGS_ALLOW_PROD = "1";
  loadEnvLocal();

  if (opts.command === "list") {
    const { client, TableStore, instancename } = await connect();
    const songs = await listExisting(client, TableStore);
    console.log(JSON.stringify({ instance: instancename, table: TABLE, count: songs.length, songs }, null, 2));
    return;
  }

  const incoming = await loadIncoming(opts);
  if (opts.dryRun && !process.env.OTS_ENDPOINT && !process.env.ALIBABA_CLOUD_ACCESS_KEY_ID) {
    const planned = planSongWrites([], incoming);
    console.log(JSON.stringify({ dryRun: true, checkedAgainstOts: false, ...planned }, null, 2));
    return;
  }

  const { client, TableStore, instancename } = await connect();
  const existing = await listExisting(client, TableStore);
  const planned = planSongWrites(existing, incoming);
  if (opts.dryRun) {
    console.log(
      JSON.stringify({ dryRun: true, instance: instancename, checkedAgainstOts: true, ...planned }, null, 2)
    );
    return;
  }
  for (const song of planned.added) {
    await putSong(client, TableStore, song);
  }
  console.log(
    JSON.stringify(
      {
        instance: instancename,
        table: TABLE,
        added: planned.added,
        skipped: planned.skipped,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
