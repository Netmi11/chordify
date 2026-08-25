import { describe, expect, it } from "vitest";
import {
  mergeCloudSongs,
  normalizeSongMetadata,
  parseSongBatchImport,
  parseSongImport,
  serializeSongLibrary,
  sortSongsForLibrary,
  updateSongCategories,
  type SavedSong,
} from "./songLibraryV2";

const song = (id: string, title: string, artist: string, sourceUrl = `https://www.tab4u.com/tabs/songs/${id}`): SavedSong => ({
  id,
  title,
  artist,
  sourceUrl,
  lines: [{ chord: "C G Am F", lyric: "test" }],
  addedAt: Number(id),
  note: "",
});

describe("song library", () => {
  it("normalizes Tab4U metadata", () => {
    expect(normalizeSongMetadata("אקורדים לשיר שלום של אביב גפן", "אביב גפן")).toEqual({
      title: "שלום",
      artist: "אביב גפן",
    });
  });

  it("sorts deterministically by artist and title", () => {
    const songs = [song("1", "זברה", "ביאליק"), song("2", "אביב", "אבי")];
    expect(sortSongsForLibrary(songs, "artist").map((s) => s.id)).toEqual(["2", "1"]);
    expect(sortSongsForLibrary(songs, "title").map((s) => s.id)).toEqual(["2", "1"]);
  });

  it("merges cloud songs without duplicating source URLs", () => {
    const local = song("1", "Song", "Artist", "https://www.tab4u.com/tabs/songs/1");
    const duplicate = song("2", "Updated", "Artist", local.sourceUrl);
    const remote = song("3", "Remote", "Other", "https://www.tab4u.com/tabs/songs/3");
    expect(mergeCloudSongs([local], [duplicate, remote]).map((s) => s.id)).toEqual(["3", "1"]);
  });

  it("accepts both raw and wrapped library backups", () => {
    const songs = [song("1", "Song", "Artist")];
    const backup = serializeSongLibrary(songs);
    expect(backup).toContain('"version": 1');
  });

  it("rejects imports from non-Tab4U hosts", () => {
    const raw = JSON.stringify({
      type: "chordshift-import-v1",
      song: { title: "x", artist: "y", sourceUrl: "https://example.com/tabs/songs/1", lines: [] },
    });
    expect(parseSongImport(raw)).toBeNull();
  });

  it("validates batch imports and rejects duplicates", () => {
    const raw = JSON.stringify({
      type: "chordshift-import-batch-v1",
      songs: [
        { title: "A", artist: "B", sourceUrl: "https://www.tab4u.com/tabs/songs/1", lines: [] },
        { title: "C", artist: "D", sourceUrl: "https://www.tab4u.com/tabs/songs/1", lines: [] },
      ],
    });
    expect(parseSongBatchImport(raw)).toBeNull();
  });

  it("persists an exact non-empty manual category selection", () => {
    let raw = JSON.stringify([{ ...song("1", "גג", "ג׳ירפות"), categories: ["רוק ישראלי"] }]);
    const storage = {
      getItem: () => raw,
      setItem: (_key: string, value: string) => { raw = value; },
    };

    const updated = updateSongCategories(storage, "1", ["שירים שקטים"]);
    expect(updated[0].categories).toEqual(["שירים שקטים"]);
    expect(() => updateSongCategories(storage, "1", [])).toThrow("SONG_CATEGORY_REQUIRED");
  });
});
