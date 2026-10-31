// GET /api/auth/logout  →  signs the player out of this site
const { clearSession } = require("../../lib/session");

module.exports = async (req, res) => {
  clearSession(res);
  res.statusCode = 302;
  res.setHeader("Location", "/");
  res.end();
};
