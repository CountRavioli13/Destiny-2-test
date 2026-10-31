// TEMPORARY (test branch only): follow Xûr's page links to their sub-vendors.
const { handler, bungie } = require("../lib/bungie");
const { itemDefs } = require("../lib/manifest");
module.exports = handler(async () => {
  const r = await bungie("/Destiny2/Vendors/?components=400,402");
  const lite = await itemDefs();
  const out = [];
  for (const it of Object.values(r.sales?.data?.["2190858386"]?.saleItems || {})) {
    const l = lite?.[it.itemHash];
    if (l?.itemTypeDisplayName) continue;
    const full = await bungie(`/Destiny2/Manifest/DestinyInventoryItemDefinition/${it.itemHash}/`).catch(() => null);
    const pv = full?.preview?.previewVendorHash;
    const vd = pv ? await bungie(`/Destiny2/Manifest/DestinyVendorDefinition/${pv}/`).catch(() => null) : null;
    out.push({ item: it.itemHash, name: full?.displayProperties?.name, liteHasPreview: Boolean(l?.preview), previewVendorHash: pv || null,
      vendorName: vd?.displayProperties?.name, vendorVisible: vd?.visible, vendorItemCount: vd?.itemList?.length });
  }
  return out;
});
