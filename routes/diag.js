// TEMPORARY (test branch only): times item lookups both ways on real data.
const { handler, bungie } = require("../lib/bungie");
const { itemDefs } = require("../lib/manifest");
const { resolve } = require("./items");
module.exports = handler(async () => {
  let t = Date.now();
  const items = await itemDefs();
  const fileMs = Date.now() - t;
  const hashes = Object.entries(items).filter(([, d]) => d.itemType === 3 && d.inventory?.tierType >= 5).slice(1000, 1300).map(([h]) => h);
  t = Date.now();
  const fromFile = await resolve("item", hashes);
  const fileLookupMs = Date.now() - t;
  const sample = hashes.slice(0, 60);
  t = Date.now();
  let i = 0;
  await Promise.all(Array.from({ length: 12 }, async () => { while (i < sample.length) { const h = sample[i++]; await bungie(`/Destiny2/Manifest/DestinyInventoryItemDefinition/${h}/`).catch(() => null); } }));
  const oldMs60 = Date.now() - t;
  return { itemFileReadyMs: fileMs, lookup300ItemsMs: fileLookupMs, resolved: Object.keys(fromFile).length,
           oldWay60ItemsMs: oldMs60, oldWayEstimate300ItemsMs: Math.round(oldMs60 * 5) };
});
