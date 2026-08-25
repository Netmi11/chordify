import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import postgres from "postgres";

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
const fetchLive = args.includes("--fetch-live");
const skipDb = args.includes("--skip-db");
const includeLines = args.includes("--include-lines");
if (commit && skipDb) throw new Error("אי אפשר לשלב --commit עם --skip-db");
if (!libraryId) throw new Error("Usage: import-approved-batch.mjs --project <path> --manifest <file> --library <id> --snapshot-dir <dir> [--commit]");
const allowedCategories = new Set(["שירי יום הזיכרון", "רוק ישראלי", "פופ ישראלי", "רוק לועזי", "פופ לועזי", "שירים שקטים"]);

const normalize = (value) => String(value || "")
  .replace(/&#39;|&#x27;/giu, "'")
  .replace(/&quot;|&#34;|&#x22;/giu, '"')
  .replace(/&amp;/giu, "&")
  .replace(/[׳']/g, "")
  .replace(/[״"`.,:;!?()[\]{}|/\\–—-]/g, " ")
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
  const tag = html.match(/<meta\b[^>]*\bname=["']title["'][^>]*>/iu)?.[0] || "";
  const content = tag.match(/\bcontent="([^"]*)"/iu)?.[1] || tag.match(/\bcontent='([^']*)'/iu)?.[1] || "";
  const value = clean(content);
  const hebrew = value.match(/^אקורדים\s+לשיר\s+(.+?)\s+-\s+(.+?)\s*\|\s*Tab4U$/u);
  if (hebrew) return { title: hebrew[1].trim(), artist: hebrew[2].trim() };
  const english = value.match(/^(.+?)\s+Chords\s+by\s+(.+?)\s*\|\s*Tab4U$/iu);
  return english ? { title: english[1].trim(), artist: english[2].trim() } : null;
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

function decodeCifraEntities(value) {
  return value
    .replace(/&#x27;|&#39;|&apos;/giu, "'")
    .replace(/&quot;/giu, '"')
    .replace(/&amp;/giu, "&")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">");
}

function parseCifraSnapshot(html, sourceUrl) {
  const pageTitle = decodeCifraEntities(html.match(/<title>([^<]+)<\/title>/iu)?.[1] || "");
  const metadata = pageTitle.match(/^(.+?)\s+-\s+(.+?)\s+-\s+Cifra Club$/iu);
  if (!metadata) throw new Error("לא נמצאה מטא־דאטה תקינה ב־Cifra Club");
  const pre = html.match(/<pre[^>]*data-chord-content[^>]*>([\s\S]*?)<\/pre>/iu)?.[1];
  if (!pre) throw new Error("לא נמצא תוכן אקורדים ב־Cifra Club");

  const rawLines = decodeCifraEntities(pre)
    .replace(/<b\b[^>]*>([\s\S]*?)<\/b>/giu, (_, chord) => `{{${clean(chord)}}}`)
    .replace(/<br\s*\/?\s*>/giu, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\r/g, "")
    .split("\n");
  const lines = [];
  let pendingChord = "";
  for (const rawLine of rawLines) {
    const section = rawLine.trim().match(/^\[([^\]]+)\]$/u);
    if (section) {
      if (pendingChord.trim()) lines.push({ chord: pendingChord.trimEnd(), lyric: "" });
      pendingChord = "";
      lines.push({ label: section[1], chord: "", lyric: "" });
      continue;
    }
    if (rawLine.includes("{{")) {
      if (pendingChord.trim()) lines.push({ chord: pendingChord.trimEnd(), lyric: "" });
      pendingChord = rawLine.replace(/\{\{([^}]+)\}\}/g, "$1").trimEnd();
      const inlineLyric = rawLine.replace(/\{\{[^}]+\}\}/g, "").trim();
      if (inlineLyric) {
        lines.push({ chord: pendingChord, lyric: inlineLyric });
        pendingChord = "";
      }
      continue;
    }
    const lyric = rawLine.trim();
    if (!lyric) continue;
    lines.push({ chord: pendingChord, lyric });
    pendingChord = "";
  }
  if (pendingChord.trim()) lines.push({ chord: pendingChord.trimEnd(), lyric: "" });
  if (!lines.some((line) => line.chord.trim() || line.lyric.trim())) throw new Error("לא נמצא תוכן נגינה משמעותי ב־Cifra Club");
  return { title: metadata[1].trim(), artist: metadata[2].trim(), sourceUrl, lines };
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const songs = manifest.songs || [];
if (!songs.length || songs.length > 10) throw new Error("Manifest חייב להכיל בין 1 ל־10 שירים");
const files = fetchLive ? [] : await readdir(snapshotDir);
if (!skipDb && !process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const db = skipDb ? null : postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
const existingRows = db ? await db`SELECT "clientSongId", "sourceUrl" FROM chordshift_songs WHERE "libraryId" = ${libraryId}` : [];
const existingUrls = new Set(existingRows.map((row) => new URL(row.sourceUrl).toString()));
const existingIds = new Set(existingRows.map((row) => row.clientSongId));
const seenUrls = new Set();
const seenIds = new Set();
const parsedSongs = [];
const duplicates = [];

for (const requested of songs) {
  const sourceUrl = new URL(requested.sourceUrl).toString();
  const source = new URL(sourceUrl);
  const tab4uId = sourceUrl.match(/\/songs\/(\d+)_/u)?.[1];
  const isTab4u = /(^|\.)tab4u\.com$/iu.test(source.hostname) && Boolean(tab4uId);
  const cifraSlug = source.hostname === "www.cifraclub.com" ? source.pathname.split("/").filter(Boolean).slice(0, 2).join("-") : "";
  if (!isTab4u && !cifraSlug) throw new Error(`URL לא חוקי: ${sourceUrl}`);
  const clientSongId = isTab4u ? `tab4u-${tab4uId}` : `cifraclub-${cifraSlug}`;
  if (existingUrls.has(sourceUrl) || existingIds.has(clientSongId) || seenUrls.has(sourceUrl) || seenIds.has(clientSongId)) {
    duplicates.push({ title: requested.title, sourceUrl, clientSongId });
    continue;
  }
  let html;
  if (fetchLive) {
    const response = await fetch(sourceUrl, { headers: { "user-agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126 Safari/537.36" } });
    if (!response.ok) throw new Error(`הורדת המקור נכשלה (${response.status}): ${sourceUrl}`);
    html = await response.text();
  } else {
    if (!isTab4u) throw new Error("מקור Cifra Club מחייב --fetch-live");
    const snapshotName = files.find((file) => new RegExp(`(?:^|\\D)${tab4uId}(?:\\D|$)`).test(file));
    if (!snapshotName) throw new Error(`לא נמצא snapshot עבור Tab4U ${tab4uId}`);
    html = await readFile(resolve(snapshotDir, snapshotName), "utf8");
  }
  const parsed = isTab4u ? parseSnapshot(html, sourceUrl) : parseCifraSnapshot(html, sourceUrl);
  if (normalize(parsed.title) !== normalize(requested.title) || normalize(parsed.artist) !== normalize(requested.artist)) {
    throw new Error(`מטא־דאטה לא תואמת עבור ${sourceUrl}: ${parsed.title} / ${parsed.artist}`);
  }
  const categories = Array.from(new Set(requested.categories || []));
  if (categories.some((category) => !allowedCategories.has(category))) throw new Error(`קטגוריה לא חוקית עבור ${sourceUrl}`);
  seenUrls.add(sourceUrl);
  seenIds.add(clientSongId);
  parsedSongs.push({ id: clientSongId, title: requested.title, artist: requested.artist, sourceUrl, note: "", addedAt: Date.now(), categories, lines: parsed.lines });
}

const result = { mode: commit ? "commit" : "dry-run", requested: songs.length, readyToAdd: parsedSongs.length, duplicates, songs: parsedSongs.map((song) => ({ id: song.id, title: song.title, artist: song.artist, sourceUrl: song.sourceUrl, note: song.note, addedAt: song.addedAt, categories: song.categories, lineCount: song.lines.filter((line) => line.chord || line.lyric || line.tab).length, ...(includeLines ? { lines: song.lines } : {}) })) };
if (commit && parsedSongs.length) {
  await db.begin(async (tx) => {
    for (const song of parsedSongs) {
      const [inserted] = await tx`
        INSERT INTO chordshift_songs ("libraryId", "clientSongId", title, artist, "sourceUrl", note, "addedAt", categories)
        VALUES (${libraryId}, ${song.id}, ${song.title}, ${song.artist}, ${song.sourceUrl}, ${song.note}, ${song.addedAt}, ${song.categories})
        RETURNING id
      `;
      const lines = song.lines.map((line, position) => ({ songId: inserted.id, position, label: line.label || null, chord: line.chord || "", lyric: line.lyric || "", tab: line.tab || null }));
      if (lines.length) await tx`INSERT INTO chordshift_song_lines ${tx(lines, "songId", "position", "label", "chord", "lyric", "tab")}`;
    }
  });
}
if (db) await db.end();
console.log(JSON.stringify(result, null, 2));
