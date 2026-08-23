# Chordify improvement plan

This branch hardens the app before larger UI refactors.

## Completed in this branch

- Added unit coverage for library parsing, sorting, merging, and import validation.
- Extracted a pure chord engine with deterministic transposition helpers.
- Fixed slash-chord transposition when root and bass use different sharp/flat notation.
- Added coverage for chord lines, key detection, legacy tabs, and chord replacement.
- Added GitHub Actions CI for type checking, tests, and production builds.

## Next refactor targets

1. Move the song player UI out of `Home.tsx` into focused components.
2. Move the library view and filtering into its own component/hook.
3. Replace hard-coded cloud catalog counts with server-derived values.
4. Add explicit offline/PWA integration tests.
5. Add sync conflict tests that preserve local notes while incorporating cloud songs.
6. Profile library rendering with large catalogs and virtualize only if needed.

## Guardrails

- Keep `main` deployable.
- Prefer pure functions for chord and library transformations.
- Require `pnpm check`, `pnpm test`, and `pnpm build` to pass before merge.
- Preserve local notes and local-only songs during synchronization.
