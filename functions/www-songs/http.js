function parseRequest(event) {
  let payload = event;
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(event)) {
    payload = event.toString("utf8");
  }
  if (typeof payload === "string") {
    if (!payload.trim()) payload = {};
    else {
      try {
        payload = JSON.parse(payload);
      } catch {
        payload = {};
      }
    }
  }
  if (!payload || typeof payload !== "object") payload = {};
  const method = String(
    payload.requestContext?.http?.method || payload.httpMethod || "GET"
  ).toUpperCase();
  return { method };
}

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  };
}

module.exports = { parseRequest, jsonResponse };
