// GET /api/items?type=item&hashes=123,456
// → names, icons and details for game definitions (items, stats, titles, activities)
const { bungie, handler, HttpError } = require("../lib/bungie");

const img = (path) => (path ? "https://www.bungie.net" + path : null);

const TYPES = {
  item: ["DestinyInventoryItemDefinition", (d) => ({
    name: d.displayProperties?.name || "Unknown item",
    icon: img(d.displayProperties?.icon),
    type: d.itemTypeDisplayName || "",
    tier: d.inventory?.tierType ?? 0 // 6 Exotic, 5 Legendary, 4 Rare, 3 Uncommon, 2 Common
  })],
  stat: ["DestinyStatDefinition", (d) => ({
    name: d.displayProperties?.name || "",
    icon: img(d.displayProperties?.icon),
    description: d.displayProperties?.description || ""
  })],
  record: ["DestinyRecordDefinition", (d) => ({
    name: d.titleInfo?.titlesByGender?.Male || d.titleInfo?.titlesByGender?.Female || d.displayProperties?.name || ""
  })],
  activity: ["DestinyActivityDefinition", (d) => ({
    name: d.displayProperties?.name || "",
    image: img(d.pgcrImage)
  })]
};

// Definitions rarely change, so keep them in memory between requests.
const cache = new Map();

module.exports = handler(async (query) => {
  const type = query.get("type") || "item";
  if (!TYPES[type]) throw new HttpError(400, "Unknown definition type.");
  const [table, trim] = TYPES[type];

  const hashes = [...new Set((query.get("hashes") || "").split(","))]
    .filter((h) => /^\d{1,10}$/.test(h))
    .slice(0, 60);
  if (!hashes.length) throw new HttpError(400, "No hashes given.");

  const out = {};
  await Promise.all(
    hashes.map(async (hash) => {
      const key = `${type}:${hash}`;
      if (!cache.has(key)) {
        const def = await bungie(`/Destiny2/Manifest/${table}/${hash}/`).catch(() => null);
        if (!def) return;
        cache.set(key, trim(def));
      }
      out[hash] = cache.get(key);
    })
  );
  return out;
}, 86400);
