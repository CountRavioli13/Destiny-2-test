// GET /api/me  →  who is signed in (if anyone)
const { handler } = require("../lib/bungie");
const { getSession } = require("../lib/session");

module.exports = handler(async (query, { req, res }) => {
  const configured = Boolean(process.env.BUNGIE_CLIENT_ID && process.env.BUNGIE_CLIENT_SECRET);
  const s = configured ? await getSession(req, res) : null;
  if (!s) return { configured, signedIn: false };
  return { configured, signedIn: true, name: s.name, code: s.code, membershipType: s.mt, membershipId: s.mid };
});
