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

    // Files in public/ (the page, icons, manifest, service worker)
    const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".png": "image/png", ".webmanifest": "application/manifest+json" };
    const publicDir = path.join(__dirname, "public");
    const file = path.join(publicDir, pathname === "/" ? "index.html" : pathname);
    if (file.startsWith(publicDir) && fs.existsSync(file) && fs.statSync(file).isFile()) {
      res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
      return fs.createReadStream(file).pipe(res);
    }
    res.writeHead(404);
    res.end("Not found");
  })
  .listen(PORT, () => console.log(`Lightkeeper running at http://localhost:${PORT}`));
