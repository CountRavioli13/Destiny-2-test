// POST /api/transfer  →  move or equip one of the signed-in player's items
// Body: { action: "move" | "equip" | "lock" | "unlock", itemId, itemHash, from, to }
//   For lock/unlock, `to` is any of the player's character ids (Bungie requires one).
//   from / to are a character id or "vault".
// Bungie only moves items between a character and the vault, so moving
// character → character goes through the vault in two steps.
const { bungie, handler, readBody, HttpError } = require("../lib/bungie");
const { requireSession } = require("../lib/session");

const isId = (v) => /^\d{1,20}$/.test(String(v ?? ""));
const isPlace = (v) => v === "vault" || isId(v);

module.exports = handler(async (query, { req, res }) => {
  if (!String(req.headers["content-type"] || "").includes("application/json")) {
    throw new HttpError(415, "Send this request as JSON.");
  }
  const s = await requireSession(req, res);
  const { action, itemId, itemHash, from, to } = await readBody(req);

  if (!["move", "equip", "lock", "unlock"].includes(action) || !isId(itemId) || !isId(itemHash) || !isPlace(from) || !isPlace(to)) {
    throw new HttpError(400, "That request was missing details. Refresh the page and try again.");
  }
  if (action === "equip" && to === "vault") throw new HttpError(400, "Items can't be equipped in the vault.");

  if (action === "lock" || action === "unlock") {
    if (!isId(to)) throw new HttpError(400, "That request was missing details. Refresh the page and try again.");
    await bungie("/Destiny2/Actions/Items/SetLockState/", {
      method: "POST",
      token: s.at,
      body: { state: action === "lock", itemId: String(itemId), characterId: String(to), membershipType: s.mt }
    });
    return { location: from, locked: action === "lock" };
  }

  const transfer = (characterId, toVault) =>
    bungie("/Destiny2/Actions/Items/TransferItem/", {
      method: "POST",
      token: s.at,
      body: {
        itemReferenceHash: Number(itemHash),
        stackSize: 1,
        transferToVault: toVault,
        itemId: String(itemId),
        characterId: String(characterId),
        membershipType: s.mt
      }
    });

  // If a later step fails, tell the page where the item actually ended up.
  const partial = (err, location, what) =>
    location !== from ? new HttpError(err.status || 400, `${what} ${err.message}`, { location }) : err;

  let location = from;
  if (from !== to) {
    if (from !== "vault") {
      await transfer(from, true);
      location = "vault";
    }
    if (to !== "vault") {
      try {
        await transfer(to, false);
        location = to;
      } catch (err) {
        throw partial(err, location, "It's in your vault now, but couldn't go to the character:");
      }
    }
  }

  let equipped = false;
  if (action === "equip") {
    try {
      await bungie("/Destiny2/Actions/Items/EquipItem/", {
        method: "POST",
        token: s.at,
        body: { itemId: String(itemId), characterId: String(to), membershipType: s.mt }
      });
      equipped = true;
    } catch (err) {
      throw partial(err, location, "It was moved, but couldn't be equipped:");
    }
  }

  return { location, equipped };
}, 0, ["POST"]);
