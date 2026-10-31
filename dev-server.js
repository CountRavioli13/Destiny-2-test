// Run the site on your own computer before deploying (Node.js 18+).
//
//   Mac/Linux:   BUNGIE_API_KEY=your_key node dev-server.js
//   Windows:     $env:BUNGIE_API_KEY="your_key"; node dev-server.js   (PowerShell)
//
// Then open http://localhost:3000
// Note: Bungie sign-in (the Vault) only works on your deployed https site,
// because Bungie sends players back to the Redirect URL you registered.

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
process.env.GL_DEV_HTTP = "1"; // local testing runs on http, not https
if (!process.env.BUNGIE_API_KEY) {
  console.warn("Warning: BUNGIE_API_KEY isn't set, so requests to Bungie will fail.");
}

const api = require("./api/index.js"); // same single entry point Vercel uses

http
  .createServer((req, res) => {
    const { pathname } = new URL(req.url, "http://localhost");
    if (pathname.startsWith("/api/")) return api(req, res);

    if (pathname === "/" || pathname === "/index.html") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return fs.createReadStream(path.join(__dirname, "public", "index.html")).pipe(res);
    }
    res.writeHead(404);
    res.end("Not found");
  })
  .listen(PORT, () => console.log(`Guardian Lookup running at http://localhost:${PORT}`));
