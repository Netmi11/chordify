import { describe, expect, it } from "vitest";
import { normalizeLibrarySearch, songMatchesQuery } from "./librarySearch";

describe("librarySearch", () => {
  it("normalizes spacing, case, Hebrew marks, and dash variants", () => {
    expect(normalizeLibrarySearch("  שָׁלוֹם   WORLD—LIVE ")).toBe("שלום world-live");
  });

  it("matches query words in any order across title and artist", () => {
    const song = { title: "מחכה", artist: "עידן רייכל" };
    expect(songMatchesQuery(song, "רייכל מחכה")).toBe(true);
    expect(songMatchesQuery(song, "עידן משהו")).toBe(false);
  });

  it("treats an empty query as a match", () => {
    expect(songMatchesQuery({ title: "A", artist: "B" }, "   ")).toBe(true);
  });
});
