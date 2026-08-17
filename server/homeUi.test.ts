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
    expect(styles).toContain('font: 500 11px/1.25 "IBM Plex Mono"');
    expect(styles).toContain("font-size: clamp(9px, 2.5vw, 11px)");
  });

  it("does not render the removed duplicate toolbar actions", () => {
    expect(homeSource).not.toContain("העתק</button>");
    expect(homeSource).not.toContain("מסך מלא</button>");
  });
});
