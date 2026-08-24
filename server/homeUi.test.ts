import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/HomeV2.tsx"), "utf8");
const librarySource = readFileSync(resolve(process.cwd(), "client/src/components/LibraryView.tsx"), "utf8");
const styles = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");
const mobileStyles = readFileSync(resolve(process.cwd(), "client/src/mobile-player.css"), "utf8");

describe("song player mobile cleanup", () => {
  it("uses a song-only workspace when opening a library song", () => {
    expect(homeSource).toContain('savedSong ? "workspace-song-only" : ""');
    expect(homeSource).toContain('savedSong ? "song-loaded-rail" : ""');
    expect(styles).toContain(".workspace-song-only { display: block; }");
    expect(styles).toContain(".song-loaded-rail { display: none; }");
  });

  it("keeps compact tab typography for narrow screens", () => {
    expect(styles).toContain('font: 500 11px/1.2 "IBM Plex Mono"');
    expect(styles).toContain("font-size: clamp(9px, 2.45vw, 11px)");
    expect(styles).toContain(".tab-block");
    expect(styles).toContain(".tab-sheet");
    expect(styles).toContain("white-space: pre");
    expect(homeSource).toContain("buildSongRenderBlocks");
    expect(homeSource).toContain("tab-block");
  });

  it("opens the library first and groups songs by artist in the extracted library view", () => {
    expect(homeSource).toContain('useState<"player" | "library">("library")');
    expect(librarySource).toContain("groupSongsByArtist(filtered)");
    expect(librarySource).toContain("const [expandedArtist, setExpandedArtist]");
    expect(librarySource).toContain('isExpanded ? "artist-group is-expanded" : "artist-group"');
    expect(librarySource).toContain('className="artist-avatar"');
    expect(librarySource).toContain('artistInitials(artistName) || "♪"');
    expect(librarySource).toContain('onClick={() => setExpandedArtist(isExpanded ? null : artistName)}');
  });

  it("opens imported bridge songs in the player despite the library-first default", () => {
    expect(homeSource).toContain('setSavedSong(importedSongs[0] ?? null);');
    expect(homeSource).toContain('setSavedSong(song);');
    expect(homeSource).toContain('window.history.pushState({ chordshiftScreen: "player" }, "", "#song");');
  });

  it("returns from a saved song to the library", () => {
    expect(homeSource).toContain('screen === "library" ? "שיר חדש" : "הספרייה"');
    expect(homeSource).toContain('window.addEventListener("popstate", onPopState)');
    expect(homeSource).toContain('setScreen("library")');
  });

  it("uses conflict-safe cloud catalog sync and no hard-coded song count", () => {
    expect(homeSource).toContain('trpcUtils.librarySync.catalog.fetch()');
    expect(homeSource).toContain('mergeLibraryForSync');
    expect(homeSource).toContain('סנכרן את קטלוג השירים');
    expect(librarySource).not.toContain('סנכרן 247 שירים');
  });

  it("keeps maintenance tools secondary and the mobile player controls compact", () => {
    expect(homeSource).toContain('className="app-menu"');
    expect(homeSource).toContain("ניהול הספרייה");
    expect(homeSource).not.toContain('className="song-pdf-float"');
    expect(mobileStyles).toContain(".mobile-dock");
    expect(mobileStyles).toContain("env(safe-area-inset-bottom)");
  });

  it("removes personal notes from the player and library interface", () => {
    expect(homeSource).not.toContain("personal-note");
    expect(homeSource).not.toContain("הערה אישית");
    expect(librarySource).not.toContain("song-card-note");
    expect(styles).not.toContain(".personal-note");
  });

  it("transposes tablature together with the song", () => {
    expect(homeSource).toContain('transposeTab(block.tabs.join("\\n"), shift)');
    expect(homeSource).toContain("line.tab ? { tab: line.tab }");
  });

  it("keeps text legible on every dark control in the light theme", () => {
    expect(styles).toContain(":root:not(.dark) .artist-filter.active");
    expect(styles).toContain(":root:not(.dark) .load-button");
    expect(styles).toContain("color: #fff;");
  });

  it("keeps secondary player labels readable on light surfaces", () => {
    expect(styles).toContain(".panel-heading small { color: var(--ink-soft); }");
    expect(styles).toContain(".position-note { color: var(--ink-soft); }");
  });

  it("offers private single-chord editing and a lyrics-only reading mode", () => {
    expect(homeSource).toContain('const [showChords, setShowChords] = useState(true)');
    expect(homeSource).toContain('מילים בלבד');
    expect(homeSource).toContain('ערוך אקורד');
    expect(homeSource).toContain('replaceChordToken(line.chord, chordIndex, nextChord)');
    expect(homeSource).toContain('התיקון נשמר רק בספרייה שלך');
    expect(styles).toContain('.lyrics-only .lyric-line');
    expect(styles).toContain('.chord-editable');
  });
});
