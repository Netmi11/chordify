import type { SongLine } from "./songLibraryV2";

const SHARP_NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
const FLAT_NOTES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"] as const;
const NOTE_PATTERN = /^[A-G](?:#|b)?$/;
const CHORD_PATTERN = /^([A-G](?:#|b)?)([^/\s]*)(?:\/([A-G](?:#|b)?))?$/;
const TAB_STRING_PATTERN = /^[eBGDAE]\|/;
const MAX_STANDARD_FRET = 24;

function noteIndex(note: string): number {
  const sharpIndex = SHARP_NOTES.indexOf(note as (typeof SHARP_NOTES)[number]);
  if (sharpIndex >= 0) return sharpIndex;
  return FLAT_NOTES.indexOf(note as (typeof FLAT_NOTES)[number]);
}

function wrapSemitones(value: number): number {
  return ((value % 12) + 12) % 12;
}

function playableFret(fret: number, steps: number): number {
  const shifted = fret + steps;
  if (shifted >= 0 && shifted <= MAX_STANDARD_FRET) return shifted;

  // Chord transposition is octave-independent. When the same-string position
  // would fall outside a standard 24-fret neck, keep the transposed pitch
  // class and move it by one or more octaves into the playable range.
  const minimumOctaves = Math.ceil(-shifted / 12);
  const maximumOctaves = Math.floor((MAX_STANDARD_FRET - shifted) / 12);
  if (minimumOctaves > maximumOctaves) return fret;

  const octaveOffset = Math.min(maximumOctaves, Math.max(minimumOctaves, 0));
  return shifted + octaveOffset * 12;
}

function transposePhysicalTabLine(line: string, steps: number): string {
  if (!steps) return line;

  const pipeIndex = line.indexOf("|");
  if (pipeIndex < 0) return line;

  const prefix = line.slice(0, pipeIndex + 1);
  const parts = line.slice(pipeIndex + 1).split(/(\d+)/);

  for (let index = 1; index < parts.length; index += 2) {
    const original = parts[index];
    const fret = Number(original);
    if (!Number.isInteger(fret)) continue;

    const replacement = String(playableFret(fret, steps));
    const widthDelta = replacement.length - original.length;
    parts[index] = replacement;
    if (!widthDelta) continue;

    // Compensate with the next run of timing dashes. This keeps string lines
    // aligned even when a fret changes between one and two digits.
    let rebalanced = false;
    for (let nextIndex = index + 1; nextIndex < parts.length; nextIndex += 2) {
      const leadingDashes = parts[nextIndex].match(/^-+/)?.[0].length ?? 0;
      if (widthDelta > 0 && leadingDashes >= widthDelta) {
        parts[nextIndex] = parts[nextIndex].slice(widthDelta);
        rebalanced = true;
        break;
      }
      if (widthDelta < 0) {
        parts[nextIndex] = `${"-".repeat(-widthDelta)}${parts[nextIndex]}`;
        rebalanced = true;
        break;
      }
    }

    if (!rebalanced && widthDelta < 0) parts.push("-".repeat(-widthDelta));
  }

  return prefix + parts.join("");
}

/**
 * Transpose every fret in a single- or multi-line tablature block.
 *
 * The source is never mutated and a zero shift is returned byte-for-byte,
 * making reset and repeated +/- transformations deterministic.
 */
export function transposeTab(tab: string, steps: number): string {
  return tab
    .split(/(\r?\n)/)
    .map((part) => (/^\r?\n$/.test(part) ? part : transposePhysicalTabLine(part, steps)))
    .join("");
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

/** Transpose every playable part of a song row, including legacy tab rows. */
export function transposeSongLine(line: SongLine, steps: number, flats: boolean): SongLine {
  const legacyTab = !line.tab && TAB_STRING_PATTERN.test(line.lyric.trimStart()) ? line.lyric.trimEnd() : "";
  return {
    ...line,
    chord: transposeChordLine(line.chord, steps, flats),
    ...(line.tab
      ? { tab: transposeTab(line.tab, steps) }
      : legacyTab
        ? { lyric: "", tab: transposeTab(legacyTab, steps) }
        : {}),
  };
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
