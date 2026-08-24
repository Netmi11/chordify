import { describe, expect, it } from "vitest";
import {
  buildSongRenderBlocks,
  combineSongLines,
  getStartingKey,
  replaceChordToken,
  transposeChord,
  transposeChordLine,
  transposeNote,
  transposeSongLine,
  transposeTab,
} from "./chordEngine";

describe("chordEngine", () => {
  it("transposes sharp and flat notes consistently", () => {
    expect(transposeNote("C#", 1, false)).toBe("D");
    expect(transposeNote("Db", 1, false)).toBe("D");
    expect(transposeNote("C#", 1, true)).toBe("D");
    expect(transposeNote("B", 1, true)).toBe("C");
  });

  it("transposes slash chords even when root and bass use different notation", () => {
    expect(transposeChord("Dbmaj7/G#", 2, false)).toBe("D#maj7/A#");
    expect(transposeChord("C#m/B", -2, true)).toBe("Bm/A");
  });

  it("preserves unsupported tokens", () => {
    expect(transposeChord("N.C.", 3, false)).toBe("N.C.");
    expect(transposeChordLine("C   |   G", 2, false)).toBe("D   |   A");
  });

  it("replaces only actual chord tokens", () => {
    expect(replaceChordToken("Intro C G/B x", 1, "D/F#")).toBe("Intro C D/F# x");
  });

  it("finds major and minor starting keys", () => {
    expect(getStartingKey([{ chord: "" }, { chord: "Am7 D" }])).toBe("Am");
    expect(getStartingKey([{ chord: "Fmaj7 C" }])).toBe("F");
    expect(getStartingKey([{ chord: "" }])).toBe("D");
  });

  it("combines a chord-only row with the following lyric row", () => {
    expect(combineSongLines([
      { chord: "C G", lyric: "" },
      { chord: "", lyric: "hello" },
    ])).toEqual([{ chord: "C G", lyric: "hello" }]);
  });

  it("keeps tabs as a grouped reading block", () => {
    const blocks = buildSongRenderBlocks([
      { label: "סולו", chord: "Am", lyric: "" },
      { chord: "", lyric: "e|---0---" },
      { chord: "", lyric: "B|---1---" },
    ]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ kind: "tab", label: "סולו", chord: "Am" });
    if (blocks[0].kind === "tab") expect(blocks[0].tabs).toEqual(["e|---0---", "B|---1---"]);
  });

  it("transposes single and double-digit frets while preserving tab width", () => {
    const source = "e|--9---10h12--|\nB|--0---2/10---|";
    const shifted = transposeTab(source, 1);

    expect(shifted).toBe("e|--10--11h13--|\nB|--1---3/11---|");
    expect(shifted.split("\n").map((line) => line.length)).toEqual(source.split("\n").map((line) => line.length));
  });

  it("moves out-of-range frets by octaves and always resets to the exact source", () => {
    expect(transposeTab("e|--0--1--23--24--|", -2)).toBe("e|--10-11-21--22--|");
    expect(transposeTab("e|--23--24--|", 2)).toBe("e|--13--14--|");
    expect(transposeTab("e|--0h2/10--|\r\nB|--1p0-----|", 0)).toBe("e|--0h2/10--|\r\nB|--1p0-----|");
  });

  it("does not transpose numbers outside a tablature string", () => {
    expect(transposeTab("Tempo 120\ne|--3--|", 2)).toBe("Tempo 120\ne|--5--|");
  });

  it("transposes modern and legacy tab rows for exports", () => {
    expect(transposeSongLine({ chord: "Am", lyric: "", tab: "e|--9--|" }, 1, false)).toEqual({ chord: "A#m", lyric: "", tab: "e|--10-|" });
    expect(transposeSongLine({ chord: "", lyric: "  B|--0--|" }, -1, false)).toEqual({ chord: "", lyric: "", tab: "  B|--11-|" });
  });
});
