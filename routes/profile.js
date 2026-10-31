// GET /api/profile?type=3&id=4611…
// → Guardian Rank, Triumph score, clan, and each character with stats, title and gear
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
const POWER_STAT = "1935470627"; // shown separately as the character's Power

const img = (path) => (path ? "https://www.bungie.net" + path : null);

module.exports = handler(async (query) => {
  const { type, id } = readMember(query);

  // 100 profile, 200 characters, 205 equipped items, 300 item power, 900 triumphs
  const [p, clanRes] = await Promise.all([
    bungie(`/Destiny2/${type}/Profile/${id}/?components=100,200,205,300,900`),
    bungie(`/GroupV2/User/${type}/${id}/0/1/`).catch(() => null)
  ]);

  const instances = p.itemComponents?.instances?.data || {};
  const equipment = p.characterEquipment?.data || {};
  const group = clanRes?.results?.[0]?.group;

  const characters = Object.values(p.characters?.data || {})
    .sort((a, b) => new Date(b.dateLastPlayed) - new Date(a.dateLastPlayed))
    .map((c) => ({
      id: c.characterId,
      classType: c.classType,
      raceType: c.raceType,
      light: c.light,
      minutesPlayed: Number(c.minutesPlayedTotal) || 0,
      lastPlayed: c.dateLastPlayed,
      emblem: img(c.emblemBackgroundPath),
      emblemIcon: img(c.emblemPath),
      titleHash: c.titleRecordHash ?? null,
      stats: Object.fromEntries(Object.entries(c.stats || {}).filter(([hash]) => hash !== POWER_STAT)),
      gear: (equipment[c.characterId]?.items || [])
        .filter((item) => SLOTS[item.bucketHash])
        .map((item) => ({
          slot: SLOTS[item.bucketHash],
          hash: item.itemHash,
          power: instances[item.itemInstanceId]?.primaryStat?.value ?? null
        }))
    }));

  return {
    guardianRank: p.profile?.data?.currentGuardianRank ?? null,
    triumphScore: p.profileRecords?.data?.activeScore ?? null,
    clan: group
      ? { id: group.groupId, name: group.name, tag: group.clanInfo?.clanCallsign || "", members: group.memberCount ?? null }
      : null,
    characters
  };
}, 60);
