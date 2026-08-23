const CACHE_NAME = "chordshift-shell-v7";
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

  await cache.addAll([...new Set([...STATIC_SHELL, ...assetPaths])]);
}

self.addEventListener("install", (event) => {
  event.waitUntil(cacheBuiltAppShell());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("chordshift-") && key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function networkFirst(request, cache) {
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    if (request.mode === "navigate") {
      return (await cache.match(request, { ignoreSearch: true })) || (await cache.match("/")) || Response.error();
    }
    return (await cache.match(request)) || Response.error();
  }
}

async function cacheFirst(request, cache) {
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request, cache) {
  const cached = await cache.match(request);
  const refresh = fetch(request)
    .then(async (response) => {
      if (response.ok) await cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  return cached || (await refresh) || Response.error();
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);

    // Vite production assets are content-hashed and immutable until the next build.
    if (url.pathname.startsWith("/assets/")) return cacheFirst(request, cache);

    // App navigation should still prefer a fresh deployment when online.
    if (request.mode === "navigate") return networkFirst(request, cache);

    // Local icons/images/fonts can render instantly while refreshing in the background.
    if (/\.(?:png|jpe?g|webp|svg|ico|woff2?)$/i.test(url.pathname)) {
      return staleWhileRevalidate(request, cache);
    }

    return networkFirst(request, cache);
  })());
});
