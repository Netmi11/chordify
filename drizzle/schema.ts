import { bigint, index, integer, pgEnum, pgTable, serial, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["user", "admin"]);

/** Core user table backing the existing auth flow. */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: userRole("role").default("user").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn", { withTimezone: true }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Anonymous, client-owned library. The browser generates a high-entropy
 * library ID and recovery secret; only the hash is stored in the database.
 */
export const chordshiftLibraries = pgTable("chordshift_libraries", {
  id: varchar("id", { length: 64 }).primaryKey(),
  secretHash: varchar("secretHash", { length: 128 }).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export const chordshiftSongs = pgTable("chordshift_songs", {
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

export const chordshiftSongLines = pgTable("chordshift_song_lines", {
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

export type ChordshiftLibrary = typeof chordshiftLibraries.$inferSelect;
export type ChordshiftSong = typeof chordshiftSongs.$inferSelect;
export type ChordshiftSongLine = typeof chordshiftSongLines.$inferSelect;
