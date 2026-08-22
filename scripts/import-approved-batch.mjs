import { createRequire } from "node:module";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const valueAfter = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};
const project = resolve(valueAfter("--project") || process.cwd());
const manifestPath = resolve(project, valueAfter("--manifest") || "server/import-manifests/approved-batch.json");
const snapshotDir = resolve(project, valueAfter("--snapshot-dir") || "server/import-snapshots");
const libraryId = valueAfter("--library");
const commit = args.includes("--commit");
if (!libraryId) throw new Error("Usage: import-approved-batch.mjs --project <path> --manifest <file> --library <id> --snapshot-dir <dir> [--commit]");

const normalize = (value) => String(value || "")
  .replace(/&#39;|&#x27;/giu, "'")
  .replace(/&quot;|&#34;|&#x22;/giu, '"')
  .replace(/&amp;/giu, "&")
  .replace(/[׳'״"`.,:;!?()[\]{}|/\\–—-]/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .toLocaleLowerCase("he");

function clean(value) {
  return String(value || "")
    .replace(/&nbsp;|&#160;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/&quot;/giu, '"')
    .replace(/&#39;|&apos;/giu, "'")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">")
    .replace(/<br\s*\/?>(?=.)/giu, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\r/g, "")
    .trim();
}

function metadataFromHtml(html) {
  const match = html.match(/<meta\s+name=["']title["']\s+content=["']([^"']+)["'][^>]*>/iu);
  const content = clean(match?.[1] || "");
  const parsed = content.match(/^אקורדים\s+לשיר\s+(.+?)\s+-\s+(.+?)\s*\|\s*Tab4U$/u);
  return parsed ? { title: parsed[1].trim(), artist: parsed[2].trim() } : null;
}

function parseRows(fragment) {
  const rows = fragment.match(/<tr[\s\S]*?<\/tr>/giu) || [];
  return rows.flatMap((row) => {
    const cells = row.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/giu) || [];
    if (cells.length === 1) {
      const cell = cells[0];
      const text = clean(cell);
      if (!text) return [{ chord: "", lyric: "" }];
      const section = /class=["'][^"']*(?:titLine|section)[^"']*["']/iu.test(cell) || (text.endsWith(":") && !/^[A-G](?:#|b)?[a-z0-9+\-/]*$/iu.test(text));
      const tab = /class=["'][^"']*tabs?[^"']*["']/iu.test(cell);
      if (tab) return [{ chord: "", lyric: "", tab: text }];
      if (section) return [{ label: text.replace(/:$/, ""), chord: "", lyric: "" }];
      const chord = /class=["'][^"']*(?:chords?|c_C)[^"']*["']/iu.test(cell) ? text : "";
      return [{ chord, lyric: chord ? "" : text }];
    }
    if (cells.length < 2) return [];
    const first = clean(cells[0]);
    const second = clean(cells[1]);
    const section = first.endsWith(":") && !/^[A-G](?:#|b)?[a-z0-9+\-/]*$/iu.test(first);
    return [{ label: section ? first.replace(/:$/, "") : undefined, chord: section ? second : first, lyric: section ? "" : second }];
  });
}

function parseSnapshot(html, sourceUrl) {
  const match = html.match(/<div[^>]+id=["']songContentTPL["'][^>]*>([\s\S]*?)<\/div>/iu);
  if (!match) throw new Error("לא נמצא אזור songContentTPL");
  const metadata = metadataFromHtml(html);
  if (!metadata) throw new Error("לא נמצאה מטא־דאטה תקינה");
  const lines = parseRows(match[1]);
  const meaningful = lines.filter((line) => line.chord.trim() || line.lyric.trim() || line.tab?.trim());
  if (!meaningful.length) throw new Error("לא נמצא תוכן נגינה משמעותי");
  return { ...metadata, sourceUrl, lines };
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const songs = manifest.songs || [];
if (!songs.length || songs.length > 10) throw new Error("Manifest חייב להכיל בין 1 ל־10 שירים");
const files = await readdir(snapshotDir);
const requireFromProject = createRequire(resolve(project, "package.json"));
const mysql = requireFromProject("mysql2/promise");
const db = await mysql.createConnection(process.env.DATABASE_URL);
const [existingRows] = await db.query("SELECT clientSongId, sourceUrl FROM chordshift_songs WHERE libraryId = ?", [libraryId]);
const existingUrls = new Set(existingRows.map((row) => new URL(row.sourceUrl).toString()));
const existingIds = new Set(existingRows.map((row) => row.clientSongId));
const seenUrls = new Set();
const seenIds = new Set();
const parsedSongs = [];
const duplicates = [];

for (const requested of songs) {
  const sourceUrl = new URL(requested.sourceUrl).toString();
  const tab4uId = sourceUrl.match(/\/songs\/(\d+)_/u)?.[1];
  if (!tab4uId) throw new Error(`URL לא חוקי: ${sourceUrl}`);
  const clientSongId = `tab4u-${tab4uId}`;
  if (existingUrls.has(sourceUrl) || existingIds.has(clientSongId) || seenUrls.has(sourceUrl) || seenIds.has(clientSongId)) {
    duplicates.push({ title: requested.title, sourceUrl, clientSongId });
    continue;
  }
  const snapshotName = files.find((file) => new RegExp(`(?:^|\\D)${tab4uId}(?:\\D|$)`).test(file));
  if (!snapshotName) throw new Error(`לא נמצא snapshot עבור Tab4U ${tab4uId}`);
  const html = await readFile(resolve(snapshotDir, snapshotName), "utf8");
  const parsed = parseSnapshot(html, sourceUrl);
  if (normalize(parsed.title) !== normalize(requested.title) || normalize(parsed.artist) !== normalize(requested.artist)) {
    throw new Error(`מטא־דאטה לא תואמת עבור ${sourceUrl}: ${parsed.title} / ${parsed.artist}`);
  }
  seenUrls.add(sourceUrl);
  seenIds.add(clientSongId);
  parsedSongs.push({ id: clientSongId, title: parsed.title, artist: parsed.artist, sourceUrl, note: "", addedAt: Date.now(), lines: parsed.lines });
}

const result = { mode: commit ? "commit" : "dry-run", requested: songs.length, readyToAdd: parsedSongs.length, duplicates, songs: parsedSongs.map((song) => ({ id: song.id, title: song.title, artist: song.artist, sourceUrl: song.sourceUrl, lineCount: song.lines.filter((line) => line.chord || line.lyric || line.tab).length })) };
if (commit && parsedSongs.length) {
  await db.beginTransaction();
  try {
    for (const song of parsedSongs) {
      const [inserted] = await db.execute("INSERT INTO chordshift_songs (libraryId, clientSongId, title, artist, sourceUrl, note, addedAt) VALUES (?, ?, ?, ?, ?, ?, ?)", [libraryId, song.id, song.title, song.artist, song.sourceUrl, song.note, song.addedAt]);
      const songId = inserted.insertId;
      const lines = song.lines.map((line, position) => [songId, position, line.label || null, line.chord || "", line.lyric || "", line.tab || null]);
      if (lines.length) await db.query("INSERT INTO chordshift_song_lines (songId, position, label, chord, lyric, tab) VALUES ?", [lines]);
    }
    await db.commit();
  } catch (error) {
    await db.rollback();
    throw error;
  }
}
await db.end();
console.log(JSON.stringify(result, null, 2));
