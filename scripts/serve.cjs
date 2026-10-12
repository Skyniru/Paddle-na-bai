const http = require("node:http");
const handler = require("./static-handler.cjs");
const port = Number(process.env.PORT || process.argv[2] || 3000);
http
  .createServer(handler)
  .listen(port, "0.0.0.0", () =>
    console.log("Static app: http://localhost:" + port),
  );
