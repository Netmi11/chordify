import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { assertTab4uUrl, parseTab4uHtml } from "./tab4u";

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

  it("rejects non-Tab4U hosts", () => {
    expect(() => assertTab4uUrl("https://example.com/song.html")).toThrow();
    expect(() => assertTab4uUrl("http://www.tab4u.com/song.html")).toThrow();
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
