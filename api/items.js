// GET /api/items?hashes=123,456  →  names, icons and rarity for item hashes
const { bungie, handler, HttpError } = require("../lib/bungie");

// Item definitions rarely change, so keep them in memory between requests.
const cache = new Map();

module.exports = handler(async (query) => {
  const hashes = [...new Set((query.get("hashes") || "").split(","))]
    .filter((h) => /^\d{1,10}$/.test(h))
    .slice(0, 60);
  if (!hashes.length) throw new HttpError(400, "No item hashes given.");

  const items = {};
  await Promise.all(
    hashes.map(async (hash) => {
      if (!cache.has(hash)) {
        const def = await bungie(`/Destiny2/Manifest/DestinyInventoryItemDefinition/${hash}/`).catch(() => null);
        if (!def) return;
        cache.set(hash, {
          name: def.displayProperties?.name || "Unknown item",
          icon: def.displayProperties?.icon ? "https://www.bungie.net" + def.displayProperties.icon : null,
          type: def.itemTypeDisplayName || "",
          tier: def.inventory?.tierType ?? 0 // 6 Exotic, 5 Legendary, 4 Rare, 3 Uncommon, 2 Common
        });
      }
      items[hash] = cache.get(hash);
    })
  );
  return items;
}, 86400);
