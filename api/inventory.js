// GET /api/inventory  →  the signed-in player's weapons and armor:
// everything in the vault, on each character, and currently equipped.
const { bungie, handler } = require("../lib/bungie");
const { requireSession } = require("../lib/session");

const VAULT_BUCKET = 138197802;
const GEAR_BUCKETS = new Set([
  1498876634, 2465295065, 953998645,                     // kinetic, energy, power
  3448274439, 3551918588, 14239492, 20886954, 1585787867 // helmet, arms, chest, legs, class item
]);

const img = (path) => (path ? "https://www.bungie.net" + path : null);

module.exports = handler(async (query, { req, res }) => {
  const s = await requireSession(req, res);

  // 102 vault, 200 characters, 201 character inventories, 205 equipped, 300 item details
  const p = await bungie(`/Destiny2/${s.mt}/Profile/${s.mid}/?components=102,200,201,205,300`, { token: s.at });

  const instances = p.itemComponents?.instances?.data || {};
  const items = [];
  const add = (it, loc, equipped) => {
    if (!it.itemInstanceId) return;
    const inst = instances[it.itemInstanceId] || {};
    items.push({
      id: it.itemInstanceId,
      hash: it.itemHash,
      loc,
      equipped,
      power: inst.primaryStat?.value ?? null,
      damage: inst.damageType ?? 0,
      locked: Boolean(it.state & 1)
    });
  };

  for (const it of p.profileInventory?.data?.items || []) {
    if (it.bucketHash === VAULT_BUCKET) add(it, "vault", false);
  }
  for (const [charId, inv] of Object.entries(p.characterInventories?.data || {})) {
    for (const it of inv.items || []) if (GEAR_BUCKETS.has(it.bucketHash)) add(it, charId, false);
  }
  for (const [charId, eq] of Object.entries(p.characterEquipment?.data || {})) {
    for (const it of eq.items || []) if (GEAR_BUCKETS.has(it.bucketHash)) add(it, charId, true);
  }

  const characters = Object.values(p.characters?.data || {})
    .sort((a, b) => new Date(b.dateLastPlayed) - new Date(a.dateLastPlayed))
    .map((c) => ({
      id: c.characterId,
      classType: c.classType,
      raceType: c.raceType,
      titleHash: c.titleRecordHash ?? null,
      light: c.light,
      emblem: img(c.emblemBackgroundPath),
      emblemIcon: img(c.emblemPath)
    }));

  return { characters, items };
});
