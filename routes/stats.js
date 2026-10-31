// GET /api/stats?type=3&id=4611…  →  all-time career stats by activity type,
// including a PvP breakdown (all Crucible, Quickplay, Competitive, Iron Banner, Trials).
const { bungie, handler, readMember } = require("../lib/bungie");

// [Bungie's key for the mode, label on the site, kind of stats to show]
const MODES = [
  ["allPvE", "PvE", "pve"],
  ["raid", "Raids", "pve"],
  ["dungeon", "Dungeons", "pve"],
  ["allPvP", "All Crucible", "pvp"],
  ["pvpQuickplay", "Quickplay", "pvp"],
  ["pvpCompetitive", "Competitive", "pvp"],
  ["ironBanner", "Iron Banner", "pvp"],
  ["trialsofosiris", "Trials of Osiris", "pvp"]
];

const FIELDS = [
  "activitiesCleared", "activitiesEntered", "activitiesWon",
  "kills", "deaths", "assists", "killsDeathsRatio", "efficiency", "combatRating",
  "precisionKills", "secondsPlayed", "bestSingleGameKills", "longestKillSpree"
];

// Bungie's keys vary in case and punctuation ("trialsofosiris", "trials_of_osiris")
const norm = (k) => k.toLowerCase().replace(/[^a-z0-9]/g, "");

module.exports = handler(async (query) => {
  const { type, id } = readMember(query);

  // Character 0 = combined across all characters.
  // Modes: 7 All PvE, 4 Raid, 82 Dungeon, 5 All PvP, 70 Quickplay, 69 Competitive, 19 Iron Banner, 84 Trials
  const res = await bungie(
    `/Destiny2/${type}/Account/${id}/Character/0/Stats/?modes=7,4,82,5,70,69,19,84&periodType=AllTime&groups=1`
  );

  const byKey = Object.fromEntries(Object.entries(res || {}).map(([k, v]) => [norm(k), v]));

  return MODES.map(([key, label, kind]) => {
    const allTime = byKey[norm(key)]?.allTime;
    if (!allTime) return null;
    const stats = {};
    for (const f of FIELDS) stats[f] = allTime[f]?.basic?.value ?? null;
    return { key, label, kind, stats };
  }).filter(Boolean);
}, 300);
