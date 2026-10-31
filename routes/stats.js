// GET /api/stats?type=3&id=4611…  →  all-time career stats by activity type
const { bungie, handler, readMember } = require("../lib/bungie");

// [Bungie's key for the mode, label on the site, kind of stats to show]
const MODES = [
  ["allPvE", "PvE", "pve"],
  ["raid", "Raids", "pve"],
  ["dungeon", "Dungeons", "pve"],
  ["allPvP", "Crucible", "pvp"],
  ["trialsofosiris", "Trials of Osiris", "pvp"]
];

const FIELDS = [
  "activitiesCleared", "activitiesEntered", "activitiesWon",
  "kills", "deaths", "killsDeathsRatio", "efficiency",
  "precisionKills", "secondsPlayed", "bestSingleGameKills"
];

module.exports = handler(async (query) => {
  const { type, id } = readMember(query);

  // Character 0 = combined across all characters.
  // Modes: 7 All PvE, 4 Raid, 82 Dungeon, 5 All PvP, 84 Trials of Osiris
  const res = await bungie(
    `/Destiny2/${type}/Account/${id}/Character/0/Stats/?modes=7,4,82,5,84&periodType=AllTime&groups=1`
  );

  const byKey = Object.fromEntries(Object.entries(res || {}).map(([k, v]) => [k.toLowerCase(), v]));

  return MODES.map(([key, label, kind]) => {
    const allTime = byKey[key.toLowerCase()]?.allTime;
    if (!allTime) return null;
    const stats = {};
    for (const f of FIELDS) stats[f] = allTime[f]?.basic?.value ?? null;
    return { key, label, kind, stats };
  }).filter(Boolean);
}, 300);
