const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve("out");
const types = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".txt": "text/plain",
};
module.exports = (req, res) => {
  let target;
  try {
    target = path.resolve(
      root,
      "." + decodeURIComponent(new URL(req.url, "http://localhost").pathname),
    );
  } catch {
    res.writeHead(400);
    return res.end();
  }
  if (target !== root && !target.startsWith(root + path.sep)) {
    res.writeHead(403);
    return res.end();
  }
  if (fs.existsSync(target) && fs.statSync(target).isDirectory())
    target = path.join(target, "index.html");
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    res.writeHead(404);
    return res.end("Not found");
  }
  res.writeHead(200, {
    "Content-Type": types[path.extname(target)] || "application/octet-stream",
    "Cache-Control": "no-cache",
    ...(target.endsWith("sw.js") ? { "Service-Worker-Allowed": "/" } : {}),
  });
  fs.createReadStream(target).pipe(res);
};
