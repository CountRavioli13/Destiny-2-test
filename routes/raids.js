// GET /api/raids?type=3&id=4611…  →  clears and stats for each raid, all characters combined.
// Bungie keeps these per activity version (Normal, Master, older versions), so
// versions are grouped under the raid's name.
const { bungie, handler, readMember } = require("../lib/bungie");
const { resolve } = require("./items");

const RAID_MODE = 4;
const RAID_TYPE = 2043403989;

module.exports = handler(async (query) => {
  const { type, id } = readMember(query);

  const p = await bungie(`/Destiny2/${type}/Profile/${id}/?components=200`);
  const charIds = Object.keys(p.characters?.data || {});

  const lists = await Promise.all(charIds.map((c) =>
    bungie(`/Destiny2/${type}/Account/${id}/Character/${c}/Stats/AggregateActivityStats/`).catch(() => null)));

  // Add up each activity across characters
  const totals = new Map();
  for (const r of lists) {
    for (const a of r?.activities || []) {
      const v = (k) => a.values?.[k]?.basic?.value || 0;
      const t = totals.get(a.activityHash) || { clears: 0, kills: 0, deaths: 0, assists: 0, seconds: 0, fastestMs: 0 };
      t.clears += v("activityCompletions");
      t.kills += v("activityKills");
      t.deaths += v("activityDeaths");
      t.assists += v("activityAssists");
      t.seconds += v("activitySecondsPlayed");
      const fast = v("fastestCompletionMsForActivity");
      if (fast > 0 && (!t.fastestMs || fast < t.fastestMs)) t.fastestMs = fast;
      totals.set(a.activityHash, t);
    }
  }

  const played = [...totals.entries()].filter(([, t]) => t.clears > 0 || t.seconds > 0).map(([h]) => String(h));
  const defs = await resolve("activityInfo", played);

  const raids = new Map();
  for (const h of played) {
    const d = defs[h];
    if (!d || !(d.mode === RAID_MODE || d.modes.includes(RAID_MODE) || d.typeHash === RAID_TYPE)) continue;
    let name = d.name.split(":")[0].replace(/\s*\((contest|legacy)[^)]*\)\s*/i, "").trim();
    // Pantheon's weekly boss rushes are listed under their own names
    if (/^(the )?pantheon$/i.test(name) || /^featured (reprise|encore)/i.test(name)) name = "Pantheon";
    if (!name) continue;
    const t = totals.get(Number(h));
    const r = raids.get(name) || { name, image: d.image, clears: 0, masterClears: 0, kills: 0, deaths: 0, assists: 0, seconds: 0, fastestMs: 0 };
    r.clears += t.clears;
    if (/master|prestige/i.test(d.name)) r.masterClears += t.clears;
    r.kills += t.kills;
    r.deaths += t.deaths;
    r.assists += t.assists;
    r.seconds += t.seconds;
    if (t.fastestMs && (!r.fastestMs || t.fastestMs < r.fastestMs)) r.fastestMs = t.fastestMs;
    if (!r.image && d.image) r.image = d.image;
    raids.set(name, r);
  }

  const list = [...raids.values()].sort((a, b) => b.clears - a.clears || b.seconds - a.seconds);
  return { raids: list, totalClears: list.reduce((s, r) => s + r.clears, 0) };
}, 600);
