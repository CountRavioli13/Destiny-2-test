// GET /api/auth/callback  →  Bungie.net sends the player back here after sign-in
const { bungie } = require("../../lib/bungie");
const { tokenRequest, saveSession, parseCookies, addCookie, cookie } = require("../../lib/session");

module.exports = async (req, res) => {
  const query = new URL(req.url, "http://localhost").searchParams;

  const finish = (location) => {
    addCookie(res, cookie("gl_state", "", 0));
    res.statusCode = 302;
    res.setHeader("Location", location);
    res.end();
  };

  if (!query.get("code")) return finish("/?signin=cancelled");
  const expected = parseCookies(req).gl_state;
  if (!expected || expected !== query.get("state")) return finish("/?signin=expired");

  try {
    const tokens = await tokenRequest({ grant_type: "authorization_code", code: query.get("code") });
    const me = await bungie("/User/GetMembershipsForCurrentUser/", { token: tokens.at });

    const list = me.destinyMemberships || [];
    if (!list.length) return finish("/?signin=nodestiny");

    // Use the player's main (Cross Save) account.
    const main =
      list.find((m) => m.membershipId === me.primaryMembershipId) ||
      list.find((m) => m.crossSaveOverride === m.membershipType) ||
      list.find((m) => m.crossSaveOverride === 0) ||
      list[0];

    saveSession(res, {
      ...tokens,
      mt: main.membershipType,
      mid: main.membershipId,
      name: me.bungieNetUser?.cachedBungieGlobalDisplayName || main.bungieGlobalDisplayName || main.displayName || "Guardian",
      code: String(me.bungieNetUser?.cachedBungieGlobalDisplayNameCode ?? main.bungieGlobalDisplayNameCode ?? "").padStart(4, "0")
    });
    finish("/");
  } catch {
    finish("/?signin=failed");
  }
};
