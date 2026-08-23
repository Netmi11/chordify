import { describe, expect, it } from "vitest";
import { mergeLibraryForSync } from "./syncPolicy";
import type { SavedSong } from "./songLibraryV2";

const makeSong = (overrides: Partial<SavedSong> = {}): SavedSong => ({
  id: "local-1",
  title: "Old title",
  artist: "Artist",
  sourceUrl: "https://www.tab4u.com/tabs/songs/1",
  lines: [{ chord: "C", lyric: "old" }],
  addedAt: 100,
  note: "my note",
  ...overrides,
});

describe("mergeLibraryForSync", () => {
  it("refreshes cloud content while preserving local identity and notes", () => {
    const local = makeSong();
    const cloud = makeSong({
      id: "cloud-99",
      title: "New title",
      lines: [{ chord: "D", lyric: "new" }],
      addedAt: 999,
      note: "",
    });

    const result = mergeLibraryForSync([local], [cloud]);
    expect(result.updated).toBe(1);
    expect(result.added).toBe(0);
    expect(result.songs[0]).toMatchObject({
      id: "local-1",
      title: "New title",
      addedAt: 100,
      note: "my note",
    });
  });

  it("adds new cloud songs and keeps local-only songs", () => {
    const localOnly = makeSong({ sourceUrl: "https://www.tab4u.com/tabs/songs/1" });
    const cloudOnly = makeSong({ id: "2", sourceUrl: "https://www.tab4u.com/tabs/songs/2", addedAt: 200 });

    const result = mergeLibraryForSync([localOnly], [cloudOnly]);
    expect(result.added).toBe(1);
    expect(result.preservedLocal).toBe(1);
    expect(result.songs.map((song) => song.sourceUrl)).toEqual([
      "https://www.tab4u.com/tabs/songs/2",
      "https://www.tab4u.com/tabs/songs/1",
    ]);
  });
});
