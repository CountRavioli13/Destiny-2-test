// Shared helpers for the API functions. Your API key is read from the
// BUNGIE_API_KEY environment variable and never reaches the browser.

const ROOT = "https://www.bungie.net/Platform";

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Call a Bungie endpoint and return its "Response" field.
async function bungie(path, { method = "GET", body } = {}) {
  const key = process.env.BUNGIE_API_KEY;
  if (!key) throw new HttpError(500, "The server is missing its BUNGIE_API_KEY setting.");

  let res;
  try {
    res = await fetch(ROOT + path, {
      method,
      headers: { "X-API-Key": key, ...(body ? { "Content-Type": "application/json" } : {}) },
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
    throw new HttpError(400, data.Message || "Bungie.net returned an error.");
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
      : "no-store"
  );
  res.end(JSON.stringify(payload));
}

// Wraps a function so it works as a Vercel function (and in dev-server.js).
// fn receives the URL's query parameters and returns JSON-able data.
function handler(fn, cacheSeconds = 0) {
  return async (req, res) => {
    try {
      const query = new URL(req.url, "http://localhost").searchParams;
      send(res, 200, await fn(query), cacheSeconds);
    } catch (err) {
      send(res, err.status || 500, { error: err.message || "Something went wrong." });
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

module.exports = { bungie, handler, readMember, HttpError };
