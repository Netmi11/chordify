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

## Public compact control verification

The published 1.1.0 Userscript was loaded on a fresh live Tab4U page. It created the toolbar in a closed state with a launcher present, `top: 12px`, `left: 12px`, and `width: 52px`, confirming that only the small circular control is shown by default.

## Side selection verification

The compact harness opened on the left by default. The new `העבר לימין` action moved the open panel to the upper-right corner and changed its action text to `העבר לשמאל`; the runtime unit test also verified the saved `chordshift-side=right` preference.

On a live browser harness with the right-side preference selected, the launcher rectangle ended 12px from the right viewport edge (`rightGap: 12`); `+7` changed the first chord from `Am` to `Em`, and `מקור` restored `Am` and step `0`.

## Tab4U host coverage

Live checks confirmed song pages are served at `tab4u.com`, `www.tab4u.com`, `m.tab4u.com`, and `en.tab4u.com`, all with the expected `songContentTPL` region. The compact script body was loaded on `m.tab4u.com`, detected 43 chord nodes, and created the closed circular launcher successfully. Version 1.4.0 therefore lists those four exact song URL patterns rather than a broad external wildcard.

The same direct runtime check on `en.tab4u.com` found `songContentTPL`, detected 43 chord nodes, and created the closed circular launcher successfully.

## Half-size launcher verification

The compact harness measured the closed launcher at 26px by 26px. Tapping it opened the 279px control panel, which retained all seven panel buttons.

## Tab structure research

The live Tab4U Hotel California page contains complete guitar tablature. Each tab block is an aligned table whose six rows use `td.tabs` cells (for example `e|-9---|`, `B|-7---|`), while chords appear in separate `td.chords_en` cells. Tab playback anchors such as `pTabI0` are separate controls. This structure permits targeting only `td.tabs` cells without changing song lyrics or chord names.

## Live tab transposition verification

On the live Hotel California page, ChordShift identified 234 `td.tabs` rows and 118 chord nodes. After +7 while the tabs control was off, the first tab line remained exactly original. Enabling `טאבים: פעיל` changed `e|-9---|` to `e|-16--|` while retaining the same line length. `מקור` restored the exact original text and width, with the transposition step back at 0.

## Personal library interface verification

The browser check confirmed that the player view exposes the library button and the save action. The library view opens correctly with search, artist filter, an intentional empty state, and return actions to the song-loading workspace.

The live import flow returns correctly from the library to the loader and switches the load action into an explicit `טוען…` state while the Tab4U request is in flight.

## Direct library import bridge verification

The live Hotel California page loaded the updated ChordShift toolbar and the new save action opened the local library target. The captured local payload contained 392 lines, including 234 original tab lines, with the expected title and source URL. The artist selector fell back to `Tab4U` in this runtime and needs an extraction fallback before release.

The second live bridge run confirmed that all song and tab content still transfers, while the first matching artist selector can be an empty visual node. The extractor will therefore select the first candidate artist element with non-empty text.

After synchronizing the Userscript, the live import bridge produced the expected `Hotel California` title and `Eagles` artist with 392 lines, including 234 tab rows. A representative payload was then prepared for the final in-app persistence check.

The full local import test completed successfully: ChordShift opened with a saved `Hotel California` record, original `Bm9` chord and tab rows, note field, source URL, and a library count of one. The library rendered an Eagles filter plus a dated song card with a direct play action.

The revised service worker is registered, active, and controlling the app. The active worker cache was initially empty because the browser had not yet navigated under the new cache version; a controlled reload is required to populate the shell cache.

After a controlled reload, `chordshift-shell-v2` contained the app shell and manifest. The mobile control dock was also corrected to six grid cells so the temporary transposition, source reset, and scroll actions remain visible together.

Final offline verification confirmed a cached app shell with HTTP 200, an active controlling service worker, and a persisted local library record for `Hotel California` after reloading the app.
