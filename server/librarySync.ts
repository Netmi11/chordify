import { and, eq, inArray } from "drizzle-orm";
import { createHash, timingSafeEqual } from "node:crypto";
import { chordshiftLibraries, chordshiftSongLines, chordshiftSongs } from "../drizzle/schema";
import { getDb } from "./db";

export type SyncedSongLine = { label?: string; chord: string; lyric: string; tab?: string };
export type SyncedSong = {
  id: string;
  title: string;
  artist: string;
  sourceUrl: string;
  note: string;
  addedAt: number;
  lines: SyncedSongLine[];
};

function hashSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

function secretsMatch(storedHash: string, secret: string) {
  const expected = Buffer.from(storedHash, "hex");
  const received = Buffer.from(hashSecret(secret), "hex");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

async function assertLibrary(libraryId: string, secret: string, createIfMissing: boolean) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const found = await db.select().from(chordshiftLibraries).where(eq(chordshiftLibraries.id, libraryId)).limit(1);
  const library = found[0];
  if (!library && createIfMissing) {
    await db.insert(chordshiftLibraries).values({ id: libraryId, secretHash: hashSecret(secret) });
    return db;
  }
  if (!library || !secretsMatch(library.secretHash, secret)) throw new Error("INVALID_LIBRARY_KEY");
  return db;
}

export async function saveLibrarySnapshot(libraryId: string, secret: string, songs: SyncedSong[]) {
  const db = await assertLibrary(libraryId, secret, true);
  await db.transaction(async (tx) => {
    const existing = await tx.select({ id: chordshiftSongs.id }).from(chordshiftSongs).where(eq(chordshiftSongs.libraryId, libraryId));
    const songIds = existing.map((song) => song.id);
    if (songIds.length) await tx.delete(chordshiftSongLines).where(inArray(chordshiftSongLines.songId, songIds));
    await tx.delete(chordshiftSongs).where(eq(chordshiftSongs.libraryId, libraryId));
    if (!songs.length) return;

    await tx.insert(chordshiftSongs).values(songs.map((song) => ({
      libraryId,
      clientSongId: song.id,
      title: song.title,
      artist: song.artist,
      sourceUrl: song.sourceUrl,
      note: song.note,
      addedAt: song.addedAt,
    })));
    const inserted = await tx.select({ id: chordshiftSongs.id, clientSongId: chordshiftSongs.clientSongId })
      .from(chordshiftSongs).where(eq(chordshiftSongs.libraryId, libraryId));
    const songIdByClientId = new Map(inserted.map((song) => [song.clientSongId, song.id]));
    const lines = songs.flatMap((song) => song.lines.map((line, position) => ({
      songId: songIdByClientId.get(song.id)!,
      position,
      label: line.label ?? null,
      chord: line.chord,
      lyric: line.lyric,
      tab: line.tab ?? null,
    })));
    if (lines.length) await tx.insert(chordshiftSongLines).values(lines);
  });
  return { saved: songs.length };
}

export async function loadLibrarySnapshot(libraryId: string, secret: string): Promise<SyncedSong[]> {
  const db = await assertLibrary(libraryId, secret, false);
  const songs = await db.select().from(chordshiftSongs).where(eq(chordshiftSongs.libraryId, libraryId));
  if (!songs.length) return [];
  const lines = await db.select().from(chordshiftSongLines).where(inArray(chordshiftSongLines.songId, songs.map((song) => song.id)));
  const linesBySong = new Map<number, SyncedSongLine[]>();
  lines.sort((a, b) => a.position - b.position).forEach((line) => {
    const current = linesBySong.get(line.songId) ?? [];
    current.push({ chord: line.chord, lyric: line.lyric, ...(line.label ? { label: line.label } : {}), ...(line.tab ? { tab: line.tab } : {}) });
    linesBySong.set(line.songId, current);
  });
  return songs.map((song) => ({
    id: song.clientSongId,
    title: song.title,
    artist: song.artist,
    sourceUrl: song.sourceUrl,
    note: song.note,
    addedAt: Number(song.addedAt),
    lines: linesBySong.get(song.id) ?? [],
  }));
}
