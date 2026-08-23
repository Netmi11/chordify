import type { SavedSong } from "./songLibraryV2";

const HEBREW_DIACRITICS = /[\u0591-\u05C7]/g;

export function normalizeLibrarySearch(value: string): string {
  return value
    .normalize("NFKD")
    .replace(HEBREW_DIACRITICS, "")
    .toLocaleLowerCase("he")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function songMatchesQuery(song: Pick<SavedSong, "title" | "artist">, query: string): boolean {
  const needle = normalizeLibrarySearch(query);
  if (!needle) return true;
  const haystack = normalizeLibrarySearch(`${song.title} ${song.artist}`);
  return needle.split(" ").every((part) => haystack.includes(part));
}
