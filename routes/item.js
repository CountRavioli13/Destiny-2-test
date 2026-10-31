// GET /api/item?id=6917…  →  one of the signed-in player's items in detail:
// stats, the perk/mod sockets, and every perk option each column rolled with.
const { bungie, handler, HttpError } = require("../lib/bungie");
const { requireSession } = require("../lib/session");

module.exports = handler(async (query, { req, res }) => {
  const s = await requireSession(req, res);
  const id = query.get("id") || "";
  if (!/^\d{1,20}$/.test(id)) throw new HttpError(400, "Missing or invalid item id.");

  // 300 instance, 304 stats, 305 sockets, 310 reusable plugs (perk options)
  const r = await bungie(`/Destiny2/${s.mt}/Profile/${s.mid}/Item/${id}/?components=300,304,305,310`, { token: s.at });

  const stats = Object.fromEntries(
    Object.entries(r.stats?.data?.stats || {}).map(([hash, v]) => [hash, v.value])
  );
  const sockets = (r.sockets?.data?.sockets || []).map((sk) => ({
    plug: sk.plugHash ?? null,
    enabled: sk.isEnabled !== false,
    visible: sk.isVisible !== false
  }));
  const options = Object.fromEntries(
    Object.entries(r.reusablePlugs?.data?.plugs || {}).map(([index, list]) => [index, list.map((p) => p.plugItemHash)])
  );

  return { stats, sockets, options, power: r.instance?.data?.primaryStat?.value ?? null };
});
