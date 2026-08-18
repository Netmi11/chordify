import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const serviceWorker = readFileSync(resolve(process.cwd(), "client/public/sw.js"), "utf8");
const mainSource = readFileSync(resolve(process.cwd(), "client/src/main.tsx"), "utf8");

describe("PWA offline app shell", () => {
  it("pre-caches the built Vite asset graph together with the navigation shell", () => {
    expect(serviceWorker).toContain('const CACHE_NAME = "chordshift-shell-v5"');
    expect(serviceWorker).toContain('fetch("/", { cache: "no-store" })');
    expect(serviceWorker).toContain('new URL(value, self.location.origin)');
    expect(serviceWorker).toContain('pathname.startsWith("/assets/")');
    expect(serviceWorker).toContain('cache.addAll([...STATIC_SHELL, ...assetPaths])');
  });

  it("falls back to the cached app shell when navigation has no network", () => {
    expect(serviceWorker).toContain('request.mode === "navigate"');
    expect(serviceWorker).toContain('await cache.match(request, { ignoreSearch: true })');
    expect(serviceWorker).toContain('await cache.match("/")');
  });

  it("registers the service worker without an HTTP cache delay", () => {
    expect(mainSource).toContain('register("/sw.js", { updateViaCache: "none" })');
  });
});
