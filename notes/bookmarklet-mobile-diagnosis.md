# Bookmarklet mobile diagnosis

The live Tab4U song page exposes `#songContentTPL` and contains chord/lyric rows, including table-based content. The previous bookmarklet copied a short `javascript:` loader that created an external script element pointing to `/bookmarklet.js`. The user’s Samsung Chrome screenshot showed the bookmark saved with that loader but no visible toolbar after activation. The new implementation copies a self-contained bookmarklet, URL-encodes its body, supports `#songContentTPL` plus fallback selectors, and displays a fixed visible message when no song area or chord sequence is found.

Validation completed on 2026-08-15: 12 Vitest tests passed, TypeScript check passed, and production build passed.

## Runtime harness verification

A new mobile-style harness ran the same synchronized public `bookmarklet.js`. The toolbar appeared with +7 and מקור controls. Clicking +7 changed `Am Gm Am Fmaj7 / Dmaj7 / Em7` to `Em Dm Em Cmaj7 / Amaj7 / Bm7`, while the Hebrew lyric rows remained unchanged and in the same order. Clicking מקור restored the original chords and step 0. The earlier harness 404 was resolved by adding the harness file.
