# Chordify architecture notes

## Current direction

The application should keep UI components thin and move reusable behavior into pure modules under `client/src/lib`.

### Chord engine

`chordEngine.ts` owns chord parsing/transposition, key detection, chord token replacement, and tab grouping. Keeping this logic pure makes it easy to test independently from React.

### Library domain

`songLibraryV2.ts` owns local persistence, validation, import/export, and deterministic sorting.

`librarySearch.ts` owns search normalization and matching.

`syncPolicy.ts` owns cloud/local conflict behavior and deliberately preserves local-only user data.

## Recommended component split

The next UI refactor should move responsibilities out of `Home.tsx` into focused units such as:

- `LibraryView`
- `SongPlayer`
- `TransposeControls`
- `ChordLine`
- `BackupAndSyncPanel`
- `useSongLibrary`
- `useCloudLibrarySync`

This split should be behavior-preserving first. Visual changes should follow only after the extracted components are covered by tests.
