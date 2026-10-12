const https = require("node:https");
const fs = require("node:fs");
const handler = require("./static-handler.cjs");
const cert = process.argv[2] || "certs/local.pem";
const key = process.argv[3] || "certs/local-key.pem";
const port = Number(process.argv[4] || 3443);
if (!fs.existsSync("out/index.html"))
  throw Error("Run npm run build before HTTPS testing.");
if (!fs.existsSync(cert) || !fs.existsSync(key))
  throw Error(
    "Missing certificate. Run npm run phone:setup for trusted HTTPS setup instructions.",
  );
https
  .createServer(
    { cert: fs.readFileSync(cert), key: fs.readFileSync(key) },
    handler,
  )
  .listen(port, "0.0.0.0", () =>
    console.log(
      "HTTPS static app: https://localhost:" +
        port +
        " (use your certificate's Wi-Fi IP on phones)",
    ),
  );
