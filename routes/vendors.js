// GET /api/vendors?char=2305…  →  what vendors are selling to that character:
// each vendor's items, quantities and costs, and when its stock refreshes.
const { bungie, handler, HttpError } = require("../lib/bungie");
const { requireSession } = require("../lib/session");

module.exports = handler(async (query, { req, res }) => {
  const s = await requireSession(req, res);
  const char = query.get("char") || "";
  if (!/^\d{1,20}$/.test(char)) throw new HttpError(400, "Missing or invalid character id.");

  // 400 vendors, 402 what they sell
  const r = await bungie(`/Destiny2/${s.mt}/Profile/${s.mid}/Character/${char}/Vendors/?components=400,402`, { token: s.at });
  const vendors = r.vendors?.data || {};
  const sales = r.sales?.data || {};

  const out = Object.entries(vendors)
    .filter(([, v]) => v.enabled !== false)
    .map(([hash, v]) => ({
      hash: Number(hash),
      refresh: v.nextRefreshDate || null,
      items: Object.values(sales[hash]?.saleItems || {}).map((it) => ({
        hash: it.itemHash,
        quantity: it.quantity || 1,
        costs: (it.costs || []).map((c) => ({ hash: c.itemHash, quantity: c.quantity }))
      }))
    }))
    .filter((v) => v.items.length);

  return { vendors: out };
});
