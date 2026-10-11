const fs = require("node:fs");
const path = require("node:path");
const assets = [];
function scan(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) scan(full);
    else if (/\.(js|css|woff2?)$/.test(entry.name))
      assets.push("/" + full.replaceAll("\\", "/").replace(".next/", "_next/"));
  }
}
scan(".next/static");
const build = fs.readFileSync(".next/BUILD_ID", "utf8").trim();
let worker = fs.readFileSync("scripts/sw-template.js", "utf8");
worker = worker.replace(
  /const CACHE\s*=\s*["']paddle-v\d+["']/,
  "const CACHE = " + JSON.stringify("paddle-" + build),
);
worker = worker.replace(
  "cache.addAll(PAGES)",
  "cache.addAll([...PAGES,..." + JSON.stringify(assets) + "])",
);
if (!worker.includes(build) || !worker.includes(assets[0]))
  throw Error("Service worker build substitution failed");
fs.writeFileSync("public/sw.js", worker);
console.log("Precached " + assets.length + " production assets");
