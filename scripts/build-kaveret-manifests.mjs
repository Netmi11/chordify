import { writeFile } from "node:fs/promises";

const songs = [
  [1053, "יו יה"],
  [1712, "המגפיים של ברוך"],
  [1717, "נתתי לה חיי"],
  [1730, "גוליית"],
  [1706, "שיר המכולת"],
  [1707, "ביום ובלילה"],
  [1710, "פה קבור הכלב"],
  [1713, "נחמד"],
  [1721, "הורה האחזות"],
  [1708, "שרות עצמי"],
  [69958, "סוף ההצגה"],
  [67790, "אינספקטור פיקח"],
].map(([id, title]) => ({
  title,
  artist: "כוורת",
  sourceUrl: `https://www.tab4u.com/tabs/songs/${id}_${encodeURIComponent(`כוורת - ${title}`).replace(/%20/g, "_")}.html`,
}));

await writeFile(
  "server/import-manifests/approved-kaveret-001.json",
  JSON.stringify({ batch: "approved-kaveret-001", description: "עשרת המקורות הראשונים של כוורת שנמצאו ואומתו", songs: songs.slice(0, 10) }, null, 2) + "\n",
);
await writeFile(
  "server/import-manifests/approved-kaveret-002.json",
  JSON.stringify({ batch: "approved-kaveret-002", description: "שני מקורות נוספים של כוורת שנמצאו ואומתו", songs: songs.slice(10) }, null, 2) + "\n",
);
