// POST /api/transfer  →  act on the signed-in player's items.
// Body (JSON):
//   { action: "move" | "equip", itemId, itemHash, from, to }
//       from / to are a character id or "vault". Bungie only moves items
//       between a character and the vault, so character → character goes
//       through the vault in two steps.
//   { action: "lock" | "unlock", itemId, itemHash, from, to }
//       `to` is any of the player's character ids (Bungie requires one).
//   { action: "pull", itemId, itemHash, from, quantity }
//       pulls an item from `from`'s Postmaster (itemId "0" for stackables).
//   { action: "equipMany", itemIds: [...], to }
//       equips several items already on character `to` at once (loadouts).
//   { action: "plug", itemId, to, socketIndex, plugHash }
//       switches a perk to another option the item already has, for free
//       (the same change you can make in game). `to` is any of the player's character ids.
const { bungie, handler, readBody, HttpError } = require("../lib/bungie");
const { requireSession } = require("../lib/session");

const isId = (v) => /^\d{1,20}$/.test(String(v ?? ""));
const isPlace = (v) => v === "vault" || isId(v);
const bad = () => new HttpError(400, "That request was missing details. Refresh the page and try again.");

module.exports = handler(async (query, { req, res }) => {
  if (!String(req.headers["content-type"] || "").includes("application/json")) {
    throw new HttpError(415, "Send this request as JSON.");
  }
  const s = await requireSession(req, res);
  const body = await readBody(req);
  const { action, itemId, itemHash, from, to } = body;

  /* ---- Equip a whole loadout at once ---- */
  if (action === "equipMany") {
    const ids = Array.isArray(body.itemIds) ? body.itemIds.map(String) : [];
    if (!isId(to) || !ids.length || ids.length > 20 || !ids.every(isId)) throw bad();
    const r = await bungie("/Destiny2/Actions/Items/EquipItems/", {
      method: "POST",
      token: s.at,
      body: { itemIds: ids, characterId: String(to), membershipType: s.mt }
    });
    const results = r?.equipResults || [];
    return {
      equipped: results.filter((x) => x.equipStatus === 1).map((x) => String(x.itemInstanceId)),
      failed: results.filter((x) => x.equipStatus !== 1).map((x) => String(x.itemInstanceId))
    };
  }

  /* ---- Switch a perk ---- */
  if (action === "plug") {
    const socketIndex = Number(body.socketIndex);
    if (!isId(itemId) || !isId(to) || !isId(body.plugHash) || !Number.isInteger(socketIndex) || socketIndex < 0 || socketIndex > 30) throw bad();
    const r = await bungie("/Destiny2/Actions/Items/InsertSocketPlugFree/", {
      method: "POST",
      token: s.at,
      body: {
        plug: { socketIndex, socketArrayType: 0, plugItemHash: Number(body.plugHash) },
        itemId: String(itemId),
        characterId: String(to),
        membershipType: s.mt
      }
    });
    // Bungie usually returns the updated item; pass its perks and stats back if so
    const sockets = r?.item?.sockets?.data?.sockets;
    const stats = r?.item?.stats?.data?.stats;
    return {
      plugged: true, socketIndex, plugHash: Number(body.plugHash),
      ...(sockets ? { sockets: sockets.map((sk) => ({ plug: sk.plugHash ?? null, enabled: sk.isEnabled !== false, visible: sk.isVisible !== false })) } : {}),
      ...(stats ? { stats: Object.fromEntries(Object.entries(stats).filter(([h]) => h !== "1935470627").map(([h, v]) => [h, v.value])) } : {})
    };
  }

  /* ---- Pull from the Postmaster ---- */
  if (action === "pull") {
    const quantity = Math.max(1, Math.min(9999, Number(body.quantity) || 1));
    if (!isId(itemId) || !isId(itemHash) || !isId(from)) throw bad();
    await bungie("/Destiny2/Actions/Items/PullFromPostmaster/", {
      method: "POST",
      token: s.at,
      body: { itemReferenceHash: Number(itemHash), stackSize: quantity, itemId: String(itemId), characterId: String(from), membershipType: s.mt }
    });
    return { pulled: true };
  }

  if (!["move", "equip", "lock", "unlock"].includes(action) || !isId(itemId) || !isId(itemHash) || !isPlace(from) || !isPlace(to)) {
    throw bad();
  }

  /* ---- Lock / unlock ---- */
  if (action === "lock" || action === "unlock") {
    if (!isId(to)) throw bad();
    await bungie("/Destiny2/Actions/Items/SetLockState/", {
      method: "POST",
      token: s.at,
      body: { state: action === "lock", itemId: String(itemId), characterId: String(to), membershipType: s.mt }
    });
    return { location: from, locked: action === "lock" };
  }

  /* ---- Move / equip ---- */
  if (action === "equip" && to === "vault") throw new HttpError(400, "Items can't be equipped in the vault.");

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
