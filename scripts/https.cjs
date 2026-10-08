const https = require("node:https");
const http = require("node:http");
const fs = require("node:fs");
const cert = process.argv[2] || "certs/local.pem";
const key = process.argv[3] || "certs/local-key.pem";
https
  .createServer(
    { cert: fs.readFileSync(cert), key: fs.readFileSync(key) },
    (req, res) => {
      const proxy = http.request(
        {
          hostname: "127.0.0.1",
          port: 3000,
          path: req.url,
          method: req.method,
          headers: { ...req.headers, "x-forwarded-proto": "https" },
        },
        (upstream) => {
          res.writeHead(upstream.statusCode, upstream.headers);
          upstream.pipe(res);
        },
      );
      proxy.on("error", () => {
        res.writeHead(502);
        res.end("Start npm run start on port 3000 first.");
      });
      req.pipe(proxy);
    },
  )
  .listen(3443, "0.0.0.0", () =>
    console.log("HTTPS test proxy listening on port 3443"),
  );
