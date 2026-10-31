// GET /api/inventory  →  the signed-in player's weapons and armor (vault,
// character inventories and equipped), with each item's stats and active
// perks, plus whatever is waiting at each character's Postmaster.
const { bungie, handler } = require("../lib/bungie");
const { requireSession } = require("../lib/session");

const VAULT_BUCKET = 138197802;
const POSTMASTER_BUCKET = 215593132;
const GEAR_BUCKETS = new Set([
  1498876634, 2465295065, 953998645,                     // kinetic, energy, power
  3448274439, 3551918588, 14239492, 20886954, 1585787867 // helmet, arms, chest, legs, class item
]);
const POWER_STAT = "1935470627";

const img = (path) => (path ? "https://www.bungie.net" + path : null);

module.exports = handler(async (query, { req, res }) => {
  const s = await requireSession(req, res);

  // 102 vault, 200 characters, 201 character inventories, 205 equipped,
  // 300 item details, 304 item stats, 305 item sockets (perks and mods)
  const p = await bungie(`/Destiny2/${s.mt}/Profile/${s.mid}/?components=102,200,201,205,300,304,305`, { token: s.at });

  const instances = p.itemComponents?.instances?.data || {};
  const statsById = p.itemComponents?.stats?.data || {};
  const socketsById = p.itemComponents?.sockets?.data || {};

  const items = [];
  const add = (it, loc, equipped) => {
    if (!it.itemInstanceId) return;
    const id = it.itemInstanceId;
    const inst = instances[id] || {};
    items.push({
      id,
      hash: it.itemHash,
      loc,
      equipped,
      power: inst.primaryStat?.value ?? null,
      damage: inst.damageType ?? 0,
      locked: Boolean(it.state & 1),
      masterwork: Boolean(it.state & 4),
      crafted: Boolean(it.state & 8),
      ornament: it.overrideStyleItemHash || null,
      stats: Object.fromEntries(
        Object.entries(statsById[id]?.stats || {}).filter(([h]) => h !== POWER_STAT).map(([h, v]) => [h, v.value])
      ),
      plugs: (socketsById[id]?.sockets || []).filter((sk) => sk.plugHash && sk.isVisible !== false).map((sk) => sk.plugHash)
    });
  };

  const postmaster = [];
  for (const it of p.profileInventory?.data?.items || []) {
    if (it.bucketHash === VAULT_BUCKET) add(it, "vault", false);
  }
  for (const [charId, inv] of Object.entries(p.characterInventories?.data || {})) {
    for (const it of inv.items || []) {
      if (GEAR_BUCKETS.has(it.bucketHash)) add(it, charId, false);
      else if (it.bucketHash === POSTMASTER_BUCKET) {
        postmaster.push({
          id: it.itemInstanceId || null,
          hash: it.itemHash,
          charId,
          quantity: it.quantity || 1,
          power: it.itemInstanceId ? instances[it.itemInstanceId]?.primaryStat?.value ?? null : null
        });
      }
    }
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

  return { characters, items, postmaster, membershipId: s.mid };
});
