import { bigint, index, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Anonymous, client-owned library. The browser generates a high-entropy
 * library ID and recovery secret; only the hash is stored in the database.
 */
export const chordshiftLibraries = mysqlTable("chordshift_libraries", {
  id: varchar("id", { length: 64 }).primaryKey(),
  secretHash: varchar("secretHash", { length: 128 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const chordshiftSongs = mysqlTable("chordshift_songs", {
  id: int("id").autoincrement().primaryKey(),
  libraryId: varchar("libraryId", { length: 64 }).notNull(),
  clientSongId: varchar("clientSongId", { length: 120 }).notNull(),
  title: text("title").notNull(),
  artist: varchar("artist", { length: 512 }).notNull(),
  sourceUrl: varchar("sourceUrl", { length: 2048 }).notNull(),
  note: text("note").notNull(),
  addedAt: bigint("addedAt", { mode: "number" }).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("chordshift_songs_library_client_unique").on(table.libraryId, table.clientSongId),
  index("chordshift_songs_library_index").on(table.libraryId),
]);

export const chordshiftSongLines = mysqlTable("chordshift_song_lines", {
  id: int("id").autoincrement().primaryKey(),
  songId: int("songId").notNull(),
  position: int("position").notNull(),
  label: text("label"),
  chord: text("chord").notNull(),
  lyric: text("lyric").notNull(),
  tab: text("tab"),
}, (table) => [
  uniqueIndex("chordshift_song_lines_song_position_unique").on(table.songId, table.position),
  index("chordshift_song_lines_song_index").on(table.songId),
]);

export type ChordshiftLibrary = typeof chordshiftLibraries.$inferSelect;
export type ChordshiftSong = typeof chordshiftSongs.$inferSelect;
export type ChordshiftSongLine = typeof chordshiftSongLines.$inferSelect;
