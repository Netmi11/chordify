export type SongLine = {
  label?: string;
  chord: string;
  lyric: string;
  tab?: string;
};

export type SavedSong = {
  id: string;
  title: string;
  artist: string;
  sourceUrl: string;
  lines: SongLine[];
  addedAt: number;
  note: string;
};

export const SONG_LIBRARY_STORAGE_KEY = "chordshift-song-library-v1";

function isSongLine(value: unknown): value is SongLine {
  if (!value || typeof value !== "object") return false;
  const line = value as Partial<SongLine>;
  return typeof line.chord === "string" && typeof line.lyric === "string" && (line.label === undefined || typeof line.label === "string") && (line.tab === undefined || typeof line.tab === "string");
}

function isSavedSong(value: unknown): value is SavedSong {
  if (!value || typeof value !== "object") return false;
  const song = value as Partial<SavedSong>;
  return typeof song.id === "string" && typeof song.title === "string" && typeof song.artist === "string" && typeof song.sourceUrl === "string" && Array.isArray(song.lines) && song.lines.every(isSongLine) && typeof song.addedAt === "number" && typeof song.note === "string";
}

export function parseSongLibrary(raw: string | null): SavedSong[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isSavedSong) : [];
  } catch {
    return [];
  }
}

export function sortSongsByAddedAt(songs: SavedSong[]): SavedSong[] {
  return [...songs].sort((a, b) => b.addedAt - a.addedAt);
}

export function makeSavedSong(input: Omit<SavedSong, "id" | "addedAt" | "note"> & { id?: string; addedAt?: number; note?: string }): SavedSong {
  return {
    ...input,
    id: input.id ?? `song-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    addedAt: input.addedAt ?? Date.now(),
    note: input.note ?? "",
    lines: input.lines.map((line) => ({ ...line })),
  };
}

export function readSongLibrary(storage: Pick<Storage, "getItem">): SavedSong[] {
  return sortSongsByAddedAt(parseSongLibrary(storage.getItem(SONG_LIBRARY_STORAGE_KEY)));
}

export function writeSongLibrary(storage: Pick<Storage, "setItem">, songs: SavedSong[]): SavedSong[] {
  const sorted = sortSongsByAddedAt(songs);
  storage.setItem(SONG_LIBRARY_STORAGE_KEY, JSON.stringify(sorted));
  return sorted;
}

export function upsertSong(storage: Pick<Storage, "getItem" | "setItem">, song: SavedSong): SavedSong[] {
  const current = readSongLibrary(storage).filter((savedSong) => savedSong.id !== song.id && savedSong.sourceUrl !== song.sourceUrl);
  return writeSongLibrary(storage, [song, ...current]);
}

export function updateSongNote(storage: Pick<Storage, "getItem" | "setItem">, id: string, note: string): SavedSong[] {
  const next = readSongLibrary(storage).map((song) => (song.id === id ? { ...song, note } : song));
  return writeSongLibrary(storage, next);
}

export function removeSong(storage: Pick<Storage, "getItem" | "setItem">, id: string): SavedSong[] {
  return writeSongLibrary(storage, readSongLibrary(storage).filter((song) => song.id !== id));
}

export type SongImportPayload = {
  type: "chordshift-import-v1";
  song: {
    title: string;
    artist: string;
    sourceUrl: string;
    lines: SongLine[];
  };
};

export function parseSongImport(raw: string): SongImportPayload | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const payload = parsed as Partial<SongImportPayload>;
    if (payload.type !== "chordshift-import-v1" || !payload.song || typeof payload.song !== "object") return null;
    const song = payload.song as Partial<SongImportPayload["song"]>;
    const url = new URL(song.sourceUrl ?? "");
    const tab4uHost = url.hostname === "tab4u.com" || url.hostname === "www.tab4u.com" || url.hostname === "m.tab4u.com" || url.hostname === "en.tab4u.com";
    if (!tab4uHost || !url.pathname.startsWith("/tabs/songs/") || typeof song.title !== "string" || typeof song.artist !== "string" || !Array.isArray(song.lines) || !song.lines.every(isSongLine)) return null;
    return { type: "chordshift-import-v1", song: { title: song.title, artist: song.artist, sourceUrl: url.toString(), lines: song.lines.map((line) => ({ ...line })) } };
  } catch {
    return null;
  }
}
