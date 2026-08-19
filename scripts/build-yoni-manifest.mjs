import { writeFile } from "node:fs/promises";

const songs = [
  [3067, "אחריות"],
  [67405, "לא קל לא פשוט"],
  [1605, "התקף לב קטן"],
  [3537, "הקנאה"],
  [1600, "מכיר אותו"],
  [3347, "נוף אחר"],
  [3348, "הרגלים רעים"],
  [1606, "אלוהים נחמדה"],
  [1604, "בחתונה של גרי"],
  [1597, "תפוזים"],
].map(([id, title]) => ({
  title,
  artist: "יוני בלוך",
  sourceUrl: `https://www.tab4u.com/tabs/songs/${id}_${encodeURIComponent(`יוני בלוך - ${title}`).replace(/%20/g, "_")}.html`,
}));

await writeFile(
  "server/import-manifests/approved-yoni-bloch-001.json",
  JSON.stringify({ batch: "approved-yoni-bloch-001", description: "עשרת השירים הראשונים שנמצאו מתוך הרשימה המאושרת של יוני בלוך", songs }, null, 2) + "\n",
);
