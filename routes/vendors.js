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

// Sale items, with the exact roll (stats, perks, perk options) where Bungie has one.
// `comps` is the item-components block for this vendor, keyed by sale index.
const saleList = (saleItems, comps) => Object.entries(saleItems || {}).map(([index, it]) => {
  const stats = comps?.stats?.data?.[index]?.stats;
  const sockets = comps?.sockets?.data?.[index]?.sockets;
  const options = comps?.reusablePlugs?.data?.[index]?.plugs;
  return {
    hash: it.itemHash,
    quantity: it.quantity || 1,
    costs: (it.costs || []).map((c) => ({ hash: c.itemHash, quantity: c.quantity })),
    ...(stats ? { stats: Object.fromEntries(Object.entries(stats).filter(([h]) => h !== POWER_STAT).map(([h, v]) => [h, v.value])) } : {}),
    ...(sockets ? { sockets: sockets.map((sk) => ({ plug: sk.plugHash ?? null, enabled: sk.isEnabled !== false, visible: sk.isVisible !== false })) } : {}),
    ...(options ? { options: Object.fromEntries(Object.entries(options).map(([i, list]) => [i, list.map((x) => x.plugItemHash)])) } : {})
  };
});

module.exports = handler(async (query, { req, res }) => {
  const s = await requireSession(req, res);
  const char = query.get("char") || "";
  if (!/^\d{1,20}$/.test(char)) throw new HttpError(400, "Missing or invalid character id.");

  // 400 vendors, 402 what they sell, 304/305/310 the exact rolls (stats, perks, perk options)
  const base = `/Destiny2/${s.mt}/Profile/${s.mid}/Character/${char}/Vendors/`;
  const COMPONENTS = "400,402,304,305,310";
  const [r, lite] = await Promise.all([bungie(`${base}?components=${COMPONENTS}`, { token: s.at }), itemDefs()]);
  const vendors = r.vendors?.data || {};
  const sales = r.sales?.data || {};

  const out = [];
  const pageHashes = new Set();
  for (const [hash, v] of Object.entries(vendors)) {
    if (v.enabled === false) continue;
    const items = [];
    const pages = [];
    for (const it of saleList(sales[hash]?.saleItems, r.itemComponents?.[hash])) {
      const link = await linkedVendor(it.hash, lite);
      if (link && String(link) !== hash) pages.push(String(link));
      else items.push(it);
    }
    out.push({ hash: Number(hash), refresh: v.nextRefreshDate || null, items, pages });
    pages.forEach((p) => pageHashes.add(p));
  }

  // Load each linked page (from this response if Bungie included it, otherwise on its own)
  const pageData = {};
  await Promise.all([...pageHashes].map(async (p) => {
    if (sales[p]) { pageData[p] = { items: saleList(sales[p].saleItems, r.itemComponents?.[p]), refresh: vendors[p]?.nextRefreshDate || null }; return; }
    const one = await bungie(`${base}${p}/?components=${COMPONENTS}`, { token: s.at }).catch(() => null);
    if (one) pageData[p] = { items: saleList(one.sales?.data, one.itemComponents), refresh: one.vendor?.data?.nextRefreshDate || null };
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
