import { describe, expect, it } from "vitest";
import {
  buildSongRenderBlocks,
  combineSongLines,
  getStartingKey,
  normalizeTransposeSteps,
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

  it("wraps modulation after one octave in both directions", () => {
    expect(normalizeTransposeSteps(12)).toBe(0);
    expect(normalizeTransposeSteps(13)).toBe(1);
    expect(normalizeTransposeSteps(-12)).toBe(0);
    expect(normalizeTransposeSteps(-13)).toBe(-1);
    expect(transposeTab("e|--3--|", 25)).toBe(transposeTab("e|--3--|", 1));
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
    const source = [
      "e|--9---10h12--|",
      "B|--0---2/10---|",
      "G|--------------|",
      "D|--------------|",
      "A|--------------|",
      "E|--------------|",
    ].join("\n");
    const shifted = transposeTab(source, 1);

    expect(shifted).toBe([
      "e|--10---------|",
      "B|--1---3/11---|",
      "G|------8h10----|",
      "D|--------------|",
      "A|--------------|",
      "E|--------------|",
    ].join("\n"));
    expect(shifted.split("\n").map((line) => line.length)).toEqual(source.split("\n").map((line) => line.length));
  });

  it("moves out-of-range frets by octaves and always resets to the exact source", () => {
    expect(transposeTab("e|--0--1--23--24--|", -2)).toBe("e|--10-11-9---10--|");
    expect(transposeTab("e|--23--24--|", 2)).toBe("e|--1---2---|");
    expect(transposeTab("e|--0h2/10--|\r\nB|--1p0-----|", 0)).toBe("e|--0h2/10--|\r\nB|--1p0-----|");
  });

  it("allows fret 12 but never emits a higher fret after transposition", () => {
    expect(transposeTab("e|--11--|", 1)).toBe("e|--12--|");

    const source = [
      "e|--0------------------|",
      "B|------7--------------|",
      "G|----------12---------|",
      "D|--------------19-----|",
      "A|------------------24-|",
      "E|--24-----------------|",
    ].join("\n");
    for (const steps of [-23, -13, -1, 1, 13, 23]) {
      const frets = Array.from(transposeTab(source, steps).matchAll(/\d+/g), (match) => Number(match[0]));
      expect(frets.length).toBeGreaterThan(0);
      expect(Math.max(...frets)).toBeLessThanOrEqual(12);
    }
    expect(transposeTab(source, 12)).toBe(source);
    expect(transposeTab(source, -12)).toBe(source);
  });

  it("moves notes to adjacent strings when a transposition crosses fretboard boundaries", () => {
    const highFret = [
      "e|--------|",
      "B|--------|",
      "G|--------|",
      "D|--------|",
      "A|--------|",
      "E|--24----|",
    ].join("\n");
    expect(transposeTab(highFret, 1)).toBe([
      "e|--------|",
      "B|--------|",
      "G|--10----|",
      "D|--------|",
      "A|--------|",
      "E|--------|",
    ].join("\n"));

    const openHighE = [
      "e|--0-----|",
      "B|--------|",
      "G|--------|",
      "D|--------|",
      "A|--------|",
      "E|--------|",
    ].join("\n");
    expect(transposeTab(openHighE, -1)).toBe([
      "e|--------|",
      "B|--4-----|",
      "G|--------|",
      "D|--------|",
      "A|--------|",
      "E|--------|",
    ].join("\n"));
  });

  it("moves complete hammer-on and slide groups together instead of splitting the fingering", () => {
    const source = [
      "e|----------|",
      "B|----------|",
      "G|----------|",
      "D|----------|",
      "A|----------|",
      "E|--23h24---|",
    ].join("\n");
    expect(transposeTab(source, 2)).toBe([
      "e|----------|",
      "B|----------|",
      "G|--10h11---|",
      "D|----------|",
      "A|----------|",
      "E|----------|",
    ].join("\n"));
  });

  it("treats consecutive six-string systems as separate fretboards", () => {
    const system = [
      "e|--------|",
      "B|--------|",
      "G|--------|",
      "D|--------|",
      "A|--------|",
      "E|--24----|",
    ];
    expect(transposeTab([...system, ...system].join("\n"), 1)).toBe([
      "e|--------|", "B|--------|", "G|--10----|", "D|--------|", "A|--------|", "E|--------|",
      "e|--------|", "B|--------|", "G|--10----|", "D|--------|", "A|--------|", "E|--------|",
    ].join("\n"));
  });

  it("does not transpose numbers outside a tablature string", () => {
    expect(transposeTab("Tempo 120\ne|--3--|", 2)).toBe("Tempo 120\ne|--5--|");
  });

  it("transposes modern and legacy tab rows for exports", () => {
    expect(transposeSongLine({ chord: "Am", lyric: "", tab: "e|--9--|" }, 1, false)).toEqual({ chord: "A#m", lyric: "", tab: "e|--10-|" });
    expect(transposeSongLine({ chord: "", lyric: "  B|--0--|" }, -1, false)).toEqual({ chord: "", lyric: "", tab: "  B|--11-|" });
  });
});
