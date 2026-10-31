// The site's single server function. Vercel's Hobby plan allows at most 12
// functions per deployment, so every /api/... request is sent here (see
// vercel.json) and handed to the matching file in /routes.
const routes = {
  "search": require("../routes/search"),
  "profile": require("../routes/profile"),
  "stats": require("../routes/stats"),
  "activities": require("../routes/activities"),
  "items": require("../routes/items"),
  "me": require("../routes/me"),
  "inventory": require("../routes/inventory"),
  "item": require("../routes/item"),
  "transfer": require("../routes/transfer"),
  "wishlist": require("../routes/wishlist"),
  "store": require("../routes/store"),
  "vendors": require("../routes/vendors"),
  "raids": require("../routes/raids"),
  "auth/login": require("../routes/auth/login"),
  "auth/callback": require("../routes/auth/callback"),
  "auth/logout": require("../routes/auth/logout")
};

module.exports = (req, res) => {
  const url = new URL(req.url, "http://localhost");
  // On Vercel the route arrives as ?route=…; locally it's in the path.
  const route = (url.searchParams.get("route") || url.pathname.replace(/^\/api\/?/, ""))
    .replace(/^\/+|\/+$/g, "");
  const fn = Object.prototype.hasOwnProperty.call(routes, route) ? routes[route] : null;
  if (!fn) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ error: "Not found." }));
  }
  return fn(req, res);
};
