const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const assets = [];
function scan(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) scan(full);
    // Keep both source logos in the project/export. The header reuses the
    // existing 192px official icon (also in the manifest), so source artwork
    // need not be downloaded during every PWA installation.
    else if (
      entry.name !== "sw.js" &&
      !["icons/logo.png", "icons/PaddleBai-Logo.png"].includes(
        path.relative("out", full).split(path.sep).join("/"),
      )
    )
      assets.push("/" + path.relative("out", full).split(path.sep).join("/"));
  }
}
scan("out");
const template = fs.readFileSync("scripts/sw-template.js", "utf8");
const hash = crypto.createHash("sha256").update(template);
for (const asset of assets)
  hash.update(fs.readFileSync(path.join("out", asset)));
const worker = template
  .replace("__BUILD__", hash.digest("hex").slice(0, 16))
  .replace("__ASSETS__", JSON.stringify(assets));
fs.writeFileSync("out/sw.js", worker);
fs.writeFileSync("public/sw.js", worker);
console.log(
  "Precached " +
    assets.length +
    " static files, including routes and navigation payloads",
);
