import type { LibrarySyncOperation, LibrarySyncSnapshot, SyncedSong } from "@shared/librarySync";
import { sortSongsByAddedAt, type SavedSong } from "./songLibraryV2";

const SYNC_STATE_PREFIX = "chordshift-library-sync-v2:";

export type LocalLibrarySyncState = {
  version: 2;
  deviceId: string;
  lastRevision: number;
  pending: LibrarySyncOperation[];
  deletedSourceUrls: string[];
};

type SyncStorage = Pick<Storage, "getItem" | "setItem">;

function stateKey(libraryId: string) {
  return `${SYNC_STATE_PREFIX}${libraryId}`;
}

function createId(prefix: string) {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid ? `${prefix}-${uuid}` : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isOperation(value: unknown): value is LibrarySyncOperation {
  if (!value || typeof value !== "object") return false;
  const operation = value as Partial<LibrarySyncOperation>;
  return typeof operation.operationId === "string"
    && typeof operation.deviceId === "string"
    && typeof operation.baseRevision === "number"
    && typeof operation.sourceUrl === "string"
    && (operation.kind === "delete" || (operation.kind === "upsert" && Boolean(operation.song)));
}

export function readLibrarySyncState(storage: SyncStorage, libraryId: string): LocalLibrarySyncState | null {
  try {
    const parsed = JSON.parse(storage.getItem(stateKey(libraryId)) ?? "null") as Partial<LocalLibrarySyncState> | null;
    if (!parsed || parsed.version !== 2 || typeof parsed.deviceId !== "string" || typeof parsed.lastRevision !== "number" || !Array.isArray(parsed.pending) || !parsed.pending.every(isOperation) || !Array.isArray(parsed.deletedSourceUrls)) return null;
    return {
      version: 2,
      deviceId: parsed.deviceId,
      lastRevision: parsed.lastRevision,
      pending: parsed.pending,
      deletedSourceUrls: parsed.deletedSourceUrls.filter((url): url is string => typeof url === "string"),
    };
  } catch {
    return null;
  }
}

function writeState(storage: SyncStorage, libraryId: string, state: LocalLibrarySyncState) {
  storage.setItem(stateKey(libraryId), JSON.stringify(state));
  return state;
}

function makeUpsert(state: LocalLibrarySyncState, song: SavedSong): LibrarySyncOperation {
  return {
    kind: "upsert",
    operationId: createId("op"),
    deviceId: state.deviceId,
    baseRevision: state.lastRevision,
    sourceUrl: song.sourceUrl,
    song,
  };
}

/**
 * Starts the operation-based protocol without guessing historical changes.
 * Existing pre-v2 songs are reconciled with the first cloud snapshot; only
 * mutations made after this point are queued explicitly.
 */
export function initializeLibrarySyncState(storage: SyncStorage, libraryId: string, _songs: SavedSong[]): LocalLibrarySyncState {
  const existing = readLibrarySyncState(storage, libraryId);
  if (existing) return existing;
  const initial: LocalLibrarySyncState = {
    version: 2,
    deviceId: createId("device"),
    lastRevision: 0,
    pending: [],
    deletedSourceUrls: [],
  };
  return writeState(storage, libraryId, initial);
}

export function queueSongUpsert(storage: SyncStorage, libraryId: string, song: SavedSong): LocalLibrarySyncState {
  const state = readLibrarySyncState(storage, libraryId) ?? initializeLibrarySyncState(storage, libraryId, []);
  const pending = state.pending.filter((operation) => operation.sourceUrl !== song.sourceUrl);
  const next = {
    ...state,
    pending: [...pending, makeUpsert(state, song)],
    deletedSourceUrls: state.deletedSourceUrls.filter((url) => url !== song.sourceUrl),
  };
  return writeState(storage, libraryId, next);
}

export function queueSongDelete(storage: SyncStorage, libraryId: string, song: SavedSong): LocalLibrarySyncState {
  const state = readLibrarySyncState(storage, libraryId) ?? initializeLibrarySyncState(storage, libraryId, []);
  const operation: LibrarySyncOperation = {
    kind: "delete",
    operationId: createId("op"),
    deviceId: state.deviceId,
    baseRevision: state.lastRevision,
    sourceUrl: song.sourceUrl,
    clientSongId: song.id,
  };
  const next = {
    ...state,
    pending: [...state.pending.filter((item) => item.sourceUrl !== song.sourceUrl), operation],
    deletedSourceUrls: Array.from(new Set([...state.deletedSourceUrls, song.sourceUrl])),
  };
  return writeState(storage, libraryId, next);
}

export function filterLocallyDeletedSongs<T extends { sourceUrl: string }>(songs: T[], state: LocalLibrarySyncState | null): T[] {
  if (!state?.deletedSourceUrls.length) return songs;
  const deleted = new Set(state.deletedSourceUrls);
  return songs.filter((song) => !deleted.has(song.sourceUrl));
}

/**
 * Commits a server acknowledgement while preserving operations that were
 * created during the request. Those operations are replayed over the returned
 * snapshot so the UI never flashes stale cloud state.
 */
export function applyLibrarySyncSnapshot(
  storage: SyncStorage,
  libraryId: string,
  snapshot: LibrarySyncSnapshot,
): { state: LocalLibrarySyncState; songs: SavedSong[] } {
  const current = readLibrarySyncState(storage, libraryId) ?? initializeLibrarySyncState(storage, libraryId, []);
  const completed = new Set(snapshot.completedOperationIds);
  const pending = current.pending.filter((operation) => !completed.has(operation.operationId));
  const deleted = new Set(snapshot.deletedSourceUrls);
  const songsByUrl = new Map(snapshot.songs.map((song) => [song.sourceUrl, song as SavedSong]));

  for (const operation of pending) {
    if (operation.kind === "delete") {
      songsByUrl.delete(operation.sourceUrl);
      deleted.add(operation.sourceUrl);
    } else {
      songsByUrl.set(operation.sourceUrl, operation.song as SavedSong);
      deleted.delete(operation.sourceUrl);
    }
  }

  const state = writeState(storage, libraryId, {
    ...current,
    lastRevision: Math.max(current.lastRevision, snapshot.revision),
    pending,
    deletedSourceUrls: Array.from(deleted),
  });
  return { state, songs: sortSongsByAddedAt(Array.from(songsByUrl.values())) };
}

export function adoptLibrarySyncSnapshot(storage: SyncStorage, libraryId: string, snapshot: LibrarySyncSnapshot): LocalLibrarySyncState {
  const current = readLibrarySyncState(storage, libraryId);
  return writeState(storage, libraryId, {
    version: 2,
    deviceId: current?.deviceId ?? createId("device"),
    lastRevision: snapshot.revision,
    pending: [],
    deletedSourceUrls: [...snapshot.deletedSourceUrls],
  });
}

export function toSyncedSongs(songs: SavedSong[]): SyncedSong[] {
  return songs.map((song) => ({ ...song, lines: song.lines.map((line) => ({ ...line })) }));
}
