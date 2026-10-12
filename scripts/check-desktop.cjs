const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const Ajv = require("ajv");
const config = JSON.parse(fs.readFileSync("src-tauri/tauri.conf.json", "utf8"));
const schema = require("@tauri-apps/cli/config.schema.json");
const validate = new Ajv({
  allErrors: true,
  strict: false,
  validateFormats: false,
  unicodeRegExp: false,
}).compile(schema);
if (!validate(config)) {
  console.error(validate.errors);
  process.exit(1);
}
for (const icon of config.bundle.icon) {
  if (!fs.existsSync(path.join("src-tauri", icon)))
    throw Error("Missing desktop icon: " + icon);
}
if (!fs.existsSync("out/index.html"))
  throw Error("Run npm run build first to generate out/");
if (config.bundle.windows.webviewInstallMode.type !== "offlineInstaller")
  throw Error("Desktop packaging must include offline WebView2 installation");
console.log(
  "Tauri 2 schema, bundled frontend, Windows icons and offline installer configuration: valid.",
);
console.log(
  "Installer output directory: " +
    path.resolve("src-tauri/target/release/bundle/nsis"),
);
if (!process.argv.includes("--config-only")) {
  for (const command of ["rustc", "cargo"]) {
    const result = spawnSync(command, ["--version"], {
      encoding: "utf8",
      windowsHide: true,
    });
    if (result.error || result.status !== 0) {
      console.error(
        command +
          " missing. Install Rust stable MSVC using rustup, then reopen your terminal.",
      );
      process.exitCode = 1;
    } else console.log(result.stdout.trim());
  }
  console.log(
    "Also run npm run tauri -- info to check MSVC, Windows SDK and WebView2.",
  );
}
