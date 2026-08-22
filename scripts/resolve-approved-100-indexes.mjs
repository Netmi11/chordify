import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const project = resolve(process.argv[2] || process.cwd());
const proposalPath = resolve(project, "server/import-manifests/proposed-100-selected-israeli-guitar-songs.md");
const outputPath = resolve(project, "server/import-manifests/approved-100-selected-resolution.json");

const artistSources = [
  { marker: "יסמין מועלם", artist: "יסמין מועלם", indexUrl: "https://www.tab4u.com/tabs/artists/1835_%D7%99%D7%A1%D7%9E%D7%99%D7%9F_%D7%9E%D7%95%D7%A2%D7%9C%D7%9D.html" },
  { marker: "ג׳יין בורדו", artist: "ג׳יין בורדו", indexUrl: "https://www.tab4u.com/tabs/artists/990_%D7%92%26%2339%3B%D7%99%D7%99%D7%9F_%D7%91%D7%95%D7%A8%D7%93%D7%95.html" },
  { marker: "טונה", artist: "טונה", indexUrl: "https://www.tab4u.com/tabs/artists/1010_%D7%98%D7%95%D7%A0%D7%94.html" },
  { marker: "רביד פלוטניק", artist: "נצ׳י נצ׳ (רביד פלוטניק)", indexUrl: "https://www.tab4u.com/tabs/artists/913_%D7%A0%D7%A6%26%2339%3B%D7%99_%D7%A0%D7%A6%26%2339%3B_%28%D7%A8%D7%91%D7%99%D7%93_%D7%A4%D7%9C%D7%95%D7%98%D7%A0%D7%99%D7%A7%29.html" },
  { marker: "ג׳ימבו ג׳יי", artist: "ג׳ימבו ג׳יי", indexUrl: "https://www.tab4u.com/tabs/artists/1283_%D7%92%26%2339%3B%D7%99%D7%9E%D7%91%D7%95_%D7%92%26%2339%3B%D7%99%D7%99.html" },
  { marker: "Full Trunk", artist: "Full Trunk", indexUrl: "https://www.tab4u.com/tabs/artists/1072_Full_Trunk.html" },
  { marker: "התקווה 6", artist: "התקווה 6", indexUrl: "https://www.tab4u.com/tabs/artists/114_%D7%94%D7%AA%D7%A7%D7%95%D7%95%D7%94_6.html" },
  { marker: "הדג נחש", artist: "הדג נחש", indexUrl: "https://www.tab4u.com/tabs/artists/97_%D7%94%D7%93%D7%92_%D7%A0%D7%97%D7%A9.html" },
  { marker: "דודו טסה", artist: "דודו טסה", indexUrl: "https://www.tab4u.com/tabs/artists/73_%D7%93%D7%95%D7%93%D7%95_%D7%98%D7%A1%D7%94.html" },
  { marker: "אלון עדר", artist: "אלון עדר", indexUrl: "https://www.tab4u.com/tabs/artists/918_%D7%90%D7%9C%D7%95%D7%9F_%D7%A2%D7%93%D7%A8.html" },
  { marker: "עדן חסון", artist: "עדן חסון", indexUrl: "https://www.tab4u.com/tabs/artists/837_%D7%A2%D7%93%D7%9F_%D7%97%D7%A1%D7%95%D7%9F.html" },
  { marker: "פאר טסי", artist: "פאר טסי", indexUrl: "https://www.tab4u.com/tabs/artists/934_%D7%A4%D7%90%D7%A8_%D7%98%D7%A1%D7%99.html" },
  { marker: "חנן בן ארי", artist: "חנן בן ארי", indexUrl: "https://www.tab4u.com/tabs/artists/935_%D7%97%D7%A0%D7%9F_%D7%91%D7%9F_%D7%90%D7%A8%D7%99.html" },
];

function decodeHtml(value) {
  return value
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number(decimal)))
    .replace(/&#x([\da-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&nbsp;/gi, " ");
}

function normalize(value) {
  return decodeHtml(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/[׳'״"`.,:;!?()[\]{}|/\\–—-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("he");
}

function extractRequestedSongs(markdown) {
  let source = null;
  const candidates = [];
  for (const line of markdown.split(/\r?\n/)) {
    if (line.startsWith("## ")) {
      const heading = line.slice(3);
      source = artistSources.find((entry) => heading.includes(entry.marker)) || null;
      continue;
    }
    const match = line.match(/^\|\s*(\d+)\s*\|\s*(.+?)\s*\|\s*$/);
    if (source && match) {
      candidates.push({ number: Number(match[1]), artist: source.artist, title: match[2], indexUrl: source.indexUrl });
    }
  }
  return candidates;
}

function extractIndexLinks(html, indexUrl) {
  const links = [];
  const expression = /<a\b([^>]*?)href=["']([^"']*(?:\/|\.\.\/)songs\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(expression)) {
    const href = new URL(decodeHtml(match[2]), indexUrl).toString();
    const title = decodeHtml(match[3])
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .replace(/\s*\d+(?:[.,]\d+)?\s*\(\d+\s*(?:דירוג|דירוגים|מדרגים)\)\s*$/u, "")
      .trim();
    if (title) links.push({ title, sourceUrl: href });
  }
  return links;
}

async function fetchIndex(indexUrl) {
  const response = await fetch(indexUrl, { headers: { "User-Agent": "ChordShift/1.0 (approved personal library import)" }, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

const markdown = await readFile(proposalPath, "utf8");
const requested = extractRequestedSongs(markdown);
if (requested.length !== 100) throw new Error(`Expected 100 proposed songs, found ${requested.length}.`);

const linksByIndex = new Map();
const indexErrors = [];
for (const source of artistSources) {
  try {
    const html = await fetchIndex(source.indexUrl);
    linksByIndex.set(source.indexUrl, extractIndexLinks(html, source.indexUrl));
  } catch (error) {
    indexErrors.push({ artist: source.artist, indexUrl: source.indexUrl, error: error instanceof Error ? error.message : String(error) });
    linksByIndex.set(source.indexUrl, []);
  }
  await new Promise((resolve) => setTimeout(resolve, 250));
}

const resolved = [];
const unresolved = [];
for (const song of requested) {
  const expectedTitle = normalize(song.title);
  const matches = (linksByIndex.get(song.indexUrl) || []).filter((link) => normalize(link.title) === expectedTitle);
  if (matches.length === 1) {
    resolved.push({ number: song.number, artist: song.artist, title: song.title, sourceUrl: matches[0].sourceUrl, indexUrl: song.indexUrl });
  } else {
    unresolved.push({
      number: song.number,
      artist: song.artist,
      title: song.title,
      indexUrl: song.indexUrl,
      status: matches.length ? "ambiguous_index_match" : "missing_exact_index_match",
      matches: matches.map((match) => match.sourceUrl),
    });
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  sourceProposal: proposalPath,
  requestedCount: requested.length,
  resolvedCount: resolved.length,
  unresolvedCount: unresolved.length,
  indexErrors,
  indexLinkCounts: Object.fromEntries(artistSources.map((source) => [source.artist, (linksByIndex.get(source.indexUrl) || []).length])),
  indexSamples: Object.fromEntries(artistSources.map((source) => [source.artist, (linksByIndex.get(source.indexUrl) || []).slice(0, 3)])),
  resolved,
  unresolved,
};
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ requested: requested.length, resolved: resolved.length, unresolved: unresolved.length, indexErrors: indexErrors.length, outputPath }, null, 2));
