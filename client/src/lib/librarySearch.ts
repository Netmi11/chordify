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

export function filterSongs(songs: SavedSong[], query: string): SavedSong[] {
  return songs.filter((song) => songMatchesQuery(song, query));
}

export function groupSongsByArtist(songs: SavedSong[]): Array<[string, SavedSong[]]> {
  const groups = new Map<string, SavedSong[]>();
  for (const song of songs) {
    const artist = song.artist || "אמן לא צוין";
    const group = groups.get(artist);
    if (group) group.push(song);
    else groups.set(artist, [song]);
  }
  return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b, "he"));
}
