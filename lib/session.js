// Bungie sign-in sessions.
// Tokens are kept in an encrypted, HttpOnly cookie in the player's browser,
// so the site needs no database. Requires BUNGIE_CLIENT_ID and BUNGIE_CLIENT_SECRET.

const crypto = require("crypto");
const { HttpError } = require("./bungie");

const COOKIE = "gl_session";

function secretKey() {
  const secret = (process.env.BUNGIE_CLIENT_SECRET || "").trim();
  if (!secret) throw new HttpError(500, "Sign-in isn't set up on this site yet.");
  return crypto.createHash("sha256").update("guardian-lookup-session:" + secret).digest();
}

function seal(obj) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", secretKey(), iv);
  const enc = Buffer.concat([cipher.update(JSON.stringify(obj), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64url");
}

function unseal(str) {
  try {
    const buf = Buffer.from(str, "base64url");
    const decipher = crypto.createDecipheriv("aes-256-gcm", secretKey(), buf.subarray(0, 12));
    decipher.setAuthTag(buf.subarray(12, 28));
    return JSON.parse(Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8"));
  } catch {
    return null;
  }
}

function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || "").split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    try { out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); } catch {}
  }
  return out;
}

function cookie(name, value, maxAgeSeconds) {
  // dev-server.js runs on plain http, where browsers may drop "Secure" cookies.
  const secure = process.env.GL_DEV_HTTP ? "" : " Secure;";
  return `${name}=${value}; Path=/; HttpOnly;${secure} SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

function addCookie(res, value) {
  const prev = res.getHeader("Set-Cookie");
  res.setHeader("Set-Cookie", [...(prev ? [].concat(prev) : []), value]);
}

function saveSession(res, s) {
  addCookie(res, cookie(COOKIE, seal(s), Math.max(60, Math.floor((s.rexp - Date.now()) / 1000))));
}

function clearSession(res) {
  addCookie(res, cookie(COOKIE, "", 0));
}

// Exchange a sign-in code or refresh token for access tokens.
async function tokenRequest(params) {
  const id = (process.env.BUNGIE_CLIENT_ID || "").trim();
  const secret = (process.env.BUNGIE_CLIENT_SECRET || "").trim();
  if (!id || !secret) throw new HttpError(500, "Sign-in isn't set up on this site yet.");

  let res;
  try {
    res = await fetch("https://www.bungie.net/Platform/App/OAuth/Token/", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"),
        "X-API-Key": process.env.BUNGIE_API_KEY || ""
      },
      body: new URLSearchParams(params).toString()
    });
  } catch {
    throw new HttpError(502, "Couldn't reach Bungie.net to sign in.");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.access_token) {
    throw new HttpError(401, data?.error_description || "Bungie.net didn't accept the sign-in. Sign in again.");
  }
  const now = Date.now();
  return {
    at: data.access_token,
    exp: now + Math.max(60, (data.expires_in || 3600) - 60) * 1000,
    rt: data.refresh_token || null,
    rexp: now + (data.refresh_expires_in || 7776000) * 1000,
    bnid: data.membership_id
  };
}

// Returns the signed-in session (refreshing the access token if needed), or null.
async function getSession(req, res) {
  const raw = parseCookies(req)[COOKIE];
  if (!raw) return null;
  let s = unseal(raw);
  if (!s) { clearSession(res); return null; }
  if (Date.now() < s.exp) return s;
  if (!s.rt || Date.now() >= s.rexp) { clearSession(res); return null; }
  try {
    const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: s.rt });
    s = { ...s, ...t, rt: t.rt || s.rt, bnid: t.bnid || s.bnid };
    saveSession(res, s);
    return s;
  } catch {
    clearSession(res);
    return null;
  }
}

async function requireSession(req, res) {
  const s = await getSession(req, res);
  if (!s) throw new HttpError(401, "Sign in with Bungie to use the vault.");
  return s;
}

module.exports = {
  getSession, requireSession, saveSession, clearSession, tokenRequest,
  parseCookies, addCookie, cookie, seal
};
