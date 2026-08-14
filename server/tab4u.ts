export type Tab4uSongLine = {
  section?: string;
  chord: string;
  lyric: string;
};

export type Tab4uSong = {
  title: string;
  artist: string;
  sourceUrl: string;
  lines: Tab4uSongLine[];
};

const TAB4U_HOSTS = new Set(["www.tab4u.com", "tab4u.com"]);

export function assertTab4uUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || !TAB4U_HOSTS.has(url.hostname)) {
    throw new Error("ניתן לקרוא כרגע רק קישורים מאובטחים של Tab4U");
  }
  return url;
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function cleanText(value: string, trim = true) {
  const text = decodeHtml(value.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "")).replace(/\r/g, "");
  return trim ? text.trim() : text;
}

function parseTableRows(fragment: string): Tab4uSongLine[] {
  const lines: Tab4uSongLine[] = [];
  const rows = fragment.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  for (const row of rows) {
    const cells = row.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi)?.map((cell) => cleanText(cell, false)) ?? [];
    if (cells.length < 2) continue;
    const [first, second] = cells;
    const firstTrimmed = first.trim();
    const section = firstTrimmed.endsWith(":") && !/[A-G](?:#|b)?[a-z0-9+\-/]*$/i.test(firstTrimmed) ? firstTrimmed.replace(/:$/, "") : undefined;
    const chord = section ? second : first;
    const lyric = section ? "" : second;
    lines.push({ section, chord, lyric });
  }
  return lines;
}

function parseFallbackRows(fragment: string): Tab4uSongLine[] {
  return fragment
    .split(/<br\s*\/?>/gi)
    .map((line) => cleanText(line))
    .map((line) => ({ chord: "", lyric: line }));
}

export function parseTab4uHtml(html: string, sourceUrl: string): Tab4uSong {
  const contentMatch = html.match(/<div[^>]+id=["']songContentTPL["'][^>]*>([\s\S]*?)<\/div>/i);
  if (!contentMatch) throw new Error("לא נמצא אזור השיר בדף Tab4U");
  const fragment = contentMatch[1];
  const title = cleanText(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "שיר");
  const artist = cleanText(html.match(/(?:מרסדס בנד|מבצע\s*:)[\s\S]{0,80}/i)?.[0] ?? "Tab4U").replace(/מחבר ומלחין:[\s\S]*/i, "").trim();
  const lines = parseTableRows(fragment);
  return { title, artist, sourceUrl, lines: lines.length ? lines : parseFallbackRows(fragment) };
}

export async function fetchTab4uSong(rawUrl: string): Promise<Tab4uSong> {
  const url = assertTab4uUrl(rawUrl);
  const response = await fetch(url, {
    headers: { "User-Agent": "ChordShift/1.0 (personal music utility)" },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Tab4U החזיר שגיאה ${response.status}`);
  const html = await response.text();
  return parseTab4uHtml(html, url.toString());
}
