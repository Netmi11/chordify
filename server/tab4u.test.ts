import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { assertTab4uUrl, fetchTab4uSong, parseTab4uHtml } from "./tab4u";
import { combineSongLines, getStartingKey, transposeChord } from "../client/src/pages/Home";

describe("Tab4U parser", () => {
  it("keeps chord rows and lyric rows in source order", () => {
    const html = `
      <h1>אקורדים לשיר להתאפק</h1>
      <div id="songContentTPL">
        <table>
          <tr><td>פתיחה:</td><td>Am Gm Am Fmaj7</td></tr>
          <tr><td>Dmaj7</td><td>החלה הפלישה</td></tr>
          <tr><td>Em7</td><td>חכי לי אני בא</td></tr>
          <tr><td>  D   D   Gmaj7   A  </td><td>  מעבר  </td></tr>
          <tr><td> </td><td> </td></tr>
        </table>
      </div>`;

    const song = parseTab4uHtml(html, "https://www.tab4u.com/tabs/songs/example.html");

    expect(song.lines).toEqual([
      { section: "פתיחה", chord: "Am Gm Am Fmaj7", lyric: "" },
      { section: undefined, chord: "Dmaj7", lyric: "החלה הפלישה" },
      { section: undefined, chord: "Em7", lyric: "חכי לי אני בא" },
      { section: undefined, chord: "  D   D   Gmaj7   A  ", lyric: "  מעבר  " },
      { section: undefined, chord: " ", lyric: " " },
    ]);

    expect(song.lines).toHaveLength(5);
  });

  it("keeps one-cell chord and lyric rows from the separated Tab4U layout", () => {
    const html = `
      <h1>אקורדים לשיר שם מעבר לפסנתר</h1>
      <div id="songContentTPL">
        <table>
          <tr><td class="song"><span class="titLine">פתיחה:</span></td></tr>
          <tr><td class="chords firstChords"><span class="c_C">Am</span>&nbsp;<span class="c_C">D7</span></td></tr>
          <tr><td class="song">שם&nbsp;מעבר&nbsp;לפסנתר</td></tr>
          <tr><td class="chords firstChords"><span class="c_C">Dm7</span>&nbsp;&nbsp;<span class="c_C">Em</span></td></tr>
          <tr><td class="song">עישנה&nbsp;סיגריות&nbsp;בשרשרת</td></tr>
        </table>
      </div>`;
    const song = parseTab4uHtml(html, "https://www.tab4u.com/tabs/songs/66419.html");
    expect(song.lines).toEqual([
      { section: "פתיחה", chord: "", lyric: "" },
      { chord: "Am D7", lyric: "" },
      { chord: "", lyric: "שם מעבר לפסנתר" },
      { chord: "Dm7  Em", lyric: "" },
      { chord: "", lyric: "עישנה סיגריות בשרשרת" },
    ]);
  });

  it("rejects non-Tab4U hosts", () => {
    expect(() => assertTab4uUrl("https://example.com/song.html")).toThrow();
    expect(() => assertTab4uUrl("http://www.tab4u.com/song.html")).toThrow();
  });
});

describe("ChordShift display logic", () => {
  it("combines a chord-only row with the lyric row below it", () => {
    expect(combineSongLines([
      { chord: "Am D7", lyric: "" },
      { chord: "", lyric: "שם מעבר לפסנתר" },
      { chord: "Dm7", lyric: "" },
      { chord: "", lyric: "עישנה סיגריות" },
    ])).toEqual([
      { chord: "Am D7", lyric: "שם מעבר לפסנתר" },
      { chord: "Dm7", lyric: "עישנה סיגריות" },
    ]);
  });

  it("uses the opening chord root and preserves minor mode", () => {
    expect(getStartingKey([{ chord: "Am6 D7" }])).toBe("Am");
    expect(getStartingKey([{ chord: "Fmaj7 C7" }])).toBe("F");
  });

  it("supports the +7 shortcut and returns to the original at zero", () => {
    expect(transposeChord("Am D7", 7, false)).toBe("Em A7");
    expect(transposeChord("Am D7", 0, false)).toBe("Am D7");
  });
});

describe("Tab4U fetch flow", () => {
  it("parses a successful Tab4U response through the fetch helper", async () => {
    const html = readFileSync(resolve(process.cwd(), "server/fixtures/tab4u-table-variant.html"), "utf8");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(html, { status: 200 })));
    const song = await fetchTab4uSong("https://www.tab4u.com/tabs/songs/fixture.html");
    expect(song.title).toBe("אקורדים לשיר להתאפק");
    expect(song.lines[0]?.section).toBe("פתיחה");
    vi.unstubAllGlobals();
  });
});

describe("Tab4U parser fixtures", () => {
  it("parses a header-cell table variant", () => {
    const html = readFileSync(resolve(process.cwd(), "server/fixtures/tab4u-table-variant.html"), "utf8");
    const song = parseTab4uHtml(html, "https://www.tab4u.com/tabs/songs/variant.html");
    expect(song.lines).toHaveLength(5);
    expect(song.lines[0]).toMatchObject({ section: "פתיחה", chord: "Am  Gm  Am  Fmaj7", lyric: "" });
    expect(song.lines[3]).toEqual({ section: undefined, chord: "  D   D   Gmaj7   A  ", lyric: "  מעבר  " });
    expect(song.lines[4]).toEqual({ section: undefined, chord: " ", lyric: " " });
  });

  it("keeps fallback br rows including an empty row", () => {
    const html = readFileSync(resolve(process.cwd(), "server/fixtures/tab4u-br-variant.html"), "utf8");
    const song = parseTab4uHtml(html, "https://www.tab4u.com/tabs/songs/fallback.html");
    expect(song.lines).toHaveLength(4);
    expect(song.lines[0].lyric).toBe("Am Gm");
    expect(song.lines[1].lyric).toBe("");
  });
});
