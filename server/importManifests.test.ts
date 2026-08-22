import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type ApprovedSong = {
  artist: string;
  title: string;
  sourceUrl: string;
};

function readManifest(fileName: string): ApprovedSong[] {
  const absolutePath = resolve(process.cwd(), "server", "import-manifests", fileName);
  const parsed = JSON.parse(readFileSync(absolutePath, "utf8")) as { songs?: ApprovedSong[] };
  return parsed.songs ?? [];
}

describe("user-requested import manifests", () => {
  it("keeps the 36 approved songs unique and constrained to Tab4U song pages", () => {
    const batches = [
      readManifest("batch-003-approved.json"),
      readManifest("batch-004-approved.json"),
      readManifest("batch-005-approved.json"),
      readManifest("batch-006-approved.json"),
    ];

    expect(batches.map((songs) => songs).map((songs) => songs.length)).toEqual([10, 10, 10, 6]);

    const songs = batches.flat();
    expect(songs).toHaveLength(36);
    expect(new Set(songs.map((song) => song.sourceUrl)).size).toBe(36);

    songs.forEach((song) => {
      expect(song.artist).not.toHaveLength(0);
      expect(song.title).not.toHaveLength(0);
      expect(song.sourceUrl).toMatch(/^https:\/\/(?:www\.)?tab4u\.com\/tabs\/songs\/\d+_.+\.html$/);
    });
  });

  it("accepts the browser-verified Kaveret batch and its snapshots", () => {
    const songs = readManifest("approved-kaveret-hakeves-batch-001.json");
    expect(songs).toHaveLength(3);
    expect(new Set(songs.map((song) => song.sourceUrl)).size).toBe(3);
    songs.forEach((song) => {
      expect(song.artist).toBe("כוורת");
      expect(song.sourceUrl).toMatch(/^https:\/\/www\.tab4u\.com\/tabs\/songs\/\d+_.+\.html$/);
      const id = song.sourceUrl.match(/\/songs\/(\d+)_/)?.[1];
      expect(id).toBeTruthy();
      const snapshot = resolve(process.cwd(), "server", "import-snapshots", "kaveret-hakeves-approved", `tab4u_com_${id}_kaveret_${id === "1729" ? "hi_kol_kach_yafa" : id === "1237" ? "shiur_moledet" : "shir_hatambal"}.html`);
      const html = readFileSync(snapshot, "utf8");
      expect(html).toContain('id="songContentTPL"');
    });
  });
});
