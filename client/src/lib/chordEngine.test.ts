import { describe, expect, it } from "vitest";
import {
  buildSongRenderBlocks,
  combineSongLines,
  getStartingKey,
  replaceChordToken,
  transposeChord,
  transposeChordLine,
  transposeNote,
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
});
