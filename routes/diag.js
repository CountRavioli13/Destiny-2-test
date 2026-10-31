// TEMPORARY (test branch only): returns sample item hashes for timing.
const { handler } = require("../lib/bungie");
const { itemDefs } = require("../lib/manifest");
module.exports = handler(async () => {
  const items = await itemDefs();
  const weapons = Object.entries(items).filter(([, d]) => d.itemType === 3 && d.inventory?.tierType >= 5).slice(0, 300).map(([h]) => h);
  return { hashes: weapons.join(",") };
});
