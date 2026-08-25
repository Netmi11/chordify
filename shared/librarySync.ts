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

type SyncOperationBase = {
  operationId: string;
  deviceId: string;
  baseRevision: number;
  sourceUrl: string;
};

export type LibrarySyncOperation =
  | (SyncOperationBase & { kind: "upsert"; song: SyncedSong })
  | (SyncOperationBase & { kind: "delete"; clientSongId?: string });

export type LibrarySyncSnapshot = {
  revision: number;
  songs: SyncedSong[];
  deletedSourceUrls: string[];
  completedOperationIds: string[];
  rejectedOperationIds: string[];
};

/** A stale offline upsert must never override a deletion it has not observed. */
export function canApplyUpsert(baseRevision: number, tombstoneRevision: number | null): boolean {
  return tombstoneRevision === null || tombstoneRevision <= baseRevision;
}
