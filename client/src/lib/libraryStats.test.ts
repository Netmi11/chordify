import { describe, expect, it } from "vitest";
import { getLibraryStats } from "./libraryStats";
import type { SavedSong } from "./songLibraryV2";

const base: SavedSong = {
  id: "1",
  title: "Song",
  artist: "Artist",
  sourceUrl: "https://www.tab4u.com/tabs/songs/1",
  lines: [{ chord: "C", lyric: "hello" }],
  addedAt: 1,
  note: "",
};

describe("getLibraryStats", () => {
  it("counts unique artists, notes and tab songs", () => {
    expect(getLibraryStats([
      base,
      { ...base, id: "2", sourceUrl: "https://www.tab4u.com/tabs/songs/2", note: "practice", lines: [{ chord: "", lyric: "e|--0--" }] },
      { ...base, id: "3", sourceUrl: "https://www.tab4u.com/tabs/songs/3", artist: "Other", lines: [{ chord: "", lyric: "", tab: "E|--3--" }] },
    ])).toEqual({ songs: 3, artists: 2, withNotes: 1, withTabs: 2 });
  });
});
