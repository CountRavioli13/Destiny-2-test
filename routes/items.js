// GET /api/items?type=item&hashes=123,456
// → names, icons and details for game definitions (items, stats, titles, activities)
const { bungie, handler, HttpError } = require("../lib/bungie");
const { itemDefs } = require("../lib/manifest");

// Item, perk and mod definitions come from Bungie's item file (one download)
// instead of one request per item. Anything missing falls back to a lookup.
const FROM_MANIFEST = new Set(["item", "plugname", "plug"]);

const img = (path) => (path ? "https://www.bungie.net" + path : null);

const TYPES = {
  item: ["DestinyInventoryItemDefinition", (d) => ({
    name: d.displayProperties?.name || "Unknown item",
    icon: img(d.displayProperties?.icon),
    type: d.itemTypeDisplayName || "",
    tier: d.inventory?.tierType ?? 0,           // 6 Exotic, 5 Legendary, 4 Rare, 3 Uncommon, 2 Common
    bucket: d.inventory?.bucketTypeHash ?? 0,   // which slot it goes in
    classType: d.classType ?? 3,                // armor: 0 Titan, 1 Hunter, 2 Warlock, 3 any
    noTransfer: Boolean(d.nonTransferrable),
    // the season badge drawn in the icon's corner
    watermark: img(d.iconWatermark || d.quality?.displayVersionWatermarkIcons?.[0])
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
  })],
  // Activity details used to find raids in someone's history
  activityInfo: ["DestinyActivityDefinition", (d) => ({
    name: d.displayProperties?.name || d.originalDisplayProperties?.name || "",
    image: img(d.pgcrImage),
    typeHash: d.activityTypeHash ?? null,
    mode: d.directActivityModeType ?? null,
    modes: d.activityModeTypes || []
  })],
  // Extra details for the item panel
  detail: ["DestinyInventoryItemDefinition", (d) => ({
    flavor: d.flavorText || "",
    screenshot: img(d.screenshot),
    ammo: d.equippingBlock?.ammoType ?? 0,                // 1 Primary, 2 Special, 3 Heavy
    categories: (d.sockets?.socketCategories || []).map((c) => ({ hash: c.socketCategoryHash, indexes: c.socketIndexes || [] }))
  })],
  // Perks, mods and frames. Many perks keep their text on a separate "sandbox perk".
  plug: ["DestinyInventoryItemDefinition", async (d) => {
    let description = d.displayProperties?.description || "";
    const perkHash = d.perks?.[0]?.perkHash;
    if (!description && perkHash) {
      const perk = await bungie(`/Destiny2/Manifest/DestinySandboxPerkDefinition/${perkHash}/`).catch(() => null);
      description = perk?.displayProperties?.description || "";
    }
    return {
      name: d.displayProperties?.name || "",
      icon: img(d.displayProperties?.icon),
      description,
      type: d.itemTypeDisplayName || ""
    };
  }],
  // Vendors (Xûr, Banshee-44…)
  vendor: ["DestinyVendorDefinition", (d) => ({
    name: d.displayProperties?.name || "",
    subtitle: d.displayProperties?.subtitle || "",
    icon: img(d.displayProperties?.smallTransparentIcon || d.displayProperties?.mapIcon || d.displayProperties?.icon),
    banner: img(d.displayProperties?.largeIcon),
    visible: d.visible !== false
  })],
  // Element icons (Arc, Solar, Void…)
  damage: ["DestinyDamageTypeDefinition", (d) => ({
    name: d.displayProperties?.name || "",
    icon: img(d.displayProperties?.icon)
  })],
  socketCategory: ["DestinySocketCategoryDefinition", (d) => ({ name: d.displayProperties?.name || "" })],
  // Just names and icons, for searching perks across the whole inventory
  plugname: ["DestinyInventoryItemDefinition", (d) => ({
    name: d.displayProperties?.name || "",
    icon: img(d.displayProperties?.icon),
    type: d.itemTypeDisplayName || ""
  })]
};

// Definitions rarely change, so keep them in memory between requests.
const cache = new Map();

// Run tasks a few at a time so Bungie doesn't throttle us.
async function pool(list, size, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(size, list.length) }, async () => {
    while (i < list.length) await fn(list[i++]);
  }));
}

// Look up definitions of one type, using the in-memory cache where possible.
async function resolve(type, hashList) {
  const [table, trim] = TYPES[type];
  const hashes = [...new Set(hashList.map(String))].filter((h) => /^\d{1,10}$/.test(h));
  const out = {};
  const manifest = FROM_MANIFEST.has(type) && hashes.some((h) => !cache.has(`${type}:${h}`)) ? await itemDefs() : null;
  await pool(hashes, 12, async (hash) => {
    const key = `${type}:${hash}`;
    if (!cache.has(key)) {
      const def = manifest?.[hash] || await bungie(`/Destiny2/Manifest/${table}/${hash}/`).catch(() => null);
      if (!def) return;
      cache.set(key, await trim(def));
    }
    out[hash] = cache.get(key);
  });
  return out;
}

module.exports = handler(async (query) => {
  const type = query.get("type") || "item";
  if (!TYPES[type]) throw new HttpError(400, "Unknown definition type.");
  const hashes = (query.get("hashes") || "").split(",").filter(Boolean).slice(0, FROM_MANIFEST.has(type) ? 400 : 100);
  if (!hashes.length) throw new HttpError(400, "No hashes given.");
  return resolve(type, hashes);
}, 86400);

// Used by routes/item.js to send an item's names and descriptions in the same response.
module.exports.resolve = resolve;
