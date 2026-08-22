import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const project = resolve(process.argv[2] || process.cwd());
const libraryId = process.argv[3];
if (!libraryId) throw new Error("Usage: validate-approved-100-sources.mjs <project-path> <library-id>");

const resolutionPath = resolve(project, "server/import-manifests/approved-100-selected-resolution.json");
const outputDir = resolve(project, "server/import-manifests");
const outputPath = resolve(outputDir, "approved-100-selected-source-validation.json");
const manifestPrefix = resolve(outputDir, "approved-100-selected-batch-");

const manualSourceOverrides = {
  2: "https://www.tab4u.com/tabs/songs/71982_%D7%99%D7%A1%D7%9E%D7%99%D7%9F_%D7%9E%D7%95%D7%A2%D7%9C%D7%9D_-_%D7%99%D7%94%D7%99%D7%94_%D7%98%D7%95%D7%91.html",
  8: "https://www.tab4u.com/tabs/songs/72962_%D7%99%D7%A1%D7%9E%D7%99%D7%9F_%D7%9E%D7%95%D7%A2%D7%9C%D7%9D_-_%D7%99%D7%95%D7%9D_%D7%9B%D7%99%D7%A4%D7%95%D7%A8.html",
  24: "https://www.tab4u.com/tabs/songs/7028_%D7%98%D7%95%D7%A0%D7%94_-_%D7%A2%D7%95%D7%9C%D7%9D_%D7%9E%D7%97%D7%A9%D7%95%D7%92%D7%A2.html",
  31: "https://www.tab4u.com/tabs/songs/67978_%D7%A0%D7%A6%26%2339%3B%D7%99_%D7%A0%D7%A6%26%2339%3B_%28%D7%A8%D7%91%D7%99%D7%93_%D7%A4%D7%9C%D7%95%D7%98%D7%A0%D7%99%D7%A7%29_-_%D7%94%D7%A8%D7%99%D7%A0%D7%99.html",
  47: "https://www.tab4u.com/tabs/songs/77104_Full_Trunk_-_%D7%90%D7%99%D7%9F_%D7%9E%D7%99%D7%9C%D7%99%D7%9D_%D7%90%D7%99%D7%AA%D7%9A.html",
  50: "https://www.tab4u.com/tabs/songs/8132_Full_Trunk_-_As_A_Stone.html",
  52: "https://www.tab4u.com/tabs/songs/72537_Full_Trunk_-_%D7%A7%D7%93%D7%99%D7%9E%D7%94_%D7%9C%D7%90%D7%95%D7%AA%D7%95_%D7%9E%D7%A7%D7%95%D7%9D.html",
  78: "https://www.tab4u.com/tabs/songs/71449_%D7%90%D7%9C%D7%95%D7%9F_%D7%A2%D7%93%D7%A8_-_%D7%90%D7%94%D7%91%D7%94_%D7%A2%D7%A6%D7%9E%D7%99%D7%AA.html",
  98: "https://www.tab4u.com/tabs/songs/68002_%D7%97%D7%A0%D7%9F_%D7%91%D7%9F_%D7%90%D7%A8%D7%99_-_%D7%A9%D7%91%D7%95%D7%A8%D7%99_%D7%9C%D7%91.html",
};

function normalize(value) {
  return String(value || "")
    .replace(/&#39;|&#x27;/giu, "'")
    .replace(/&quot;|&#34;|&#x22;/giu, '"')
    .replace(/&amp;/giu, "&")
    .replace(/[׳'״"`.,:;!?()[\]{}|/\\–—-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("he");
}

function artistMatchesRequested(requestedArtist, parsedArtist) {
  if (!parsedArtist) return false;
  if (parsedArtist.includes(requestedArtist) || requestedArtist.includes(parsedArtist)) return true;

  const aliases = [
    ["נצ י נצ י רביד פלוטניק", "נצ י נצ י"],
    ["רביד פלוטניק", "נצ י נצ י"],
  ];
  return aliases.some(([left, right]) =>
    (requestedArtist.includes(left) && parsedArtist.includes(right)) ||
    (requestedArtist.includes(right) && parsedArtist.includes(left)),
  );
}

function metadataFromTab4uPage(html) {
  const match = html.match(/<meta\s+name=["']title["']\s+content=["']([^"']+)["'][^>]*>/iu);
  const content = match?.[1]?.trim() || "";
  const parsed = content.match(/^אקורדים\s+לשיר\s+(.+?)\s+-\s+(.+?)\s*\|\s*Tab4U$/u);
  return parsed ? { title: parsed[1].trim(), artist: parsed[2].trim() } : null;
}

async function fetchTab4uHtml(sourceUrl) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(sourceUrl, {
        headers: { "User-Agent": "ChordShift/1.0 (approved personal library import validation)" },
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

const { parseTab4uHtml } = await import(`${project}/server/tab4u.ts`);
const { normalizeSongMetadata } = await import(`${project}/client/src/lib/songLibraryV2.ts`);
const requireFromProject = createRequire(`${project}/package.json`);
const mysql = requireFromProject("mysql2/promise");

const resolution = JSON.parse(await readFile(resolutionPath, "utf8"));
const resolvedByNumber = new Map(resolution.resolved.map((song) => [song.number, song]));
const requested = [
  ...resolution.resolved,
  ...resolution.unresolved.filter((song) => manualSourceOverrides[song.number]).map((song) => ({ ...song, sourceUrl: manualSourceOverrides[song.number] })),
].sort((a, b) => a.number - b.number);

const db = await mysql.createConnection(process.env.DATABASE_URL);
const [existingRows] = await db.query("SELECT sourceUrl, clientSongId FROM chordshift_songs WHERE libraryId = ?", [libraryId]);
const existingUrls = new Set(existingRows.map((row) => new URL(row.sourceUrl).toString()));
const existingClientIds = new Set(existingRows.map((row) => row.clientSongId).filter(Boolean));

const accepted = [];
const skipped = resolution.unresolved
  .filter((song) => !manualSourceOverrides[song.number])
  .map((song) => ({ number: song.number, artist: song.artist, title: song.title, status: "no_exact_source", detail: song.status }));

for (const requestedSong of requested) {
  const sourceUrl = new URL(requestedSong.sourceUrl).toString();
  const tab4uId = sourceUrl.match(/\/songs\/(\d+)_/)?.[1];
  if (!tab4uId) {
    skipped.push({ number: requestedSong.number, artist: requestedSong.artist, title: requestedSong.title, status: "invalid_source_url" });
    continue;
  }
  if (existingUrls.has(sourceUrl) || existingClientIds.has(`tab4u-${tab4uId}`)) {
    skipped.push({ number: requestedSong.number, artist: requestedSong.artist, title: requestedSong.title, sourceUrl, status: "duplicate_existing" });
    continue;
  }
  try {
    const html = await fetchTab4uHtml(sourceUrl);
    const parsed = parseTab4uHtml(html, sourceUrl);
    const parserMetadata = normalizeSongMetadata(parsed.title, parsed.artist);
    const pageMetadata = metadataFromTab4uPage(html);
    const metadata = pageMetadata || parserMetadata;
    const meaningfulLines = parsed.lines.filter((line) => line.chord.trim() || line.lyric.trim() || line.tab?.trim()).length;
    const requestedTitle = normalize(requestedSong.title);
    const parsedTitle = normalize(metadata.title);
    const requestedArtist = normalize(requestedSong.artist);
    const parsedArtist = normalize(metadata.artist);
    const titleMatches = requestedTitle === parsedTitle;
    const artistMatches = artistMatchesRequested(requestedArtist, parsedArtist);
    if (!metadata.title || !metadata.artist || !meaningfulLines) {
      skipped.push({ number: requestedSong.number, artist: requestedSong.artist, title: requestedSong.title, sourceUrl, status: "parse_failed", parsedTitle: metadata.title, parsedArtist: metadata.artist, meaningfulLines });
    } else if (!titleMatches || !artistMatches) {
      skipped.push({ number: requestedSong.number, artist: requestedSong.artist, title: requestedSong.title, sourceUrl, status: "metadata_mismatch", parsedTitle: metadata.title, parsedArtist: metadata.artist, titleMatches, artistMatches });
    } else {
      accepted.push({ number: requestedSong.number, artist: metadata.artist, title: metadata.title, sourceUrl, tab4uId, lineCount: meaningfulLines });
    }
  } catch (error) {
    skipped.push({ number: requestedSong.number, artist: requestedSong.artist, title: requestedSong.title, sourceUrl, status: "fetch_failed", detail: error instanceof Error ? error.message : String(error) });
  }
  await new Promise((resolve) => setTimeout(resolve, 200));
}

await mkdir(outputDir, { recursive: true });
for (let index = 0; index < accepted.length; index += 10) {
  const batchNumber = String(index / 10 + 1).padStart(3, "0");
  const songs = accepted.slice(index, index + 10).map(({ artist, title, sourceUrl, number }) => ({ artist, title, sourceUrl, requestedNumber: number }));
  await writeFile(`${manifestPrefix}${batchNumber}.json`, `${JSON.stringify({ songs }, null, 2)}\n`, "utf8");
}

const report = {
  generatedAt: new Date().toISOString(),
  libraryId,
  requestedCount: 100,
  selectedForValidation: requested.length,
  acceptedCount: accepted.length,
  skippedCount: skipped.length,
  accepted,
  skipped,
  manifestCount: Math.ceil(accepted.length / 10),
};
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
await db.end();
console.log(JSON.stringify({ selectedForValidation: requested.length, accepted: accepted.length, skipped: skipped.length, manifests: report.manifestCount, outputPath }, null, 2));
