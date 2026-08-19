import { writeFile } from "node:fs/promises";

const songs = [
  [3675, "גשם"],
  [1878, "שירו של שפשף"],
  [1883, "וביניהם"],
  [4927, "מחפש את הכיוון"],
  [743, "דומינו"],
  [1881, "לב סדוק"],
  [1880, "אליה"],
  [3677, "מנגינת הנדודים"],
  [3676, "הגשם הראשון"],
  [4862, "לך אלי"],
  [3662, "כמה אהבה"],
].map(([id, title]) => ({
  title,
  artist: "מאיר בנאי",
  sourceUrl: `https://www.tab4u.com/tabs/songs/${id}_${encodeURIComponent(`מאיר בנאי - ${title === "לך אלי" ? "לך אלי תשוקתי" : title}`).replace(/%20/g, "_")}.html`,
}));

await writeFile(
  "server/import-manifests/approved-meir-banai-001.json",
  JSON.stringify({ batch: "approved-meir-banai-001", description: "עשרת המקורות הראשונים של מאיר בנאי שנמצאו ואומתו", songs: songs.slice(0, 10) }, null, 2) + "\n",
);
await writeFile(
  "server/import-manifests/approved-meir-banai-002.json",
  JSON.stringify({ batch: "approved-meir-banai-002", description: "מקור נוסף של מאיר בנאי שנמצא ואומת", songs: songs.slice(10) }, null, 2) + "\n",
);
