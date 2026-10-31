// POST /api/wishlist  { hashes: [weapon item hashes] }
// → community-recommended ("god") rolls for those weapons.
//
// The source is the community-maintained "voltron" wish list used by DIM
// (https://github.com/48klocs/dim-wish-list-sources). It's ~28 MB, so the
// server downloads and indexes it once, then answers only for the weapons
// the player owns. Set WISHLIST_URL in Vercel to use a different list.
const { handler, readBody, HttpError } = require("../lib/bungie");

const SOURCE = process.env.WISHLIST_URL ||
  "https://raw.githubusercontent.com/48klocs/dim-wish-list-sources/master/voltron.txt";
const MAX_ROLLS_PER_ITEM = 80;
const REFRESH_MS = 12 * 60 * 60 * 1000;

let cache = null; // { at, promise }

function load() {
  if (cache && Date.now() - cache.at < REFRESH_MS) return cache.promise;
  const promise = (async () => {
    const res = await fetch(SOURCE);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();

    const rolls = new Map(); // item hash → [[perk hashes "a,b,c", note index]]
    const notes = [];
    let note = -1;
    for (const line of text.split("\n")) {
      if (line.startsWith("//notes:")) { notes.push(line.slice(8).trim()); note = notes.length - 1; continue; }
      if (!line.startsWith("dimwishlist:")) { if (!line.trim()) note = -1; continue; }
      const m = line.match(/item=(-?\d+)&perks=([\d,]+)(?:#notes:(.*))?/);
      if (!m || m[1].startsWith("-")) continue; // skip "any item" trash-list entries
      let n = note;
      if (m[3]) { notes.push(m[3].trim()); n = notes.length - 1; }
      let list = rolls.get(m[1]);
      if (!list) rolls.set(m[1], (list = []));
      list.push([m[2], n]);
    }
    return { rolls, notes };
  })();
  cache = { at: Date.now(), promise };
  promise.catch(() => { cache = null; });
  return promise;
}

module.exports = handler(async (query, { req }) => {
  const body = await readBody(req);
  const hashes = [...new Set((Array.isArray(body.hashes) ? body.hashes : []).map(String))]
    .filter((h) => /^\d{1,10}$/.test(h))
    .slice(0, 2000);
  if (!hashes.length) throw new HttpError(400, "No item hashes given.");

  let data;
  try {
    data = await load();
  } catch (err) {
    throw new HttpError(502, `Couldn't download the community wish list (${err.message}).`);
  }

  const rolls = {};
  const usedNotes = {};
  for (const h of hashes) {
    const list = data.rolls.get(h);
    if (!list) continue;
    rolls[h] = list.slice(0, MAX_ROLLS_PER_ITEM).map(([perks, n]) => {
      if (n >= 0) usedNotes[n] = data.notes[n].slice(0, 400);
      return [perks.split(",").map(Number), n];
    });
  }
  return { rolls, notes: usedNotes };
}, 0, ["POST"]);
