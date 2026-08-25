import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildUpstreamTrpcUrl, isLibrarySyncPath } from "../api/trpc";

describe("Vercel library sync fallback", () => {
  it("only proxies library sync procedures", () => {
    expect(isLibrarySyncPath("librarySync.catalog")).toBe(true);
    expect(isLibrarySyncPath("librarySync.pull,librarySync.catalog")).toBe(true);
    expect(isLibrarySyncPath("librarySync.sync")).toBe(true);
    expect(isLibrarySyncPath("librarySync.push")).toBe(false);
    expect(isLibrarySyncPath("tab4u.fetchSong")).toBe(false);
    expect(isLibrarySyncPath("librarySync.catalog,tab4u.fetchSong")).toBe(false);
    expect(isLibrarySyncPath("librarySync.catalog/../../auth.me")).toBe(false);
    expect(isLibrarySyncPath("")).toBe(false);
  });

  it("rebuilds the upstream tRPC URL without leaking the Vercel routing parameter", () => {
    const requestUrl = new URL("https://chordify.example/api/trpc?trpcPath=librarySync.catalog&batch=1&input=%7B%7D");
    expect(buildUpstreamTrpcUrl(requestUrl, "librarySync.catalog", "https://legacy.example").toString())
      .toBe("https://legacy.example/api/trpc/librarySync.catalog?batch=1&input=%7B%7D");
  });

  it("keeps the serverless entrypoint free of runtime imports outside api", () => {
    const entrypoint = readFileSync(new URL("../api/trpc.ts", import.meta.url), "utf8");
    const runtimeImports = [...entrypoint.matchAll(/^import(?!\s+type\b)[\s\S]*?from\s+["']([^"']+)["'];?$/gm)]
      .map((match) => match[1]);

    expect(runtimeImports.filter((specifier) => specifier.startsWith(".."))).toEqual([]);
  });
});
