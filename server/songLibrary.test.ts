import { describe, expect, it } from "vitest";
import { makeSavedSong, mergeCloudSongs, normalizeSongMetadata, parseSongBatchImport, parseSongImport, parseSongLibrary, parseSongLibraryBackup, readSongLibrary, removeSong, serializeSongLibrary, sortSongsForLibrary, sortSongsByAddedAt, type SavedSong, type LibrarySort, upsertSong, updateSongNote } from "../client/src/lib/songLibraryV2";

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe("song library persistence", () => {
  it("saves original song content, keeps newest songs first, and updates personal notes", () => {
    const storage = new MemoryStorage();
    const older = makeSavedSong({ id: "older", addedAt: 1, title: "ראשון", artist: "אמן א", sourceUrl: "https://www.tab4u.com/tabs/songs/1.html", lines: [{ chord: "Am", lyric: "מילים" }] });
    const newer = makeSavedSong({ id: "newer", addedAt: 2, title: "שני", artist: "אמן ב", sourceUrl: "https://www.tab4u.com/tabs/songs/2.html", lines: [{ chord: "D", lyric: "מילים אחרות" }] });

    upsertSong(storage, older);
    upsertSong(storage, newer);
    expect(readSongLibrary(storage).map((song) => song.id)).toEqual(["newer", "older"]);

    updateSongNote(storage, "older", "קאפו 2 בפתיחה");
    expect(readSongLibrary(storage).find((song) => song.id === "older")?.note).toBe("קאפו 2 בפתיחה");
    expect(readSongLibrary(storage).find((song) => song.id === "older")?.lines[0]?.chord).toBe("Am");

    expect(removeSong(storage, "newer").map((song) => song.id)).toEqual(["older"]);
  });

  it("sorts the library by date, artist, or title without mutating the source", () => {
    const songs: SavedSong[] = [
      makeSavedSong({ id: "z", addedAt: 1, title: "Bravo", artist: "Beta", sourceUrl: "https://www.tab4u.com/tabs/songs/11.html", lines: [] }),
      makeSavedSong({ id: "a", addedAt: 3, title: "Alpha", artist: "Alpha", sourceUrl: "https://www.tab4u.com/tabs/songs/12.html", lines: [] }),
      makeSavedSong({ id: "m", addedAt: 2, title: "Charlie", artist: "Beta", sourceUrl: "https://www.tab4u.com/tabs/songs/13.html", lines: [] }),
    ];
    const expected: Record<LibrarySort, string[]> = { addedAt: ["a", "m", "z"], artist: ["a", "z", "m"], title: ["a", "z", "m"] };
    (Object.keys(expected) as LibrarySort[]).forEach((sortBy) => expect(sortSongsForLibrary(songs, sortBy).map((song) => song.id)).toEqual(expected[sortBy]));
    expect(songs.map((song) => song.id)).toEqual(["z", "a", "m"]);
  });

  it("ignores corrupt values in local storage", () => {
    expect(parseSongLibrary("not-json")).toEqual([]);
    expect(parseSongLibrary(JSON.stringify([{ title: "חסר שדות" }]))).toEqual([]);
  });

  it("cleans leaked Tab4U meta markup from imported metadata", () => {
    expect(normalizeSongMetadata('מרסדס בנד | <meta name="title" content="אקורדים לשיר להתאפק של מרסדס בנד">', '<meta name="title" content="מרסדס בנד">')).toEqual({ title: "להתאפק", artist: "מרסדס בנד" });

    const payload = JSON.stringify({ type: "chordshift-import-v1", song: { title: 'מרסדס בנד | <meta name="title" content="אקורדים לשיר להתאפק של מרסדס בנד">', artist: '<meta name="title" content="מרסדס בנד">', sourceUrl: "https://www.tab4u.com/tabs/songs/75402_song.html", lines: [{ chord: "Am", lyric: "מילים" }] } });
    expect(parseSongImport(payload)?.song.title).toBe("להתאפק");
    expect(parseSongImport(payload)?.song.artist).toBe("מרסדס בנד");
  });

  it("cleans the truncated Tab4U metadata variant from the current device", () => {
    expect(normalizeSongMetadata("להתאפק של מרסדס בנד", 'מרסדס בנד | אקורדים"=Tab4U<meta name="title" content |')).toEqual({ title: "להתאפק", artist: "מרסדס בנד" });
  });

  it("repairs legacy metadata when reading local storage", () => {
    const storage = new MemoryStorage();
    const legacy = { id: "legacy", title: 'מרסדס בנד | <meta name="title" content="אקורדים לשיר להתאפק של מרסדס בנד">', artist: '<meta name="title" content="מרסדס בנד">', sourceUrl: "https://www.tab4u.com/tabs/songs/75402_song.html", lines: [{ chord: "Am", lyric: "מילים" }], addedAt: 1, note: "" };
    storage.setItem("chordshift-song-library-v1", JSON.stringify([legacy]));
    expect(readSongLibrary(storage)[0]).toMatchObject({ title: "להתאפק", artist: "מרסדס בנד" });
    expect(storage.getItem("chordshift-song-library-v1")).not.toContain("meta name");
  });

  it("accepts a unique batch of Tab4U song imports and rejects oversized batches", () => {
    const song = { title: "מלאך", artist: "מרסדס בנד", sourceUrl: "https://www.tab4u.com/tabs/songs/3851_song.html", lines: [{ chord: "A", lyric: "מילים" }] };
    const second = { ...song, title: "סופי", sourceUrl: "https://www.tab4u.com/tabs/songs/4640_song.html" };
    expect(parseSongBatchImport(JSON.stringify({ type: "chordshift-import-batch-v1", songs: [song, second] }))?.songs).toHaveLength(2);
    expect(parseSongBatchImport(JSON.stringify({ type: "chordshift-import-batch-v1", songs: Array.from({ length: 11 }, (_, index) => ({ ...song, sourceUrl: `https://www.tab4u.com/tabs/songs/${index}.html` })) }))).toBeNull();
  });

  it("round-trips a local library backup and ignores invalid records", () => {
    const songs = [makeSavedSong({ id: "backup-1", addedAt: 10, title: "להתאפק", artist: "מרסדס בנד", sourceUrl: "https://www.tab4u.com/tabs/songs/75402_song.html", lines: [{ chord: "Am", lyric: "מילים", tab: "e|-0-|" }] })];
    const restored = parseSongLibraryBackup(serializeSongLibrary(songs));
    expect(restored).toHaveLength(1);
    expect(restored[0]).toMatchObject({ title: "להתאפק", artist: "מרסדס בנד", sourceUrl: songs[0].sourceUrl });
    expect(restored[0].lines[0]?.tab).toBe("e|-0-|");
    expect(parseSongLibraryBackup(JSON.stringify({ songs: [{ title: "חסר שדות" }] }))).toEqual([]);
  });

  it("accepts imports only from known Tab4U song URLs and preserves tab rows", () => {
    const payload = JSON.stringify({ type: "chordshift-import-v1", song: { title: "Hotel California", artist: "Eagles", sourceUrl: "https://en.tab4u.com/tabs/songs/3228_Eagles_-_Hotel_California.html", lines: [{ chord: "Bm", lyric: "" }, { chord: "", lyric: "", tab: "e|-9---|" }] } });
    expect(parseSongImport(payload)?.song.lines[1]?.tab).toBe("e|-9---|");
    expect(parseSongImport(payload)?.song.sourceUrl).toContain("en.tab4u.com");
    expect(parseSongImport(JSON.stringify({ type: "chordshift-import-v1", song: { title: "לא תקין", artist: "x", sourceUrl: "https://example.com/tabs/songs/1", lines: [] } }))).toBeNull();
  });

  it("merges a new cloud song without replacing a matching local song or its note", () => {
    const local = makeSavedSong({ id: "local", addedAt: 2, title: "להתאפק", artist: "מרסדס בנד", sourceUrl: "https://www.tab4u.com/tabs/songs/local.html", note: "קאפו 2", lines: [] });
    const cloudDuplicate = makeSavedSong({ id: "cloud-local", addedAt: 3, title: "להתאפק בענן", artist: "מרסדס בנד", sourceUrl: "https://www.tab4u.com/tabs/songs/local.html", lines: [] });
    const cloudNew = makeSavedSong({ id: "cloud-new", addedAt: 4, title: "מלאך", artist: "מרסדס בנד", sourceUrl: "https://www.tab4u.com/tabs/songs/new.html", lines: [] });
    expect(mergeCloudSongs([local], [cloudDuplicate, cloudNew])).toEqual([cloudNew, local]);
  });
});
