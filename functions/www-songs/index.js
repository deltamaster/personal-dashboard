const TableStore = require("tablestore");
const { getCredentials } = require("./credentials");
const { parseRequest, jsonResponse } = require("./http");
const { PK, TABLE, isListedSong, rowToSong, toPublicSong } = require("./song-record");

let clientCache = null;

function rowToObject(row) {
  const result = {};
  for (const pk of row.primaryKey ?? []) {
    result[pk.name] = pk.value;
  }
  for (const attr of row.attributes ?? []) {
    const name = attr.columnName || attr.name;
    const value = attr.columnValue !== undefined ? attr.columnValue : attr.value;
    if (name) result[name] = value;
  }
  return result;
}

function otsCall(client, method, params) {
  return new Promise((resolve, reject) => {
    client[method](params, (err, data) => (err ? reject(err) : resolve(data)));
  });
}

async function getClient() {
  const endpoint = process.env.OTS_ENDPOINT;
  const instancename = process.env.OTS_INSTANCE_NAME;
  if (!endpoint || !instancename) {
    throw new Error("Missing OTS_ENDPOINT or OTS_INSTANCE_NAME");
  }
  const creds = await getCredentials();
  const key = [creds.accessKeyId, creds.securityToken ?? "", endpoint, instancename].join("|");
  if (clientCache?.key === key) return clientCache.client;
  const client = new TableStore.Client({
    accessKeyId: creds.accessKeyId,
    secretAccessKey: creds.accessKeySecret,
    stsToken: creds.securityToken,
    endpoint,
    instancename,
  });
  clientCache = { key, client };
  return client;
}

async function listSongs(client) {
  const tableName = process.env.SONGS_TABLE || TABLE;
  const songs = [];
  let startKey = [{ [PK]: TableStore.INF_MIN }];
  let done = false;

  while (!done) {
    const result = await otsCall(client, "getRange", {
      tableName,
      direction: TableStore.Direction.FORWARD,
      inclusiveStartPrimaryKey: startKey,
      exclusiveEndPrimaryKey: [{ [PK]: TableStore.INF_MAX }],
      limit: 100,
    });

    for (const row of result.rows ?? []) {
      const song = rowToSong(rowToObject(row));
      if (song && isListedSong(song)) songs.push(toPublicSong(song));
    }

    const next = result.nextStartPrimaryKey;
    if (next?.length) {
      const key = {};
      for (const item of next) key[item.name] = item.value;
      startKey = [key];
    } else {
      done = true;
    }
  }

  return songs;
}

exports.handler = async (event) => {
  const { method } = parseRequest(event);
  if (method === "OPTIONS") return jsonResponse(204, "");
  if (method !== "GET" && method !== "HEAD") return jsonResponse(405, { error: "method not allowed" });

  try {
    const songs = await listSongs(await getClient());
    if (method === "HEAD") return jsonResponse(200, "");
    return jsonResponse(200, songs);
  } catch (err) {
    console.error("list songs failed", err && err.message ? err.message : err);
    return jsonResponse(500, { error: "song list unavailable" });
  }
};

exports.listSongs = listSongs;
exports.rowToObject = rowToObject;
