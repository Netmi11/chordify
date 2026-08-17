import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("song player mobile cleanup", () => {
  const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
  const styles = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");

  it("uses a song-only workspace when opening a library song", () => {
    expect(homeSource).toContain('savedSong ? "workspace-song-only" : ""');
    expect(homeSource).toContain('savedSong ? "song-loaded-rail" : ""');
    expect(styles).toContain(".workspace-song-only { display: block; }");
    expect(styles).toContain(".song-loaded-rail { display: none; }");
  });

  it("keeps compact tab typography for narrow screens", () => {
    expect(styles).toContain('font: 500 11px/1 "IBM Plex Mono"');
    expect(styles).toContain("font-size: clamp(9px, 2.2vw, 11px)");
    expect(styles).toContain("background: transparent");
    expect(styles).toContain("border: 0");
    expect(styles).toContain("white-space: pre");
    expect(styles).toContain(".tab-card");
    expect(homeSource).toContain("song-row tab-row");
  });

  it("opens the library first and groups songs by artist", () => {
    expect(homeSource).toContain('useState<"player" | "library">("library")');
    expect(homeSource).toContain("const groupedArtists = useMemo");
    expect(homeSource).toContain("const [expandedArtist, setExpandedArtist]");
    expect(homeSource).toContain('isExpanded ? "artist-group is-expanded" : "artist-group"');
    expect(homeSource).toContain("className=\"artist-avatar\"");
    expect(homeSource).toContain('artistInitials(artistName) || "♪"');
    expect(homeSource).not.toContain('singleSong ? onOpen(artistSongs[0])');
    expect(homeSource).toContain('onClick={() => setExpandedArtist(isExpanded ? null : artistName)}');
    expect(homeSource).toContain("{isExpanded && <div className=\"artist-song-grid\">");
  });

  it("opens imported bridge songs in the player despite the library-first default", () => {
    expect(homeSource).toContain('setSavedSong(importedSongs[0] ?? null);');
    expect(homeSource).toContain('setSavedSong(song);');
    expect(homeSource).toContain('window.history.pushState({ chordshiftScreen: "player" }, "", "#song");');
  });

  it("returns from a saved song to the library", () => {
    expect(homeSource).toContain('savedSong ? "חזור לספרייה" : "הספרייה"');
    expect(homeSource).toContain('screen === "library" ? savedSong ? "חזור לשיר הנוכחי" : "עבור לטעינת שיר" : "חזור לספרייה"');
    expect(homeSource).toContain('window.addEventListener("popstate", onPopState)');
    expect(homeSource).toContain('setScreen("library")');
    expect(homeSource).toContain('window.history.pushState({ chordshiftScreen: "player" }, "", "#song")');
  });

  it("does not render the removed duplicate toolbar actions", () => {
    expect(homeSource).not.toContain("העתק</button>");
    expect(homeSource).not.toContain("מסך מלא</button>");
  });

  it("keeps maintenance tools secondary and the mobile player controls compact", () => {
    expect(homeSource).toContain('className="library-utilities"');
    expect(homeSource).toContain("גיבוי וסנכרון");
    expect(homeSource).toContain('className="song-pdf-float"');
    expect(styles).toContain("grid-template-columns: repeat(6, 1fr)");
  });
});
