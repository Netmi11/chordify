ALTER TABLE "chordshift_songs"
ADD COLUMN IF NOT EXISTS "categories" text[] DEFAULT ARRAY[]::text[] NOT NULL;
