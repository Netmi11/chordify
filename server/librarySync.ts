import { and, eq, inArray } from "drizzle-orm";
import { createHash, timingSafeEqual } from "node:crypto";
import { canApplyUpsert, type LibrarySyncOperation, type LibrarySyncSnapshot, type SyncedSong, type SyncedSongLine } from "../shared/librarySync";
import { chordshiftLibraries, chordshiftSongLines, chordshiftSongs, chordshiftSongTombstones, chordshiftSyncOperations } from "../drizzle/schema";
import { getDb } from "./db";

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
    await db.insert(chordshiftLibraries).values({ id: libraryId, secretHash: hashSecret(secret) }).onConflictDoNothing();
    const created = await db.select().from(chordshiftLibraries).where(eq(chordshiftLibraries.id, libraryId)).limit(1);
    if (!created[0] || !secretsMatch(created[0].secretHash, secret)) throw new Error("INVALID_LIBRARY_KEY");
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
    // Stay below PostgreSQL's parameter limit for large phone libraries.
    for (let offset = 0; offset < lines.length; offset += 5_000) {
      await tx.insert(chordshiftSongLines).values(lines.slice(offset, offset + 5_000));
    }
    await tx.update(chordshiftLibraries).set({ updatedAt: new Date() }).where(eq(chordshiftLibraries.id, libraryId));
  });
  return { saved: songs.length };
}

export const IMPORTED_LIBRARY_ID = "2c41a12f-5f5a-4bd1-9f99-460299979c3d";

export async function loadLibrarySnapshot(libraryId: string, secret: string): Promise<LibrarySyncSnapshot> {
  const db = await assertLibrary(libraryId, secret, false);
  const library = await db.select({ revision: chordshiftLibraries.revision }).from(chordshiftLibraries).where(eq(chordshiftLibraries.id, libraryId)).limit(1);
  const songs = await db.select().from(chordshiftSongs).where(eq(chordshiftSongs.libraryId, libraryId));
  const lines = songs.length
    ? await db.select().from(chordshiftSongLines).where(inArray(chordshiftSongLines.songId, songs.map((song) => song.id)))
    : [];
  const tombstones = await db.select({ sourceUrl: chordshiftSongTombstones.sourceUrl }).from(chordshiftSongTombstones).where(eq(chordshiftSongTombstones.libraryId, libraryId));
  const linesBySong = new Map<number, SyncedSongLine[]>();
  lines.sort((a, b) => a.position - b.position).forEach((line) => {
    const current = linesBySong.get(line.songId) ?? [];
    current.push({ chord: line.chord, lyric: line.lyric, ...(line.label ? { label: line.label } : {}), ...(line.tab ? { tab: line.tab } : {}) });
    linesBySong.set(line.songId, current);
  });
  return {
    revision: Number(library[0]?.revision ?? 0),
    songs: songs.map((song) => ({
      id: song.clientSongId,
      title: song.title,
      artist: song.artist,
      sourceUrl: song.sourceUrl,
      note: song.note,
      addedAt: Number(song.addedAt),
      lines: linesBySong.get(song.id) ?? [],
    })),
    deletedSourceUrls: tombstones.map((tombstone) => tombstone.sourceUrl),
    completedOperationIds: [],
    rejectedOperationIds: [],
  };
}

/**
 * Applies queued offline mutations before returning cloud state. The library
 * row is locked so every operation receives one monotonic server revision.
 */
export async function syncLibraryOperations(
  libraryId: string,
  secret: string,
  operations: LibrarySyncOperation[],
): Promise<LibrarySyncSnapshot> {
  const db = await assertLibrary(libraryId, secret, true);
  const completedOperationIds: string[] = [];
  const rejectedOperationIds: string[] = [];

  await db.transaction(async (tx) => {
    const locked = await tx.select({ revision: chordshiftLibraries.revision })
      .from(chordshiftLibraries)
      .where(eq(chordshiftLibraries.id, libraryId))
      .for("update");
    let revision = Number(locked[0]?.revision ?? 0);

    for (const operation of operations) {
      const prior = await tx.select({ outcome: chordshiftSyncOperations.outcome })
        .from(chordshiftSyncOperations)
        .where(and(eq(chordshiftSyncOperations.libraryId, libraryId), eq(chordshiftSyncOperations.operationId, operation.operationId)))
        .limit(1);
      if (prior[0]) {
        completedOperationIds.push(operation.operationId);
        if (prior[0].outcome === "rejected") rejectedOperationIds.push(operation.operationId);
        continue;
      }

      if (operation.kind === "upsert") {
        if (operation.song.sourceUrl !== operation.sourceUrl) throw new Error("INVALID_SYNC_OPERATION");
        const tombstone = await tx.select({ syncRevision: chordshiftSongTombstones.syncRevision })
          .from(chordshiftSongTombstones)
          .where(and(eq(chordshiftSongTombstones.libraryId, libraryId), eq(chordshiftSongTombstones.sourceUrl, operation.sourceUrl)))
          .limit(1);
        const tombstoneRevision = tombstone[0] ? Number(tombstone[0].syncRevision) : null;
        if (!canApplyUpsert(operation.baseRevision, tombstoneRevision)) {
          await tx.insert(chordshiftSyncOperations).values({
            libraryId,
            operationId: operation.operationId,
            deviceId: operation.deviceId,
            kind: operation.kind,
            sourceUrl: operation.sourceUrl,
            baseRevision: operation.baseRevision,
            serverRevision: revision,
            outcome: "rejected",
          });
          completedOperationIds.push(operation.operationId);
          rejectedOperationIds.push(operation.operationId);
          continue;
        }

        revision += 1;
        const now = new Date();
        const inserted = await tx.insert(chordshiftSongs).values({
          libraryId,
          clientSongId: operation.song.id,
          title: operation.song.title,
          artist: operation.song.artist,
          sourceUrl: operation.song.sourceUrl,
          note: operation.song.note,
          addedAt: operation.song.addedAt,
          syncRevision: revision,
          updatedAt: now,
        }).onConflictDoUpdate({
          target: [chordshiftSongs.libraryId, chordshiftSongs.sourceUrl],
          set: {
            clientSongId: operation.song.id,
            title: operation.song.title,
            artist: operation.song.artist,
            note: operation.song.note,
            addedAt: operation.song.addedAt,
            syncRevision: revision,
            updatedAt: now,
          },
        }).returning({ id: chordshiftSongs.id });
        const songId = inserted[0]!.id;
        await tx.delete(chordshiftSongLines).where(eq(chordshiftSongLines.songId, songId));
        if (operation.song.lines.length) {
          await tx.insert(chordshiftSongLines).values(operation.song.lines.map((line, position) => ({
            songId,
            position,
            label: line.label ?? null,
            chord: line.chord,
            lyric: line.lyric,
            tab: line.tab ?? null,
          })));
        }
        await tx.delete(chordshiftSongTombstones).where(and(eq(chordshiftSongTombstones.libraryId, libraryId), eq(chordshiftSongTombstones.sourceUrl, operation.sourceUrl)));
      } else {
        revision += 1;
        await tx.delete(chordshiftSongs).where(and(eq(chordshiftSongs.libraryId, libraryId), eq(chordshiftSongs.sourceUrl, operation.sourceUrl)));
        await tx.insert(chordshiftSongTombstones).values({
          libraryId,
          sourceUrl: operation.sourceUrl,
          clientSongId: operation.clientSongId ?? null,
          syncRevision: revision,
          deletedAt: new Date(),
        }).onConflictDoUpdate({
          target: [chordshiftSongTombstones.libraryId, chordshiftSongTombstones.sourceUrl],
          set: {
            clientSongId: operation.clientSongId ?? null,
            syncRevision: revision,
            deletedAt: new Date(),
          },
        });
      }

      await tx.update(chordshiftLibraries).set({ revision, updatedAt: new Date() }).where(eq(chordshiftLibraries.id, libraryId));
      await tx.insert(chordshiftSyncOperations).values({
        libraryId,
        operationId: operation.operationId,
        deviceId: operation.deviceId,
        kind: operation.kind,
        sourceUrl: operation.sourceUrl,
        baseRevision: operation.baseRevision,
        serverRevision: revision,
        outcome: "applied",
      });
      completedOperationIds.push(operation.operationId);
    }
  });

  const snapshot = await loadLibrarySnapshot(libraryId, secret);
  return { ...snapshot, completedOperationIds, rejectedOperationIds };
}

/**
 * The curated import library is intentionally readable through an explicit
 * sync action. The library id stays server-side; the browser receives songs,
 * never the database secret used by the import runner.
 */
export async function loadImportedLibraryCatalog(): Promise<SyncedSong[]> {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const songs = await db.select().from(chordshiftSongs).where(eq(chordshiftSongs.libraryId, IMPORTED_LIBRARY_ID));
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
