// Run the site on your own computer before deploying (Node.js 18+).
//
//   Mac/Linux:   BUNGIE_API_KEY=your_key node dev-server.js
//   Windows:     $env:BUNGIE_API_KEY="your_key"; node dev-server.js   (PowerShell)
//
// Then open http://localhost:3000

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
if (!process.env.BUNGIE_API_KEY) {
  console.warn("Warning: BUNGIE_API_KEY isn't set, so searches will fail.");
}

const routes = {
  search: require("./api/search"),
  profile: require("./api/profile"),
  stats: require("./api/stats"),
  items: require("./api/items")
};

http
  .createServer((req, res) => {
    const { pathname } = new URL(req.url, "http://localhost");
    const match = pathname.match(/^\/api\/(\w+)$/);
    if (match && routes[match[1]]) return routes[match[1]](req, res);

    if (pathname === "/" || pathname === "/index.html") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return fs.createReadStream(path.join(__dirname, "public", "index.html")).pipe(res);
    }
    res.writeHead(404);
    res.end("Not found");
  })
  .listen(PORT, () => console.log(`Guardian Lookup running at http://localhost:${PORT}`));
