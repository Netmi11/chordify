import { writeFile } from "node:fs/promises";

const songs = [
  [1601, "לוט"],
  [1602, "אם לא היום אז מחר"],
  [1609, "הפסיכולוגית"],
].map(([id, title]) => ({
  title,
  artist: "יוני בלוך",
  sourceUrl: `https://www.tab4u.com/tabs/songs/${id}_${encodeURIComponent(`יוני בלוך - ${title}`).replace(/%20/g, "_")}.html`,
}));

await writeFile(
  "server/import-manifests/approved-yoni-bloch-002.json",
  JSON.stringify({ batch: "approved-yoni-bloch-002", description: "שלושת השירים הנותרים עם מקור Tab4U מדויק", songs }, null, 2) + "\n",
);
