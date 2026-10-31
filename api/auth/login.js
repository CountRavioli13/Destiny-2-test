// GET /api/auth/login  →  sends the player to Bungie.net to sign in
const crypto = require("crypto");
const { addCookie, cookie } = require("../../lib/session");

module.exports = async (req, res) => {
  const clientId = process.env.BUNGIE_CLIENT_ID;
  res.statusCode = 302;
  if (!clientId) {
    res.setHeader("Location", "/?signin=notconfigured");
    return res.end();
  }
  // A random value we check on the way back, so nobody can fake a sign-in.
  const state = crypto.randomBytes(16).toString("hex");
  addCookie(res, cookie("gl_state", state, 600));
  res.setHeader(
    "Location",
    `https://www.bungie.net/en/OAuth/Authorize?client_id=${encodeURIComponent(clientId)}&response_type=code&state=${state}`
  );
  res.end();
};
