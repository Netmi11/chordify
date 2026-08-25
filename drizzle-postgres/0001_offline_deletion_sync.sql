ALTER TABLE "chordshift_libraries"
  ADD COLUMN IF NOT EXISTS "revision" bigint DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "chordshift_songs"
  ADD COLUMN IF NOT EXISTS "syncRevision" bigint DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chordshift_song_tombstones" (
  "id" serial PRIMARY KEY NOT NULL,
  "libraryId" varchar(64) NOT NULL,
  "sourceUrl" varchar(2048) NOT NULL,
  "clientSongId" varchar(120),
  "syncRevision" bigint NOT NULL,
  "deletedAt" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "chordshift_tombstones_library_source_unique" UNIQUE("libraryId", "sourceUrl"),
  CONSTRAINT "chordshift_song_tombstones_libraryId_fk" FOREIGN KEY ("libraryId")
    REFERENCES "public"."chordshift_libraries"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chordshift_tombstones_library_index"
  ON "chordshift_song_tombstones" ("libraryId");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chordshift_sync_operations" (
  "id" serial PRIMARY KEY NOT NULL,
  "libraryId" varchar(64) NOT NULL,
  "operationId" varchar(64) NOT NULL,
  "deviceId" varchar(64) NOT NULL,
  "kind" varchar(16) NOT NULL,
  "sourceUrl" varchar(2048) NOT NULL,
  "baseRevision" bigint NOT NULL,
  "serverRevision" bigint NOT NULL,
  "outcome" varchar(16) NOT NULL,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "chordshift_sync_operations_library_operation_unique" UNIQUE("libraryId", "operationId"),
  CONSTRAINT "chordshift_sync_operations_libraryId_fk" FOREIGN KEY ("libraryId")
    REFERENCES "public"."chordshift_libraries"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chordshift_sync_operations_library_index"
  ON "chordshift_sync_operations" ("libraryId");
