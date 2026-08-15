# Bookmarklet mobile diagnosis

The live Tab4U song page exposes `#songContentTPL` and contains chord/lyric rows, including table-based content. The previous bookmarklet copied a short `javascript:` loader that created an external script element pointing to `/bookmarklet.js`. The user’s Samsung Chrome screenshot showed the bookmark saved with that loader but no visible toolbar after activation. The new implementation copies a self-contained bookmarklet, URL-encodes its body, supports `#songContentTPL` plus fallback selectors, and displays a fixed visible message when no song area or chord sequence is found.

Validation completed on 2026-08-15: 12 Vitest tests passed, TypeScript check passed, and production build passed.

## Runtime harness verification

A new mobile-style harness ran the same synchronized public `bookmarklet.js`. The toolbar appeared with +7 and מקור controls. Clicking +7 changed `Am Gm Am Fmaj7 / Dmaj7 / Em7` to `Em Dm Em Cmaj7 / Amaj7 / Bm7`, while the Hebrew lyric rows remained unchanged and in the same order. Clicking מקור restored the original chords and step 0. The earlier harness 404 was resolved by adding the harness file.

## Raw bookmarklet publication check

The raw bookmarklet source now contains no literal hash characters and passes syntax/runtime tests locally. After checkpoint 26ea762f, a direct browser test against the public `/bookmarklet.js` endpoint timed out, and a same-page fetch failed, so the public endpoint was not yet verified as available at that moment. Do not ask the user to copy the new version until the public asset is confirmed after deployment propagation.

A second direct extraction after a 12-second wait still returned the old 5,252-character bookmarklet with literal hash selectors/colors. The new raw source is therefore not yet reflected at the public domain, despite checkpoint 26ea762f. The user should not copy a new bookmarklet until this publication mismatch is resolved.

## Final public runtime verification

After checkpoint 0c3b37c0, the public bookmarklet endpoint returned the new raw source (5,578 characters, getElementById selector, rgb colors, no literal hash in the source). On a live Tab4U song page, the public script loaded successfully; the toolbar appeared, 43 chord nodes were detected, and clicking +7 changed the first chord from Am to Em and set the step indicator to +7. The browser text probe did not see the Hebrew lyric string because of the live page's DOM/text representation, but the page's song area and chord nodes were present.

## Repeat end-to-end verification

On 2026-08-15 the published bookmarklet was re-tested on a newly opened Tab4U page. It loaded successfully, created its toolbar, detected 43 chord nodes, changed the first chord from `Am` to `Em` with `+7`, and the `מקור` button restored both the original `Am` and step `0`.

## Compact control verification

The compact control was verified on the mobile harness. The initial state renders only a 52px circular music button in the upper-left corner. Tapping it opens a compact panel with the existing controls; `+7` changed the sample chords from `Am Gm Am Fmaj7 / Dmaj7 / Em7` to `Em Dm Em Cmaj7 / Amaj7 / Bm7` while all lyric rows remained in place.
