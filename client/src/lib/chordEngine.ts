import type { SongLine } from "./songLibraryV2";

const SHARP_NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
const FLAT_NOTES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"] as const;
const NOTE_PATTERN = /^[A-G](?:#|b)?$/;
const CHORD_PATTERN = /^([A-G](?:#|b)?)([^/\s]*)(?:\/([A-G](?:#|b)?))?$/;
const TAB_STRING_PATTERN = /^[eBGDAE]\|/;
const MAX_STANDARD_FRET = 24;
const TAB_ROW_PATTERN = /^\s*([A-Ga-g](?:#|b)?)\s*\|/;
const NOTE_CLASSES: Record<string, number> = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };

type ParsedTabRow = {
  prefix: string;
  body: string;
  tuning: number;
};

type TabChunk = {
  sourceRow: number;
  start: number;
  end: number;
  text: string;
  frets: number[];
};

type TabPlacement = {
  row: number;
  text: string;
  score: number;
};

function noteIndex(note: string): number {
  const sharpIndex = SHARP_NOTES.indexOf(note as (typeof SHARP_NOTES)[number]);
  if (sharpIndex >= 0) return sharpIndex;
  return FLAT_NOTES.indexOf(note as (typeof FLAT_NOTES)[number]);
}

function wrapSemitones(value: number): number {
  return ((value % 12) + 12) % 12;
}

function noteClass(label: string): number | null {
  const normalized = `${label[0]?.toUpperCase() ?? ""}${label.slice(1)}`;
  return NOTE_CLASSES[normalized] ?? null;
}

function inferTabTunings(labels: string[]): number[] | null {
  const classes = labels.map(noteClass);
  if (classes.some((value) => value === null)) return null;

  const firstClass = classes[0]!;
  let previous = firstClass + 12 * Math.round((64 - firstClass) / 12);
  const tunings = [previous];

  for (const value of classes.slice(1)) {
    let pitch = value! + 12 * Math.floor((previous - 1 - value!) / 12);
    while (pitch >= previous) pitch -= 12;
    tunings.push(pitch);
    previous = pitch;
  }

  return tunings;
}

function parseTabChunks(body: string, sourceRow: number): TabChunk[] {
  const chunks: TabChunk[] = [];
  const pattern = /[^-|\s]*\d+[^-|\s]*/g;
  for (const match of Array.from(body.matchAll(pattern))) {
    const frets = Array.from(match[0].matchAll(/\d+/g)).map((fret) => Number(fret[0]));
    if (!frets.length || frets.some((fret) => !Number.isInteger(fret))) continue;
    chunks.push({ sourceRow, start: match.index, end: match.index + match[0].length, text: match[0], frets });
  }
  return chunks;
}

function placementCandidates(chunk: TabChunk, rows: ParsedTabRow[], steps: number): TabPlacement[] {
  const sourceTuning = rows[chunk.sourceRow].tuning;
  const placements: TabPlacement[] = [];

  for (let octaveShift = -2; octaveShift <= 2; octaveShift += 1) {
    for (let row = 0; row < rows.length; row += 1) {
      const targetFrets = chunk.frets.map((fret) => sourceTuning + fret + steps + octaveShift * 12 - rows[row].tuning);
      if (targetFrets.some((fret) => fret < 0 || fret > MAX_STANDARD_FRET)) continue;

      let fretIndex = 0;
      const text = chunk.text.replace(/\d+/g, () => String(targetFrets[fretIndex++]));
      const octavePenalty = Math.abs(octaveShift) * 1000;
      const stringPenalty = Math.abs(row - chunk.sourceRow) * 20;
      const sameStringBonus = row === chunk.sourceRow ? -1 : 0;
      placements.push({ row, text, score: octavePenalty + stringPenalty + sameStringBonus });
    }
  }

  return placements.sort((left, right) => left.score - right.score || left.row - right.row);
}

function canPlace(body: string[], start: number, width: number): boolean {
  for (let index = start; index < start + width; index += 1) {
    if (index < body.length && body[index] !== "-") return false;
  }
  return true;
}

function transposeTabRows(lines: string[], steps: number): string[] {
  const labels = lines.map((line) => line.match(TAB_ROW_PATTERN)?.[1] ?? "");
  const tunings = inferTabTunings(labels);
  if (!tunings) return lines;

  const rows: ParsedTabRow[] = lines.map((line, index) => {
    const pipeIndex = line.indexOf("|");
    return { prefix: line.slice(0, pipeIndex + 1), body: line.slice(pipeIndex + 1), tuning: tunings[index] };
  });
  const chunks = rows.flatMap((row, index) => parseTabChunks(row.body, index));
  const bodies = rows.map((row) => row.body.split(""));

  for (const chunk of chunks) {
    for (let index = chunk.start; index < chunk.end; index += 1) bodies[chunk.sourceRow][index] = "-";
  }

  const occupiedAtStart = new Map<number, Set<number>>();
  for (const chunk of chunks.sort((left, right) => left.start - right.start || left.sourceRow - right.sourceRow)) {
    const occupiedRows = occupiedAtStart.get(chunk.start) ?? new Set<number>();
    const candidates = placementCandidates(chunk, rows, steps);
    const placement = candidates.find((candidate) => !occupiedRows.has(candidate.row) && canPlace(bodies[candidate.row], chunk.start, candidate.text.length))
      ?? candidates.find((candidate) => !occupiedRows.has(candidate.row))
      ?? candidates[0];
    if (!placement) continue;

    occupiedRows.add(placement.row);
    occupiedAtStart.set(chunk.start, occupiedRows);
    const target = bodies[placement.row];
    while (target.length < chunk.start + placement.text.length) target.push("-");
    target.splice(chunk.start, placement.text.length, ...placement.text.split(""));
  }

  return rows.map((row, index) => row.prefix + bodies[index].join(""));
}

function splitTabSystems(rowIndexes: number[], parts: string[]): number[][] {
  const systems: number[][] = [];
  let current: number[] = [];
  let firstLabel = "";

  for (const rowIndex of rowIndexes) {
    const label = parts[rowIndex].match(TAB_ROW_PATTERN)?.[1] ?? "";
    const startsRepeatedSystem = current.length >= 2 && current.length < 5 && label === firstLabel;
    if (current.length >= 6 || startsRepeatedSystem) {
      systems.push(current);
      current = [];
    }
    if (!current.length) firstLabel = label;
    current.push(rowIndex);
  }

  if (current.length) systems.push(current);
  return systems;
}

/**
 * Transpose a single- or multi-line tablature block across a real fretboard.
 *
 * Notes stay on their original string while the fret remains playable. At the
 * 0/24-fret boundaries, complete technique groups move to the nearest playable
 * string. Octave displacement is a last resort only at the instrument's range.
 */
export function transposeTab(tab: string, steps: number): string {
  if (!steps) return tab;

  const parts = tab.split(/(\r?\n)/);
  for (let index = 0; index < parts.length; index += 2) {
    if (!TAB_ROW_PATTERN.test(parts[index])) continue;
    const rowIndexes: number[] = [];
    for (let cursor = index; cursor < parts.length && TAB_ROW_PATTERN.test(parts[cursor]); cursor += 2) rowIndexes.push(cursor);
    for (const system of splitTabSystems(rowIndexes, parts)) {
      const transposed = transposeTabRows(system.map((rowIndex) => parts[rowIndex]), steps);
      system.forEach((rowIndex, row) => { parts[rowIndex] = transposed[row]; });
    }
    index = rowIndexes[rowIndexes.length - 1];
  }
  return parts.join("");
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
