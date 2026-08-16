import { describe, expect, it } from "vitest";
import { buildSongPdfHtml } from "../client/src/lib/songPdf";

describe("song PDF export", () => {
  it("builds an RTL A4 print document with title, chords, lyrics, and tabs", () => {
    const html = buildSongPdfHtml({ title: "להתאפק", artist: "מרסדס בנד", lines: [{ label: "בית", chord: "Am   G", lyric: "מילים לדוגמה" }, { chord: "", lyric: "", tab: "e|--0--|" }] });
    expect(html).toContain('@page{size:A4');
    expect(html).toContain('lang="he" dir="rtl"');
    expect(html).toContain("להתאפק");
    expect(html).toContain('class="chords" dir="ltr">Am   G');
    expect(html).toContain('class="tab" dir="ltr">e|--0--|');
  });

  it("escapes song metadata and lines before inserting them into the print document", () => {
    const html = buildSongPdfHtml({ title: "<script>", artist: "אמן & חברים", lines: [{ chord: "A", lyric: "<מילים>" }] });
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("אמן &amp; חברים");
    expect(html).toContain("&lt;מילים&gt;");
    expect(html).not.toContain("<מילים>");
  });
});
