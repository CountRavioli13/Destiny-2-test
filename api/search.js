// GET /api/search?name=Name%231234  →  the player's active Destiny account
const { bungie, handler, HttpError } = require("../lib/bungie");

const PLATFORMS = { 1: "Xbox", 2: "PlayStation", 3: "Steam", 5: "Stadia", 6: "Epic Games", 254: "Bungie.net" };

module.exports = handler(async (query) => {
  const raw = (query.get("name") || "").trim();
  const hash = raw.lastIndexOf("#");
  const displayName = raw.slice(0, hash).trim();
  const code = raw.slice(hash + 1).trim();

  if (hash < 1 || !displayName || !/^\d{1,4}$/.test(code)) {
    throw new HttpError(400, 'Enter a full Bungie Name with its code, like "Name#1234".');
  }

  const matches = await bungie("/Destiny2/SearchDestinyPlayerByBungieName/-1/", {
    method: "POST",
    body: { displayName, displayNameCode: Number(code) }
  });

  if (!matches || !matches.length) {
    throw new HttpError(404, `No player found named ${displayName}#${code.padStart(4, "0")}. Check the spelling and the 4-digit code.`);
  }

  // With Cross Save, one account per platform comes back. Use the active one.
  const m =
    matches.find((x) => x.crossSaveOverride === x.membershipType) ||
    matches.find((x) => x.crossSaveOverride === 0) ||
    matches[0];

  return {
    membershipType: m.membershipType,
    membershipId: m.membershipId,
    name: m.bungieGlobalDisplayName || displayName,
    code: String(m.bungieGlobalDisplayNameCode ?? code).padStart(4, "0"),
    platform: PLATFORMS[m.membershipType] || "Unknown platform",
    crossSave: m.crossSaveOverride !== 0
  };
}, 300);
