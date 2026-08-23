import type { SavedSong } from "./songLibraryV2";

export type SyncMergeResult = {
  songs: SavedSong[];
  added: number;
  updated: number;
  preservedLocal: number;
};

/**
 * Merge a cloud catalog into the local library without losing local-only fields.
 * `sourceUrl` is the stable identity for imported Tab4U songs.
 * Local notes and local IDs always win; cloud content can refresh title, artist,
 * and song lines for an already-known source.
 */
export function mergeLibraryForSync(localSongs: SavedSong[], cloudSongs: SavedSong[]): SyncMergeResult {
  const localByUrl = new Map(localSongs.map((song) => [song.sourceUrl, song]));
  const cloudByUrl = new Map(cloudSongs.map((song) => [song.sourceUrl, song]));

  let added = 0;
  let updated = 0;
  let preservedLocal = 0;

  const merged = localSongs.map((local) => {
    const cloud = cloudByUrl.get(local.sourceUrl);
    if (!cloud) {
      preservedLocal += 1;
      return { ...local, lines: local.lines.map((line) => ({ ...line })) };
    }

    const changed =
      local.title !== cloud.title ||
      local.artist !== cloud.artist ||
      JSON.stringify(local.lines) !== JSON.stringify(cloud.lines);
    if (changed) updated += 1;

    return {
      ...cloud,
      id: local.id,
      addedAt: local.addedAt,
      note: local.note,
      lines: cloud.lines.map((line) => ({ ...line })),
    };
  });

  for (const cloud of cloudSongs) {
    if (localByUrl.has(cloud.sourceUrl)) continue;
    merged.push({ ...cloud, lines: cloud.lines.map((line) => ({ ...line })) });
    added += 1;
  }

  merged.sort((a, b) => b.addedAt - a.addedAt);
  return { songs: merged, added, updated, preservedLocal };
}
