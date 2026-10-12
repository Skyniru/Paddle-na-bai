const os = require("node:os");
const addresses = Object.values(os.networkInterfaces())
  .flat()
  .filter((a) => a && a.family === "IPv4" && !a.internal)
  .map((a) => a.address);
const selected = process.argv[2] || addresses[0];
if (!selected || !/^\d{1,3}(\.\d{1,3}){3}$/.test(selected))
  throw Error(
    "Pass your Wi-Fi IPv4 address: npm run phone:setup -- 192.168.1.21",
  );
console.log("Available local IPv4 addresses: " + addresses.join(", "));
console.log(
  "Use the Wi-Fi/Ethernet address reachable from your phone. Selected: " +
    selected,
);
console.log(`
In PowerShell, after installing mkcert:
  New-Item -ItemType Directory -Path certs -Force
  mkcert -install
  mkcert -cert-file certs/local.pem -key-file certs/local-key.pem localhost 127.0.0.1 ${selected}
  mkcert -CAROOT
  npm.cmd run build
  npm.cmd run https

On iPhone: install ONLY rootCA.pem from the CA directory as a profile and enable
full certificate trust in Settings > General > About > Certificate Trust Settings.
Never copy rootCA-key.pem. Android: install rootCA.pem as a trusted CA certificate
using device security settings; menu names vary.

Open https://${selected}:3443 on the same Wi-Fi with no certificate warning.
Wait for Ready for offline play, then Safari > Share > Add to Home Screen (iPhone)
or Chrome > Install app / Add to Home screen (Android).
Reopen once, start a session, turn Wi-Fi and cellular off, fully close and reopen,
and confirm the active match, timer, attendance and photos survive.
Keep the same URL/origin and export a backup before changing it.
`);
