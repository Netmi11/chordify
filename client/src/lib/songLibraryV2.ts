import { inferSongCategories, normalizeSongCategories, type SongCategory } from "@shared/songCategories";

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
  categories?: SongCategory[];
};

export const SONG_LIBRARY_STORAGE_KEY = "chordshift-song-library-v1";
export type LibrarySort = "addedAt" | "artist" | "title";

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

function decodeBasicEntities(value: string): string {
  return value.replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&amp;/gi, "&").replace(/&nbsp;/gi, " ");
}

function cleanText(value: string): string {
  return decodeBasicEntities(value.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function extractMetaTitle(value: string): string | null {
  const match = value.match(/<meta\b[^>]*\bcontent\s*=\s*["']([^"']+)["'][^>]*>/i);
  return match?.[1] ? cleanText(match[1]) : null;
}

function cleanMetadataField(value: string): string {
  const meta = extractMetaTitle(value);
  if (meta) return meta;
  const beforeMarkup = value.split(/<meta\b/i)[0];
  const beforePipe = beforeMarkup.split("|")[0];
  return cleanText(beforePipe || value);
}

export function normalizeSongMetadata(rawTitle: string, rawArtist: string): { title: string; artist: string } {
  let artist = cleanMetadataField(rawArtist);
  let title = cleanMetadataField(rawTitle);

  // Some Tab4U mobile DOM variants prepend unrelated text before the meta tag;
  // when a meta title exists, its content is the authoritative value.

  title = title.replace(/^אקורדים\s+לשיר\s*/i, "").trim();
  if (artist && artist !== "Tab4U") {
    const suffix = new RegExp(`\\s+של\\s+${artist.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\s*$`);
    title = title.replace(suffix, "").trim();
  }
  return { title: title || "שיר", artist: artist || "Tab4U" };
}

function normalizeSavedSong(song: SavedSong): SavedSong {
  const metadata = normalizeSongMetadata(song.title, song.artist);
  return {
    ...song,
    ...metadata,
    categories: inferSongCategories(metadata.title, metadata.artist, normalizeSongCategories(song.categories)),
    lines: song.lines.map((line) => ({ ...line })),
  };
}

export function parseSongLibrary(raw: string | null): SavedSong[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isSavedSong).map(normalizeSavedSong) : [];
  } catch {
    return [];
  }
}

export function sortSongsByAddedAt(songs: SavedSong[]): SavedSong[] {
  return [...songs].sort((a, b) => b.addedAt - a.addedAt);
}

export function sortSongsForLibrary(songs: SavedSong[], sortBy: LibrarySort): SavedSong[] {
  const collator = new Intl.Collator("he", { sensitivity: "base", numeric: true });
  return [...songs].sort((a, b) => sortBy === "addedAt" ? b.addedAt - a.addedAt : sortBy === "artist" ? collator.compare(a.artist, b.artist) || collator.compare(a.title, b.title) : collator.compare(a.title, b.title) || collator.compare(a.artist, b.artist));
}

export function makeSavedSong(input: Omit<SavedSong, "id" | "addedAt" | "note"> & { id?: string; addedAt?: number; note?: string }): SavedSong {
  const metadata = normalizeSongMetadata(input.title, input.artist);
  return {
    ...input,
    ...metadata,
    id: input.id ?? `song-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    addedAt: input.addedAt ?? Date.now(),
    note: input.note ?? "",
    categories: inferSongCategories(metadata.title, metadata.artist, input.categories),
    lines: input.lines.map((line) => ({ ...line })),
  };
}

export function readSongLibrary(storage: Pick<Storage, "getItem" | "setItem">): SavedSong[] {
  const songs = sortSongsByAddedAt(parseSongLibrary(storage.getItem(SONG_LIBRARY_STORAGE_KEY)));
  // Persist the cleaned metadata so an already-saved song is fixed permanently.
  const raw = JSON.stringify(songs);
  if (storage.getItem(SONG_LIBRARY_STORAGE_KEY) !== raw) storage.setItem(SONG_LIBRARY_STORAGE_KEY, raw);
  return songs;
}

export function serializeSongLibrary(songs: SavedSong[]): string {
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), songs }, null, 2);
}

export function parseSongLibraryBackup(raw: string): SavedSong[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    const candidate = Array.isArray(parsed) ? parsed : parsed && typeof parsed === "object" && "songs" in parsed ? (parsed as { songs?: unknown }).songs : null;
    return Array.isArray(candidate) ? candidate.filter(isSavedSong).map(normalizeSavedSong) : [];
  } catch {
    return [];
  }
}

export function writeSongLibrary(storage: Pick<Storage, "setItem">, songs: SavedSong[]): SavedSong[] {
  const sorted = sortSongsByAddedAt(songs.map(normalizeSavedSong));
  storage.setItem(SONG_LIBRARY_STORAGE_KEY, JSON.stringify(sorted));
  return sorted;
}

export function mergeCloudSongs(localSongs: SavedSong[], cloudSongs: SavedSong[]): SavedSong[] {
  const localUrls = new Set(localSongs.map((song) => song.sourceUrl));
  return sortSongsByAddedAt([...localSongs, ...cloudSongs.filter((song) => !localUrls.has(song.sourceUrl))]);
}

export function upsertSong(storage: Pick<Storage, "getItem" | "setItem">, song: SavedSong): SavedSong[] {
  const current = readSongLibrary(storage).filter((savedSong) => savedSong.id !== song.id && savedSong.sourceUrl !== song.sourceUrl);
  return writeSongLibrary(storage, [song, ...current]);
}

export function updateSongNote(storage: Pick<Storage, "getItem" | "setItem">, id: string, note: string): SavedSong[] {
  const next = readSongLibrary(storage).map((song) => (song.id === id ? { ...song, note } : song));
  return writeSongLibrary(storage, next);
}

export function updateSongCategories(storage: Pick<Storage, "getItem" | "setItem">, id: string, categories: readonly string[]): SavedSong[] {
  const selected = normalizeSongCategories(categories);
  if (!selected.length) throw new Error("SONG_CATEGORY_REQUIRED");
  const next = readSongLibrary(storage).map((song) => (song.id === id ? { ...song, categories: selected } : song));
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
    categories?: SongCategory[];
    lines: SongLine[];
  };
};

export type SongBatchImportPayload = {
  type: "chordshift-import-batch-v1";
  songs: SongImportPayload["song"][];
};

function parseImportedSong(value: unknown): SongImportPayload["song"] | null {
  if (!value || typeof value !== "object") return null;
  const song = value as Partial<SongImportPayload["song"]>;
  const url = new URL(song.sourceUrl ?? "");
  const tab4uHost = url.hostname === "tab4u.com" || url.hostname === "www.tab4u.com" || url.hostname === "m.tab4u.com" || url.hostname === "en.tab4u.com";
  if (!tab4uHost || !url.pathname.startsWith("/tabs/songs/") || typeof song.title !== "string" || typeof song.artist !== "string" || !Array.isArray(song.lines) || !song.lines.every(isSongLine)) return null;
  const metadata = normalizeSongMetadata(song.title, song.artist);
  return { ...metadata, sourceUrl: url.toString(), categories: inferSongCategories(metadata.title, metadata.artist, song.categories), lines: song.lines.map((line) => ({ ...line })) };
}

export function parseSongImport(raw: string): SongImportPayload | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const payload = parsed as Partial<SongImportPayload>;
    if (payload.type !== "chordshift-import-v1" || !payload.song || typeof payload.song !== "object") return null;
    const song = parseImportedSong(payload.song);
    return song ? { type: "chordshift-import-v1", song } : null;
  } catch {
    return null;
  }
}

export function parseSongBatchImport(raw: string): SongBatchImportPayload | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const payload = parsed as Partial<SongBatchImportPayload>;
    if (payload.type !== "chordshift-import-batch-v1" || !Array.isArray(payload.songs) || payload.songs.length < 1 || payload.songs.length > 10) return null;
    const songs = payload.songs.map(parseImportedSong);
    if (songs.some((song) => !song)) return null;
    const unique = new Set(songs.map((song) => song!.sourceUrl));
    return unique.size === songs.length ? { type: "chordshift-import-batch-v1", songs: songs as SongImportPayload["song"][] } : null;
  } catch {
    return null;
  }
}
