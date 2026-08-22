const CACHE_NAME = "chordshift-shell-v6";
const STATIC_SHELL = ["/", "/manifest.webmanifest", "/sw.js"];

async function cacheBuiltAppShell() {
  const cache = await caches.open(CACHE_NAME);
  const rootResponse = await fetch("/", { cache: "no-store" });
  if (!rootResponse.ok) throw new Error(`Unable to cache the app shell (${rootResponse.status})`);

  const html = await rootResponse.clone().text();
  const assetPaths = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map(([, value]) => new URL(value, self.location.origin))
    .filter((url) => url.origin === self.location.origin && url.pathname.startsWith("/assets/"))
    .map((url) => `${url.pathname}${url.search}`);

  await cache.addAll([...STATIC_SHELL, ...assetPaths]);
}

self.addEventListener("install", (event) => {
  event.waitUntil(cacheBuiltAppShell());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const response = await fetch(request);
      if (response.ok) void cache.put(request, response.clone());
      return response;
    } catch {
      if (request.mode === "navigate") {
        return (await cache.match(request, { ignoreSearch: true })) || (await cache.match("/")) || Response.error();
      }
      return (await cache.match(request)) || Response.error();
    }
  })());
});
