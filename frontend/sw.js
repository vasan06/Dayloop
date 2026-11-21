// Vite injects the cache name and the complete list of built shell assets.
const { name, assets } = __DAYLOOP_SHELL__;
const shellUrls = new Set(assets.map((asset) => new URL(asset, self.location.origin).href));

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(name);
    await cache.addAll(assets);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("dayloop-shell-") && key !== name)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || /^\/(api|__)(\/|$)/.test(url.pathname)) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(async () => {
      const cache = await caches.open(name);
      return (await cache.match("/index.html")) || Response.error();
    }));
  } else if (shellUrls.has(request.url)) {
    event.respondWith(caches.open(name).then(async (cache) =>
      (await cache.match(request)) || fetch(request)));
  }
});
