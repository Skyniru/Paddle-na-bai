const QR = require("qrcode");
const url = process.argv[2];
if (!url || !/^https?:\/\//.test(url)) {
  console.error("Usage: npm run qr -- http://192.168.1.10:3000");
  process.exit(1);
}
QR.toFile("local-qr.png", url, { width: 500, margin: 3 }).then(() =>
  console.log("Saved local-qr.png for " + url),
);
