// Bungie's item database ("manifest"), downloaded once per server instance.
// Looking items up here replaces hundreds of one-at-a-time requests to Bungie.
// It's refreshed every few hours, and whenever Bungie publishes a new version.
const { bungie } = require("./bungie");

const REFRESH_MS = 3 * 60 * 60 * 1000;
let state = null; // { at, version, promise }

function load() {
  if (state && Date.now() - state.at < REFRESH_MS) return state.promise;
  const promise = (async () => {
    const m = await bungie("/Destiny2/Manifest/");
    const path = m.jsonWorldComponentContentPaths?.en?.DestinyInventoryItemLiteDefinition;
    if (!path) throw new Error("Bungie's manifest didn't list the item file.");
    const res = await fetch("https://www.bungie.net" + path);
    if (!res.ok) throw new Error(`Item file download failed (HTTP ${res.status}).`);
    const items = await res.json();
    return { version: m.version, items };
  })();
  state = { at: Date.now(), promise };
  promise.catch(() => { state = null; }); // try again next time
  return promise;
}

// Item definitions from the manifest, or null if it isn't available right now.
async function itemDefs() {
  try { return (await load()).items; } catch { return null; }
}

module.exports = { itemDefs, loadManifest: load };
