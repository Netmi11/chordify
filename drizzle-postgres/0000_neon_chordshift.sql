CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');
--> statement-breakpoint
CREATE TABLE "users" (
  "id" serial PRIMARY KEY NOT NULL,
  "openId" varchar(64) NOT NULL,
  "name" text,
  "email" varchar(320),
  "loginMethod" varchar(64),
  "role" "user_role" DEFAULT 'user' NOT NULL,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
  "lastSignedIn" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
--> statement-breakpoint
CREATE TABLE "chordshift_libraries" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "secretHash" varchar(128) NOT NULL,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chordshift_songs" (
  "id" serial PRIMARY KEY NOT NULL,
  "libraryId" varchar(64) NOT NULL,
  "clientSongId" varchar(120) NOT NULL,
  "title" text NOT NULL,
  "artist" varchar(512) NOT NULL,
  "sourceUrl" varchar(2048) NOT NULL,
  "note" text NOT NULL,
  "addedAt" bigint NOT NULL,
  "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "chordshift_songs_library_client_unique" UNIQUE("libraryId", "clientSongId"),
  CONSTRAINT "chordshift_songs_library_source_unique" UNIQUE("libraryId", "sourceUrl")
);
--> statement-breakpoint
CREATE TABLE "chordshift_song_lines" (
  "id" serial PRIMARY KEY NOT NULL,
  "songId" integer NOT NULL,
  "position" integer NOT NULL,
  "label" text,
  "chord" text NOT NULL,
  "lyric" text NOT NULL,
  "tab" text,
  CONSTRAINT "chordshift_song_lines_song_position_unique" UNIQUE("songId", "position")
);
--> statement-breakpoint
ALTER TABLE "chordshift_songs" ADD CONSTRAINT "chordshift_songs_libraryId_chordshift_libraries_id_fk"
  FOREIGN KEY ("libraryId") REFERENCES "public"."chordshift_libraries"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "chordshift_song_lines" ADD CONSTRAINT "chordshift_song_lines_songId_chordshift_songs_id_fk"
  FOREIGN KEY ("songId") REFERENCES "public"."chordshift_songs"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE INDEX "chordshift_songs_library_index" ON "chordshift_songs" ("libraryId");
--> statement-breakpoint
CREATE INDEX "chordshift_song_lines_song_index" ON "chordshift_song_lines" ("songId");
