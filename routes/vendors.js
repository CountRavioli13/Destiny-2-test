// GET /api/vendors?char=2305…  →  what vendors are selling to that character:
// each vendor's items, quantities and costs, and when its stock refreshes.
// Some vendors have extra pages (Xûr's "Strange Gear Offers" and "More Strange
// Offers"); those are separate vendors linked from the main list, so they're
// followed and returned as `pages` of the vendor that links to them.
const { bungie, handler, HttpError } = require("../lib/bungie");
const { requireSession } = require("../lib/session");
const { itemDefs } = require("../lib/manifest");

const pageLinkCache = new Map(); // item hash → linked vendor hash (or 0)

async function linkedVendor(itemHash, lite) {
  if (pageLinkCache.has(itemHash)) return pageLinkCache.get(itemHash);
  const l = lite?.[itemHash];
  let link = 0;
  if (!l || !l.itemTypeDisplayName) { // page links have no item type
    const full = await bungie(`/Destiny2/Manifest/DestinyInventoryItemDefinition/${itemHash}/`).catch(() => null);
    link = full?.preview?.previewVendorHash || 0;
  }
  pageLinkCache.set(itemHash, link);
  return link;
}

const POWER_STAT = "1935470627";

// What Bungie included, to help diagnose items that come back without a roll.
const compInfo = (comps) => {
  const n = (k) => Object.keys(comps?.[k]?.data || {}).length;
  return `stats ${n("stats")}, sockets ${n("sockets")}, options ${n("reusablePlugs")}`;
};

// What's for sale (no rolls). `index` is Bungie's sale index, used to attach rolls later.
const saleList = (saleItems) => Object.entries(saleItems || {}).map(([index, it]) => ({
  index: Number(index),
  hash: it.itemHash,
  quantity: it.quantity || 1,
  costs: (it.costs || []).map((c) => ({ hash: c.itemHash, quantity: c.quantity }))
}));

// The exact roll (stats, perks, perk options) of each item, keyed by sale index.
const rollMap = (saleItems, comps) => Object.fromEntries(Object.keys(saleItems || {}).map((index) => {
  const stats = comps?.stats?.data?.[index]?.stats;
  const sockets = comps?.sockets?.data?.[index]?.sockets;
  const options = comps?.reusablePlugs?.data?.[index]?.plugs;
  return [index, {
    ...(stats ? { stats: Object.fromEntries(Object.entries(stats).filter(([h]) => h !== POWER_STAT).map(([h, v]) => [h, v.value])) } : {}),
    ...(sockets ? { sockets: sockets.map((sk) => ({ plug: sk.plugHash ?? null, enabled: sk.isEnabled !== false, visible: sk.isVisible !== false })) } : {}),
    ...(options ? { options: Object.fromEntries(Object.entries(options).map(([i, list]) => [i, list.map((x) => x.plugItemHash)])) } : {}),
    ...(!stats && !sockets ? { why: `index ${index}; ${compInfo(comps)}` } : {})
  }];
}));

// Two steps, so the page can show what's for sale right away:
//   GET /api/vendors?char=…                      → every vendor's items and costs (fast)
//   GET /api/vendors?char=…&rolls=hash,hash,…    → exact rolls for those vendors, fetched in parallel
module.exports = handler(async (query, { req, res }) => {
  const s = await requireSession(req, res);
  const char = query.get("char") || "";
  if (!/^\d{1,20}$/.test(char)) throw new HttpError(400, "Missing or invalid character id.");
  const base = `/Destiny2/${s.mt}/Profile/${s.mid}/Character/${char}/Vendors/`;

  if (query.has("rolls")) {
    const hashes = [...new Set((query.get("rolls") || "").split(",").filter((h) => /^\d{1,12}$/.test(h)))].slice(0, 40);
    const rolls = {};
    await Promise.all(hashes.map(async (h) => {
      const one = await bungie(`${base}${h}/?components=402,304,305,310`, { token: s.at }).catch(() => null);
      if (one?.sales?.data) rolls[h] = rollMap(one.sales.data, one.itemComponents);
    }));
    return { rolls };
  }

  // 400 vendors, 402 what they sell. No item components here: they make this call much slower.
  const [r, lite] = await Promise.all([bungie(`${base}?components=400,402`, { token: s.at }), itemDefs()]);
  const vendors = r.vendors?.data || {};
  const sales = r.sales?.data || {};

  const out = await Promise.all(Object.entries(vendors).filter(([, v]) => v.enabled !== false).map(async ([hash, v]) => {
    const all = saleList(sales[hash]?.saleItems);
    const links = await Promise.all(all.map((it) => linkedVendor(it.hash, lite)));
    const items = [], pages = [];
    all.forEach((it, i) => { const link = links[i]; if (link && String(link) !== hash) pages.push(String(link)); else items.push(it); });
    return { hash: Number(hash), refresh: v.nextRefreshDate || null, items, pages };
  }));
  const pageHashes = new Set(out.flatMap((v) => v.pages));

  // Linked pages (Xûr's extra offers) may not be in the main list, so load any that are missing.
  const pageData = {};
  await Promise.all([...pageHashes].map(async (p) => {
    if (sales[p]) { pageData[p] = { items: saleList(sales[p].saleItems), refresh: vendors[p]?.nextRefreshDate || null }; return; }
    const one = await bungie(`${base}${p}/?components=400,402`, { token: s.at }).catch(() => null);
    if (one?.sales?.data) pageData[p] = { items: saleList(one.sales.data), refresh: one.vendor?.data?.nextRefreshDate || null };
  }));

  const result = out
    .filter((v) => !pageHashes.has(String(v.hash))) // pages are shown inside their parent
    .map((v) => ({
      ...v,
      pages: v.pages.filter((p) => pageData[p]?.items.length).map((p) => ({ hash: Number(p), ...pageData[p] }))
    }))
    .filter((v) => v.items.length || v.pages.length);

  return { vendors: result };
});
