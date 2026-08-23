import { describe, expect, it } from "vitest";
import { buildUpstreamTrpcUrl, isLibrarySyncPath } from "../api/trpc";

describe("Vercel library sync fallback", () => {
  it("only proxies library sync procedures", () => {
    expect(isLibrarySyncPath("librarySync.catalog")).toBe(true);
    expect(isLibrarySyncPath("librarySync.pull,librarySync.catalog")).toBe(true);
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
});
