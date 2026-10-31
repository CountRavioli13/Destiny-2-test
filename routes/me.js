// GET /api/me  →  who is signed in (if anyone), and whether sign-in is set up
const { handler } = require("../lib/bungie");
const { itemDefs } = require("../lib/manifest");
const { getSession } = require("../lib/session");

module.exports = handler(async (query, { req, res }) => {
  // Report which settings are missing (names only, never values) to help setup.
  const missing = ["BUNGIE_API_KEY", "BUNGIE_CLIENT_ID", "BUNGIE_CLIENT_SECRET"]
    .filter((name) => !(process.env[name] || "").trim());
  const configured = !missing.includes("BUNGIE_CLIENT_ID") && !missing.includes("BUNGIE_CLIENT_SECRET");

  const s = configured ? await getSession(req, res) : null;
  if (!s) return { configured, missing, signedIn: false };
  itemDefs(); // warm up the item file so the vault's names and icons load fast
  return { configured, missing, signedIn: true, name: s.name, code: s.code, membershipType: s.mt, membershipId: s.mid };
});
