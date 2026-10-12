const CACHE = "paddle-__BUILD__";
const ASSETS = __ASSETS__;
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
});
// No skipWaiting: a new build activates only after every old app window closes.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("paddle-") && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("message", (event) => {
  if (event.data === "STATUS")
    event.waitUntil(
      caches.open(CACHE).then(async (cache) => {
        const ready = (await cache.keys()).length >= ASSETS.length;
        event.ports[0]?.postMessage({ ready, build: CACHE });
      }),
    );
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin)
    return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      let key = url.pathname;
      if (event.request.mode === "navigate")
        key = key.endsWith(".html")
          ? key
          : key.replace(/\/$/, "") + "/index.html";
      const cached = await cache.match(key);
      if (cached) return cached;
      return fetch(event.request);
    })(),
  );
});
