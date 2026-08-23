import type { SavedSong } from "./songLibraryV2";

export type LibraryStats = {
  songs: number;
  artists: number;
  withNotes: number;
  withTabs: number;
};

export function getLibraryStats(songs: SavedSong[]): LibraryStats {
  const artists = new Set<string>();
  let withNotes = 0;
  let withTabs = 0;

  for (const song of songs) {
    if (song.artist.trim()) artists.add(song.artist.trim());
    if (song.note.trim()) withNotes += 1;
    if (song.lines.some((line) => Boolean(line.tab) || /^[eBGDAE]\|/.test(line.lyric.trimStart()))) withTabs += 1;
  }

  return {
    songs: songs.length,
    artists: artists.size,
    withNotes,
    withTabs,
  };
}
