import { createHash, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import postgres from "postgres";

const args = process.argv.slice(2);
const valueAfter = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};

const inputPath = resolve(valueAfter("--file") || "");
const libraryId = valueAfter("--library") || "2c41a12f-5f5a-4bd1-9f99-460299979c3d";
const expectedCount = Number(valueAfter("--expect") || 313);
if (!valueAfter("--file")) {
  throw new Error("Usage: import-chordshift-library.mjs --file <backup.json> [--library <uuid>] [--expect 313]");
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const parsed = JSON.parse(await readFile(inputPath, "utf8"));
if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.songs)) {
  throw new Error("Expected a ChordShift version 1 backup with a songs array");
}

function validateSong(song, index) {
  const prefix = `songs[${index}]`;
  if (!song || typeof song !== "object") throw new Error(`${prefix} must be an object`);
  for (const key of ["id", "title", "artist", "sourceUrl", "note"]) {
    if (typeof song[key] !== "string") throw new Error(`${prefix}.${key} must be a string`);
  }
  if (!song.id || !song.title || !song.artist) throw new Error(`${prefix} has blank required metadata`);
  const url = new URL(song.sourceUrl);
  if (url.protocol !== "https:" || !["tab4u.com", "www.tab4u.com", "m.tab4u.com", "en.tab4u.com"].includes(url.hostname)) {
    throw new Error(`${prefix}.sourceUrl is not an approved Tab4U URL`);
  }
  if (!Number.isSafeInteger(song.addedAt) || song.addedAt < 0) throw new Error(`${prefix}.addedAt must be a non-negative safe integer`);
  if (!Array.isArray(song.lines) || !song.lines.length) throw new Error(`${prefix}.lines must be a non-empty array`);
  song.lines.forEach((line, lineIndex) => {
    if (!line || typeof line !== "object" || typeof line.chord !== "string" || typeof line.lyric !== "string") {
      throw new Error(`${prefix}.lines[${lineIndex}] must contain string chord and lyric fields`);
    }
    if (line.label !== undefined && typeof line.label !== "string") throw new Error(`${prefix}.lines[${lineIndex}].label must be a string`);
    if (line.tab !== undefined && typeof line.tab !== "string") throw new Error(`${prefix}.lines[${lineIndex}].tab must be a string`);
  });
  return { ...song, sourceUrl: url.toString() };
}

// Prefer the newest record whenever either the client id or canonical source
// URL is duplicated. This resolves the known tab4u-890 duplicate safely.
const candidates = parsed.songs.map(validateSong).sort((a, b) => b.addedAt - a.addedAt);
const seenIds = new Set();
const seenUrls = new Set();
const songs = [];
const removed = [];
for (const song of candidates) {
  if (seenIds.has(song.id) || seenUrls.has(song.sourceUrl)) {
    removed.push({ id: song.id, title: song.title, artist: song.artist, sourceUrl: song.sourceUrl });
    continue;
  }
  seenIds.add(song.id);
  seenUrls.add(song.sourceUrl);
  songs.push(song);
}
if (songs.length !== expectedCount) {
  throw new Error(`Expected ${expectedCount} unique songs after cleanup, found ${songs.length}`);
}

const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
try {
  await sql.begin(async (tx) => {
    const secretHash = createHash("sha256").update(randomBytes(32)).digest("hex");
    await tx`
      INSERT INTO chordshift_libraries (id, "secretHash")
      VALUES (${libraryId}, ${secretHash})
      ON CONFLICT (id) DO UPDATE SET "updatedAt" = now()
    `;
    await tx`DELETE FROM chordshift_songs WHERE "libraryId" = ${libraryId}`;

    for (let offset = 0; offset < songs.length; offset += 100) {
      const batch = songs.slice(offset, offset + 100).map((song) => ({
        libraryId,
        clientSongId: song.id,
        title: song.title,
        artist: song.artist,
        sourceUrl: song.sourceUrl,
        note: song.note,
        addedAt: song.addedAt,
      }));
      await tx`INSERT INTO chordshift_songs ${tx(batch, "libraryId", "clientSongId", "title", "artist", "sourceUrl", "note", "addedAt")}`;
    }

    const inserted = await tx`SELECT id, "clientSongId" FROM chordshift_songs WHERE "libraryId" = ${libraryId}`;
    const songIdByClientId = new Map(inserted.map((song) => [song.clientSongId, song.id]));
    const lines = songs.flatMap((song) => song.lines.map((line, position) => ({
      songId: songIdByClientId.get(song.id),
      position,
      label: line.label ?? null,
      chord: line.chord,
      lyric: line.lyric,
      tab: line.tab ?? null,
    })));
    if (lines.some((line) => !line.songId)) throw new Error("Could not map every song to its database id");
    for (let offset = 0; offset < lines.length; offset += 2_000) {
      await tx`INSERT INTO chordshift_song_lines ${tx(lines.slice(offset, offset + 2_000), "songId", "position", "label", "chord", "lyric", "tab")}`;
    }
  });

  const [{ songCount, lineCount }] = await sql`
    SELECT
      count(DISTINCT s.id)::int AS "songCount",
      count(l.id)::int AS "lineCount"
    FROM chordshift_songs s
    LEFT JOIN chordshift_song_lines l ON l."songId" = s.id
    WHERE s."libraryId" = ${libraryId}
  `;
  if (songCount !== expectedCount) throw new Error(`Import verification failed: expected ${expectedCount} songs, found ${songCount}`);
  console.log(JSON.stringify({ imported: songCount, lines: lineCount, duplicatesRemoved: removed }, null, 2));
} finally {
  await sql.end();
}
