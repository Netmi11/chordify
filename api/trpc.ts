import type { IncomingMessage, ServerResponse } from "node:http";
import { createHash, timingSafeEqual } from "node:crypto";
import { initTRPC } from "@trpc/server";
import { nodeHTTPRequestHandler } from "@trpc/server/adapters/node-http";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { bigint, index, integer, pgTable, serial, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import postgres from "postgres";
import superjson from "superjson";
import { z } from "zod";

const chordshiftLibraries = pgTable("chordshift_libraries", {
  id: varchar("id", { length: 64 }).primaryKey(),
  secretHash: varchar("secretHash", { length: 128 }).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

const chordshiftSongs = pgTable("chordshift_songs", {
  id: serial("id").primaryKey(),
  libraryId: varchar("libraryId", { length: 64 }).notNull().references(() => chordshiftLibraries.id, { onDelete: "cascade" }),
  clientSongId: varchar("clientSongId", { length: 120 }).notNull(),
  title: text("title").notNull(),
  artist: varchar("artist", { length: 512 }).notNull(),
  sourceUrl: varchar("sourceUrl", { length: 2048 }).notNull(),
  note: text("note").notNull(),
  addedAt: bigint("addedAt", { mode: "number" }).notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("chordshift_songs_library_client_unique").on(table.libraryId, table.clientSongId),
  uniqueIndex("chordshift_songs_library_source_unique").on(table.libraryId, table.sourceUrl),
  index("chordshift_songs_library_index").on(table.libraryId),
]);

const chordshiftSongLines = pgTable("chordshift_song_lines", {
  id: serial("id").primaryKey(),
  songId: integer("songId").notNull().references(() => chordshiftSongs.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  label: text("label"),
  chord: text("chord").notNull(),
  lyric: text("lyric").notNull(),
  tab: text("tab"),
}, (table) => [
  uniqueIndex("chordshift_song_lines_song_position_unique").on(table.songId, table.position),
  index("chordshift_song_lines_song_index").on(table.songId),
]);

type SyncedSongLine = { label?: string; chord: string; lyric: string; tab?: string };
type SyncedSong = {
  id: string;
  title: string;
  artist: string;
  sourceUrl: string;
  note: string;
  addedAt: number;
  lines: SyncedSongLine[];
};

let sqlClient: ReturnType<typeof postgres> | null = null;
let db: ReturnType<typeof drizzle> | null = null;
function getDb() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_UNAVAILABLE");
  if (!db) {
    sqlClient = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
    db = drizzle(sqlClient);
  }
  return db;
}

function hashSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

function secretsMatch(storedHash: string, secret: string) {
  const expected = Buffer.from(storedHash, "hex");
  const received = Buffer.from(hashSecret(secret), "hex");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

async function assertLibrary(libraryId: string, secret: string, createIfMissing: boolean) {
  const database = getDb();
  const found = await database.select().from(chordshiftLibraries).where(eq(chordshiftLibraries.id, libraryId)).limit(1);
  const library = found[0];
  if (!library && createIfMissing) {
    await database.insert(chordshiftLibraries).values({ id: libraryId, secretHash: hashSecret(secret) });
    return database;
  }
  if (!library || !secretsMatch(library.secretHash, secret)) throw new Error("INVALID_LIBRARY_KEY");
  return database;
}

async function saveLibrarySnapshot(libraryId: string, secret: string, songs: SyncedSong[]) {
  const database = await assertLibrary(libraryId, secret, true);
  await database.transaction(async (tx) => {
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
    // PostgreSQL has a 65,535-parameter limit. Chunk line inserts so a full
    // phone library can be pushed in one atomic snapshot.
    for (let offset = 0; offset < lines.length; offset += 5_000) {
      await tx.insert(chordshiftSongLines).values(lines.slice(offset, offset + 5_000));
    }
    await tx.update(chordshiftLibraries).set({ updatedAt: new Date() }).where(eq(chordshiftLibraries.id, libraryId));
  });
  return { saved: songs.length };
}

async function readSongs(libraryId: string): Promise<SyncedSong[]> {
  const database = getDb();
  const songs = await database.select().from(chordshiftSongs).where(eq(chordshiftSongs.libraryId, libraryId));
  if (!songs.length) return [];
  const lines = await database.select().from(chordshiftSongLines).where(inArray(chordshiftSongLines.songId, songs.map((song) => song.id)));
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

async function loadLibrarySnapshot(libraryId: string, secret: string) {
  await assertLibrary(libraryId, secret, false);
  return readSongs(libraryId);
}

const IMPORTED_LIBRARY_ID = "2c41a12f-5f5a-4bd1-9f99-460299979c3d";
const loadImportedLibraryCatalog = () => readSongs(IMPORTED_LIBRARY_ID);

const DEFAULT_LIBRARY_API_ORIGIN = "https://tab4uchord-t2tntlcw.manus.space";

export function isLibrarySyncPath(path: string) {
  const procedures = path.split(",").filter(Boolean);
  return procedures.length > 0 && procedures.every((procedure) => /^librarySync\.(catalog|pull|push)$/.test(procedure));
}

export function buildUpstreamTrpcUrl(requestUrl: URL, path: string, origin = DEFAULT_LIBRARY_API_ORIGIN) {
  const upstreamUrl = new URL(`/api/trpc/${path}`, origin);
  requestUrl.searchParams.forEach((value, key) => {
    if (key !== "trpcPath") upstreamUrl.searchParams.append(key, value);
  });
  return upstreamUrl;
}

async function readRequestBody(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

async function proxyLibrarySync(req: IncomingMessage, res: ServerResponse, requestUrl: URL, path: string) {
  const upstreamOrigin = process.env.CHORDIFY_LIBRARY_API_ORIGIN || DEFAULT_LIBRARY_API_ORIGIN;
  const upstreamUrl = buildUpstreamTrpcUrl(requestUrl, path, upstreamOrigin);
  const method = req.method ?? "GET";
  const body = method === "GET" || method === "HEAD" ? undefined : await readRequestBody(req);
  const headers = new Headers();
  for (const name of ["content-type", "trpc-accept", "user-agent"]) {
    const value = req.headers[name];
    if (value) headers.set(name, Array.isArray(value) ? value.join(", ") : value);
  }

  const upstreamResponse = await fetch(upstreamUrl, { method, headers, body, signal: AbortSignal.timeout(30_000) });
  res.statusCode = upstreamResponse.status;
  res.setHeader("content-type", upstreamResponse.headers.get("content-type") ?? "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(Buffer.from(await upstreamResponse.arrayBuffer()));
}

const TAB4U_HOSTS = new Set(["www.tab4u.com", "tab4u.com"]);
function decodeHtml(value: string) {
  return value.replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">");
}
function cleanText(value: string, trim = true) {
  const result = decodeHtml(value.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "")).replace(/\r/g, "");
  return trim ? result.trim() : result;
}
function parseTableRows(fragment: string) {
  const lines: Array<{ section?: string; chord: string; lyric: string; tab?: string }> = [];
  const rows = fragment.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  for (const row of rows) {
    const cells = row.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) ?? [];
    if (cells.length === 1) {
      const cell = cells[0];
      const value = cleanText(cell, false);
      const trimmed = value.trim();
      if (!trimmed) { lines.push({ chord: "", lyric: "" }); continue; }
      if (/(?:^|\s)tabs?(?:\s|$)/i.test(cell.match(/class=["']([^"']*)["']/i)?.[1] ?? "")) { lines.push({ chord: "", lyric: "", tab: value.trimEnd() }); continue; }
      const isChordCell = /class=["'][^"']*chords?[^"']*["']/i.test(cell) || /class=["'][^"']*c_C[^"']*["']/i.test(cell);
      const isSection = /class=["'][^"']*titLine[^"']*["']/i.test(cell) || (trimmed.endsWith(":") && !/[A-G](?:#|b)?[a-z0-9+\-/]*$/i.test(trimmed));
      if (isSection) lines.push({ section: trimmed.replace(/:$/, ""), chord: "", lyric: "" });
      else if (isChordCell) lines.push({ chord: trimmed, lyric: "" });
      else lines.push({ chord: "", lyric: trimmed });
      continue;
    }
    if (cells.length < 2) continue;
    const [first, second] = cells.map((cell) => cleanText(cell, false));
    const firstTrimmed = first.trim();
    const section = firstTrimmed.endsWith(":") && !/[A-G](?:#|b)?[a-z0-9+\-/]*$/i.test(firstTrimmed) ? firstTrimmed.replace(/:$/, "") : undefined;
    lines.push({ section, chord: section ? second : first, lyric: section ? "" : second });
  }
  return lines;
}
async function fetchTab4uSong(rawUrl: string) {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || !TAB4U_HOSTS.has(url.hostname)) throw new Error("ניתן לקרוא כרגע רק קישורים מאובטחים של Tab4U");
  const response = await fetch(url, { headers: { "User-Agent": "ChordShift/1.0 (personal music utility)" }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Tab4U החזיר שגיאה ${response.status}`);
  const html = await response.text();
  const contentMatch = html.match(/<div[^>]+id=["']songContentTPL["'][^>]*>([\s\S]*?)<\/div>/i);
  if (!contentMatch) throw new Error("לא נמצא אזור השיר בדף Tab4U");
  const fragment = contentMatch[1];
  const title = cleanText(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "שיר");
  const artist = cleanText(html.match(/(?:מרסדס בנד|מבצע\s*:)[\s\S]{0,80}/i)?.[0] ?? "Tab4U").replace(/מחבר ומלחין:[\s\S]*/i, "").trim();
  const lines = parseTableRows(fragment);
  return { title, artist, sourceUrl: url.toString(), lines: lines.length ? lines : fragment.split(/<br\s*\/?>/gi).map((line) => ({ chord: "", lyric: cleanText(line) })) };
}

const t = initTRPC.create({ transformer: superjson });
const libraryKeySchema = z.object({ libraryId: z.string().uuid(), secret: z.string().min(32).max(256) });
const syncedSongSchema = z.object({
  id: z.string().min(1).max(120), title: z.string().min(1).max(2000), artist: z.string().min(1).max(512), sourceUrl: z.string().url().max(2048), note: z.string().max(10000), addedAt: z.number().int().nonnegative(),
  lines: z.array(z.object({ label: z.string().max(2000).optional(), chord: z.string().max(10000), lyric: z.string().max(10000), tab: z.string().max(10000).optional() })).max(3000),
});
const vercelRouter = t.router({
  tab4u: t.router({ fetchSong: t.procedure.input(z.object({ url: z.string().url().max(2048) })).query(({ input }) => fetchTab4uSong(input.url)) }),
  librarySync: t.router({
    catalog: t.procedure.query(() => loadImportedLibraryCatalog()),
    pull: t.procedure.input(libraryKeySchema).query(({ input }) => loadLibrarySnapshot(input.libraryId, input.secret)),
    push: t.procedure.input(libraryKeySchema.extend({ songs: z.array(syncedSongSchema).max(500) })).mutation(({ input }) => saveLibrarySnapshot(input.libraryId, input.secret, input.songs)),
  }),
});

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const requestUrl = new URL(req.url ?? "/", `https://${req.headers.host ?? "localhost"}`);
  const path = requestUrl.searchParams.get("trpcPath") ?? "";
  if (!process.env.DATABASE_URL && isLibrarySyncPath(path)) {
    try {
      return await proxyLibrarySync(req, res, requestUrl, path);
    } catch (error) {
      console.error("[Library Sync Proxy] Upstream request failed", error);
      res.statusCode = 502;
      res.setHeader("content-type", "application/json; charset=utf-8");
      return res.end(JSON.stringify({ error: "LIBRARY_SYNC_UPSTREAM_UNAVAILABLE" }));
    }
  }
  return nodeHTTPRequestHandler({ req, res, path, router: vercelRouter });
}
