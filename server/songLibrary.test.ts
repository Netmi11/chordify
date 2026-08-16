import { describe, expect, it } from "vitest";
import { makeSavedSong, parseSongImport, parseSongLibrary, readSongLibrary, removeSong, upsertSong, updateSongNote } from "../client/src/lib/songLibrary";

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

  it("ignores corrupt values in local storage", () => {
    expect(parseSongLibrary("not-json")).toEqual([]);
    expect(parseSongLibrary(JSON.stringify([{ title: "חסר שדות" }]))).toEqual([]);
  });

  it("accepts imports only from known Tab4U song URLs and preserves tab rows", () => {
    const payload = JSON.stringify({ type: "chordshift-import-v1", song: { title: "Hotel California", artist: "Eagles", sourceUrl: "https://en.tab4u.com/tabs/songs/3228_Eagles_-_Hotel_California.html", lines: [{ chord: "Bm", lyric: "" }, { chord: "", lyric: "", tab: "e|-9---|" }] } });
    expect(parseSongImport(payload)?.song.lines[1]?.tab).toBe("e|-9---|");
    expect(parseSongImport(payload)?.song.sourceUrl).toContain("en.tab4u.com");
    expect(parseSongImport(JSON.stringify({ type: "chordshift-import-v1", song: { title: "לא תקין", artist: "x", sourceUrl: "https://example.com/tabs/songs/1", lines: [] } }))).toBeNull();
  });
});
