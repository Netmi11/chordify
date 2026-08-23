import type { SongLine } from "./songLibraryV2";

const SHARP_NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
const FLAT_NOTES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"] as const;
const NOTE_PATTERN = /^[A-G](?:#|b)?$/;
const CHORD_PATTERN = /^([A-G](?:#|b)?)([^/\s]*)(?:\/([A-G](?:#|b)?))?$/;
const TAB_STRING_PATTERN = /^[eBGDAE]\|/;

function noteIndex(note: string): number {
  const sharpIndex = SHARP_NOTES.indexOf(note as (typeof SHARP_NOTES)[number]);
  if (sharpIndex >= 0) return sharpIndex;
  return FLAT_NOTES.indexOf(note as (typeof FLAT_NOTES)[number]);
}

function wrapSemitones(value: number): number {
  return ((value % 12) + 12) % 12;
}

export function transposeNote(note: string, steps: number, flats: boolean): string {
  if (!NOTE_PATTERN.test(note)) return note;
  const index = noteIndex(note);
  if (index < 0) return note;
  const output = flats ? FLAT_NOTES : SHARP_NOTES;
  return output[wrapSemitones(index + steps)];
}

function transposeChordToken(chord: string, steps: number, flats: boolean): string {
  const match = chord.match(CHORD_PATTERN);
  if (!match) return chord;
  const [, root, suffix, bass] = match;
  const shiftedRoot = transposeNote(root, steps, flats);
  const shiftedBass = bass ? transposeNote(bass, steps, flats) : "";
  return `${shiftedRoot}${suffix}${shiftedBass ? `/${shiftedBass}` : ""}`;
}

/**
 * Transpose a chord token or a whitespace-separated chord line while preserving
 * the exact spacing between tokens. Keeping the broader behavior maintains
 * compatibility with the original Home implementation and PDF/export callers.
 */
export function transposeChord(chord: string, steps: number, flats: boolean): string {
  return chord
    .split(/(\s+)/)
    .map((part) => (CHORD_PATTERN.test(part) ? transposeChordToken(part, steps, flats) : part))
    .join("");
}

export function transposeChordLine(chordLine: string, steps: number, flats: boolean): string {
  return transposeChord(chordLine, steps, flats);
}

export function replaceChordToken(chordLine: string, targetIndex: number, replacement: string): string {
  let chordIndex = 0;
  return chordLine.replace(/\S+/g, (token) => {
    if (!CHORD_PATTERN.test(token)) return token;
    const currentIndex = chordIndex;
    chordIndex += 1;
    return currentIndex === targetIndex ? replacement : token;
  });
}

export function getStartingKey(lines: Array<{ chord: string }>): string {
  for (const line of lines) {
    for (const token of line.chord.split(/\s+/)) {
      const match = token.match(/^([A-G](?:#|b)?)(m(?!aj))?/i);
      if (match) return `${match[1]}${match[2] ?? ""}`;
    }
  }
  return "D";
}

export function combineSongLines(lines: SongLine[]): SongLine[] {
  const combined: SongLine[] = [];
  for (const line of lines) {
    const previous = combined[combined.length - 1];
    if (previous && !previous.lyric && previous.chord && !line.chord && line.lyric && !line.label && !line.tab) {
      previous.lyric = line.lyric;
    } else {
      combined.push({ ...line });
    }
  }
  return combined;
}

export type SongRenderBlock =
  | { kind: "line"; line: SongLine; sourceIndex: number }
  | { kind: "tab"; label: string; chord: string; chordSourceIndex: number | null; tabs: string[] };

export function buildSongRenderBlocks(lines: SongLine[]): SongRenderBlock[] {
  const normalized = lines.map((line, sourceIndex) => {
    const legacyTab = !line.tab && TAB_STRING_PATTERN.test(line.lyric.trimStart());
    return { ...(legacyTab ? { ...line, lyric: "", tab: line.lyric.trimEnd() } : line), sourceIndex };
  });

  const combined: Array<SongLine & { sourceIndex: number }> = [];
  for (const line of normalized) {
    const previous = combined[combined.length - 1];
    if (previous && !previous.lyric && previous.chord && !line.chord && line.lyric && !line.label && !line.tab) {
      previous.lyric = line.lyric;
    } else {
      combined.push({ ...line });
    }
  }

  const blocks: SongRenderBlock[] = [];
  for (let index = 0; index < combined.length; index += 1) {
    const line = combined[index];
    if (!line.tab) {
      blocks.push({ kind: "line", line, sourceIndex: line.sourceIndex });
      continue;
    }

    let label = line.label ?? "";
    let chord = line.chord;
    let chordSourceIndex: number | null = line.chord ? line.sourceIndex : null;

    const previous = blocks[blocks.length - 1];
    if (previous?.kind === "line" && previous.line.chord && !previous.line.lyric && !previous.line.tab) {
      chord ||= previous.line.chord;
      chordSourceIndex ??= previous.sourceIndex;
      label ||= previous.line.label ?? "";
      blocks.pop();
    }

    const section = blocks[blocks.length - 1];
    if (!label && section?.kind === "line" && section.line.label && !section.line.chord && !section.line.lyric) {
      label = section.line.label;
      blocks.pop();
    }

    const tabs = [line.tab];
    while (index + 1 < combined.length && combined[index + 1].tab) {
      index += 1;
      tabs.push(combined[index].tab!);
    }

    blocks.push({ kind: "tab", label, chord, chordSourceIndex, tabs });
  }

  return blocks;
}
