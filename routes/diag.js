// TEMPORARY (test branch only): what Bungie lists for Xûr-related vendors.
const { handler, bungie } = require("../lib/bungie");
const { resolve } = require("./items");
module.exports = handler(async () => {
  const r = await bungie("/Destiny2/Vendors/?components=400,402");
  const hashes = Object.keys(r.vendors?.data || {});
  const raw = {};
  await Promise.all(hashes.map(async (h) => {
    const d = await bungie(`/Destiny2/Manifest/DestinyVendorDefinition/${h}/`).catch(() => null);
    if (d) raw[h] = d;
  }));
  const out = hashes.map((h) => {
    const d = raw[h] || {};
    const sales = Object.values(r.sales?.data?.[h]?.saleItems || {});
    return { hash: h, name: d.displayProperties?.name, sub: d.displayProperties?.subtitle, visible: d.visible, enabled: r.vendors.data[h].enabled,
      groups: (d.groups || []).map((g) => g.vendorGroupHash), parents: d.parentVendorHashes || null, items: sales.length,
      cats: (d.displayCategories || []).map((c) => c.displayProperties?.name).filter(Boolean).slice(0, 8) };
  }).filter((v) => /x[uû]r|strange|nine|treasure|hoard/i.test(`${v.name} ${v.sub}`));
  const itemHashes = [];
  for (const v of out) for (const it of Object.values(r.sales?.data?.[v.hash]?.saleItems || {})) itemHashes.push(String(it.itemHash));
  const defs = await resolve("item", itemHashes);
  for (const v of out) v.sample = Object.values(r.sales?.data?.[v.hash]?.saleItems || {}).slice(0, 40).map((it) => `${defs[it.itemHash]?.name} [${defs[it.itemHash]?.type}]`);
  return { totalPublicVendors: hashes.length, xur: out };
});
