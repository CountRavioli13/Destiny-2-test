// GET /api/profile?type=3&id=4611…  →  characters and their equipped gear
const { bungie, handler, readMember } = require("../lib/bungie");

// Equipment slots we show, by Bungie's inventory bucket hash.
const SLOTS = {
  3284755031: "subclass",
  1498876634: "kinetic",
  2465295065: "energy",
  953998645: "power",
  3448274439: "helmet",
  3551918588: "arms",
  14239492: "chest",
  20886954: "legs",
  1585787867: "classItem"
};

module.exports = handler(async (query) => {
  const { type, id } = readMember(query);

  // 200 = characters, 205 = equipped items, 300 = item instances (power levels)
  const p = await bungie(`/Destiny2/${type}/Profile/${id}/?components=200,205,300`);

  const instances = p.itemComponents?.instances?.data || {};
  const equipment = p.characterEquipment?.data || {};

  const characters = Object.values(p.characters?.data || {})
    .sort((a, b) => new Date(b.dateLastPlayed) - new Date(a.dateLastPlayed))
    .map((c) => ({
      id: c.characterId,
      classType: c.classType,
      raceType: c.raceType,
      light: c.light,
      minutesPlayed: Number(c.minutesPlayedTotal) || 0,
      lastPlayed: c.dateLastPlayed,
      emblem: c.emblemBackgroundPath ? "https://www.bungie.net" + c.emblemBackgroundPath : null,
      gear: (equipment[c.characterId]?.items || [])
        .filter((item) => SLOTS[item.bucketHash])
        .map((item) => ({
          slot: SLOTS[item.bucketHash],
          hash: item.itemHash,
          power: instances[item.itemInstanceId]?.primaryStat?.value ?? null
        }))
    }));

  return { characters };
}, 60);
