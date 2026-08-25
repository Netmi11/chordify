import { describe, expect, it } from "vitest";
import type { LibrarySyncSnapshot } from "@shared/librarySync";
import { makeSavedSong, removeSong } from "./songLibraryV2";
import { applyLibrarySyncSnapshot, filterLocallyDeletedSongs, initializeLibrarySyncState, queueSongDelete, queueSongUpsert } from "./librarySyncState";

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const song = makeSavedSong({ id: "song-1", title: "שיר", artist: "אמן", sourceUrl: "https://www.tab4u.com/tabs/songs/1", lines: [] });

function snapshot(overrides: Partial<LibrarySyncSnapshot> = {}): LibrarySyncSnapshot {
  return { revision: 1, songs: [song], deletedSourceUrls: [], completedOperationIds: [], rejectedOperationIds: [], ...overrides };
}

describe("offline library sync state", () => {
  it("keeps an offline deletion over a stale cloud snapshot", () => {
    const storage = new MemoryStorage();
    initializeLibrarySyncState(storage, "library", [song]);
    applyLibrarySyncSnapshot(storage, "library", snapshot());

    queueSongDelete(storage, "library", song);
    removeSong(storage, song.id);
    const result = applyLibrarySyncSnapshot(storage, "library", snapshot({ revision: 1 }));

    expect(result.songs).toEqual([]);
    expect(result.state.pending[0]).toMatchObject({ kind: "delete", sourceUrl: song.sourceUrl, baseRevision: 1 });
    expect(result.state.deletedSourceUrls).toContain(song.sourceUrl);
  });

  it("removes acknowledged operations and keeps the server tombstone", () => {
    const storage = new MemoryStorage();
    initializeLibrarySyncState(storage, "library", []);
    const state = queueSongDelete(storage, "library", song);
    const operationId = state.pending[0]!.operationId;
    const result = applyLibrarySyncSnapshot(storage, "library", snapshot({ revision: 2, songs: [], deletedSourceUrls: [song.sourceUrl], completedOperationIds: [operationId] }));

    expect(result.state.pending).toEqual([]);
    expect(result.songs).toEqual([]);
    expect(filterLocallyDeletedSongs([song], result.state)).toEqual([]);
  });

  it("allows an intentional re-add to clear the local tombstone", () => {
    const storage = new MemoryStorage();
    initializeLibrarySyncState(storage, "library", []);
    queueSongDelete(storage, "library", song);
    const state = queueSongUpsert(storage, "library", song);

    expect(state.deletedSourceUrls).toEqual([]);
    expect(state.pending).toHaveLength(1);
    expect(state.pending[0]).toMatchObject({ kind: "upsert", sourceUrl: song.sourceUrl });
  });
});
