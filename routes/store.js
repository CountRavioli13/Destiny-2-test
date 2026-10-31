// GET /api/store   →  the signed-in player's saved loadouts and item tags
// PUT /api/store   →  save them  (body: { data: { loadouts, tags } })
//
// Uses a Redis database from Vercel's Storage tab (Upstash, free tier).
// Vercel adds KV_REST_API_URL and KV_REST_API_TOKEN (or the UPSTASH_REDIS_REST_*
// equivalents) when you connect it. Without them, the site keeps this data in
// the browser only and this route answers { available: false }.
const { handler, readBody, HttpError } = require("../lib/bungie");
const { requireSession } = require("../lib/session");

function database() {
  const url = (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "").trim();
  const token = (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();
  return url && token ? { url, token } : null;
}

async function command(db, args) {
  let res;
  try {
    res = await fetch(db.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${db.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(args)
    });
  } catch {
    throw new HttpError(502, "Couldn't reach the cloud save database.");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.error) throw new HttpError(502, `Cloud save failed: ${data?.error || `HTTP ${res.status}`}`);
  return data.result;
}

module.exports = handler(async (query, { req, res }) => {
  const s = await requireSession(req, res);
  const db = database();
  if (!db) return { available: false };
  const key = `guardian-lookup:user:${s.mid}`;

  if (req.method === "GET") {
    const raw = await command(db, ["GET", key]);
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch {}
    return { available: true, data };
  }

  if (!String(req.headers["content-type"] || "").includes("application/json")) {
    throw new HttpError(415, "Send this request as JSON.");
  }
  const body = await readBody(req);
  const data = body?.data;
  if (!data || typeof data !== "object") throw new HttpError(400, "Nothing to save.");
  const clean = {
    loadouts: Array.isArray(data.loadouts) ? data.loadouts.slice(0, 200) : [],
    tags: data.tags && typeof data.tags === "object" && !Array.isArray(data.tags) ? data.tags : {},
    updated: Number(data.updated) || Date.now()
  };
  const text = JSON.stringify(clean);
  if (text.length > 500000) throw new HttpError(413, "That's too much to save. Remove some loadouts or notes.");
  await command(db, ["SET", key, text]);
  return { available: true, saved: true, updated: clean.updated };
}, 0, ["GET", "PUT"]);
