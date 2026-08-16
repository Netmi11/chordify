import type { SongLine } from "./songLibraryV2";

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function printableRow(line: SongLine): string {
  const label = line.label ? `<div class="section">${escapeHtml(line.label)}</div>` : "";
  const chord = line.chord ? `<div class="chords" dir="ltr">${escapeHtml(line.chord)}</div>` : "";
  const tab = line.tab ? `<pre class="tab" dir="ltr">${escapeHtml(line.tab)}</pre>` : "";
  const lyric = `<div class="lyrics">${escapeHtml(line.lyric || " ")}</div>`;
  return `<section class="song-row">${label}${chord}${tab}${lyric}</section>`;
}

export function buildSongPdfHtml(song: { title: string; artist: string; lines: SongLine[] }): string {
  const safeTitle = escapeHtml(song.title);
  const safeArtist = escapeHtml(song.artist || "");
  const rows = song.lines.map(printableRow).join("");
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle} — ChordShift</title><style>@page{size:A4;margin:14mm}*{box-sizing:border-box}body{margin:0;color:#17233d;background:#fff;font-family:Arial,"Noto Sans Hebrew",sans-serif;line-height:1.55}.sheet{max-width:182mm;margin:auto}.brand{color:#008eb1;font:700 10px/1.2 Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase}.header{padding:0 0 11mm;border-bottom:2px solid #14bcd4;margin-bottom:10mm}.title{margin:4mm 0 1mm;font-size:28px;line-height:1.1;letter-spacing:-.04em}.artist{color:#61708c;font-size:14px}.song-row{position:relative;min-height:13mm;break-inside:avoid}.song-row+.song-row{margin-top:1mm}.section{padding-top:5mm;color:#cf257f;font-size:12px;font-weight:700}.chords{min-height:5mm;color:#008eb1;font-family:"Courier New",monospace;font-size:14px;font-weight:700;white-space:pre;text-align:right}.lyrics{min-height:6mm;font-size:15px;white-space:pre-wrap}.tab{margin:0 0 2mm;overflow:hidden;color:#6049d9;font:12px/1.42 "Courier New",monospace;white-space:pre;text-align:left;direction:ltr}.footer{margin-top:12mm;padding-top:4mm;border-top:1px solid #dbe3ef;color:#7b879c;font-size:9px;text-align:center}@media print{.sheet{max-width:none}}</style></head><body><main class="sheet"><header class="header"><div class="brand">ChordShift · Tab4U</div><h1 class="title">${safeTitle}</h1><div class="artist">${safeArtist}</div></header>${rows}<footer class="footer">נוצר לשימוש אישי ב־ChordShift</footer></main></body></html>`;
}

export function exportSongToPdf(song: { title: string; artist: string; lines: SongLine[] }): boolean {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return false;
  printWindow.opener = null;
  printWindow.document.write(buildSongPdfHtml(song));
  printWindow.document.close();
  window.setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 180);
  return true;
}
