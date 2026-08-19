import fs from "node:fs";
import { parseTab4uHtml } from "../server/tab4u";

const manifest = JSON.parse(fs.readFileSync("server/import-manifests/approved-rock-batch-004.json", "utf8"));
for (const song of manifest.songs) {
  try {
    const response = await fetch(song.sourceUrl);
    const html = await response.text();
    const hasContent = html.includes("songContentTPL");
    const lineCount = hasContent ? parseTab4uHtml(html).length : 0;
    console.log(JSON.stringify({ title: song.title, status: response.status, bytes: html.length, hasContent, lineCount }));
  } catch (error) {
    console.log(JSON.stringify({ title: song.title, error: error instanceof Error ? error.message : String(error) }));
  }
}
