import { readFile } from 'node:fs/promises';
import { parseTab4uHtml } from '../server/tab4u.ts';

const manifestPath = process.argv[2];
if (!manifestPath) throw new Error('Missing manifest path');

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

for (const song of manifest.songs) {
  try {
    const response = await fetch(song.sourceUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    const html = await response.text();
    const parsed = parseTab4uHtml(html, song.sourceUrl);
    console.log(JSON.stringify({ title: song.title, status: response.status, parsedLines: parsed.lines.length, result: 'ok' }));
  } catch (error) {
    console.log(JSON.stringify({ title: song.title, result: 'failed', error: error instanceof Error ? error.message : String(error) }));
  }
}
