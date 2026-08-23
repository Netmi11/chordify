# Testing Chordify

Use these commands before merging changes:

```bash
pnpm install
pnpm check
pnpm test
pnpm build
```

## High-risk behavior covered by unit tests

- Chord transposition, including slash chords and mixed sharp/flat notation.
- Starting-key detection and chord-token replacement.
- Legacy Tab4U tab-line grouping.
- Library metadata normalization and sorting.
- Import host/path validation and duplicate rejection.
- Normalized Hebrew/English library search.
- Cloud synchronization that preserves local notes and local-only songs.

## Manual mobile smoke test

1. Open the app on Android and confirm the library loads.
2. Search for a song by artist and title.
3. Open a song and transpose up/down, including a song with slash chords.
4. Edit a chord and confirm only the selected chord changes.
5. Export/restore a library backup.
6. Sync from cloud and confirm local notes remain intact.
7. Open previously used songs in airplane mode.
