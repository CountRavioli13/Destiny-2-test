// Shared helpers for the API functions. Your API key is read from the
// BUNGIE_API_KEY environment variable and never reaches the browser.

const ROOT = "https://www.bungie.net/Platform";

class HttpError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

// Call a Bungie endpoint and return its "Response" field.
// Pass `token` to act as the signed-in player.
async function bungie(path, { method = "GET", body, token } = {}) {
  const key = process.env.BUNGIE_API_KEY;
  if (!key) throw new HttpError(500, "The server is missing its BUNGIE_API_KEY setting.");

  let res;
  try {
    res = await fetch(ROOT + path, {
      method,
      headers: {
        "X-API-Key": key,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { "Content-Type": "application/json" } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
  } catch {
    throw new HttpError(502, "Couldn't reach Bungie.net. Try again in a moment.");
  }

  const data = await res.json().catch(() => null);
  if (!data) throw new HttpError(502, `Bungie.net returned HTTP ${res.status} with no data.`);

  if (data.ErrorCode !== 1) {
    if (data.ErrorCode === 5) throw new HttpError(503, "Bungie.net is down for maintenance. Try again later.");
    if (data.ErrorCode === 1665) throw new HttpError(403, "This player has set their profile to private.");
    if (data.ErrorCode === 99 || data.ErrorCode === 22) throw new HttpError(401, "Your sign-in has expired. Sign in again.");
    throw new HttpError(400, data.Message || "Bungie.net returned an error.", { code: data.ErrorCode });
  }
  return data.Response;
}

function send(res, status, payload, cacheSeconds = 0) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader(
    "Cache-Control",
    cacheSeconds && status === 200
      ? `public, s-maxage=${cacheSeconds}, stale-while-revalidate=${cacheSeconds}`
      : "private, no-store"
  );
  res.end(JSON.stringify(payload));
}

// Read a JSON request body (Vercel may have parsed it already).
async function readBody(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  let raw = typeof req.body === "string" || Buffer.isBuffer(req.body) ? String(req.body) : "";
  if (!raw && req.body === undefined) for await (const chunk of req) raw += chunk;
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

// Wraps a function so it works as a Vercel function (and in dev-server.js).
// fn(query, { req, res }) returns JSON-able data.
function handler(fn, cacheSeconds = 0, methods = ["GET"]) {
  return async (req, res) => {
    try {
      if (!methods.includes(req.method)) throw new HttpError(405, "That request method isn't allowed here.");
      const query = new URL(req.url, "http://localhost").searchParams;
      send(res, 200, await fn(query, { req, res }), cacheSeconds);
    } catch (err) {
      send(res, err.status || 500, { error: err.message || "Something went wrong.", ...(err.extra || {}) });
    }
  };
}

// Reads and validates ?type=…&id=… (a player's platform and membership id).
function readMember(query) {
  const type = query.get("type") || "";
  const id = query.get("id") || "";
  if (!/^\d{1,3}$/.test(type) || !/^\d{1,20}$/.test(id)) {
    throw new HttpError(400, "Missing or invalid player id.");
  }
  return { type, id };
}

module.exports = { bungie, handler, readMember, readBody, HttpError };
