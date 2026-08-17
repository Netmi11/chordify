import { readFile, writeFile } from "node:fs/promises";
import { parseTab4uHtml } from "../server/tab4u";

const songs = [
  ["3819", "הבלדה למחלקה להלבשה תחתונה", "https://www.tab4u.com/tabs/songs/3819_%D7%9E%D7%A8%D7%A1%D7%93%D7%A1_%D7%91%D7%A0%D7%93_-_%D7%94%D7%91%D7%9C%D7%93%D7%94_%D7%9C%D7%9E%D7%97%D7%9C%D7%A7%D7%94_%D7%9C%D7%94%D7%9C%D7%91%D7%A9%D7%94_%D7%AA%D7%97%D7%AA%D7%95%D7%A0%D7%94.html"],
  ["2037", "בואי ונביא לך ת'Fאנק", "https://www.tab4u.com/tabs/songs/2037_%D7%9E%D7%A8%D7%A1%D7%93%D7%A1_%D7%91%D7%A0%D7%93_-_%D7%91%D7%95%D7%90%D7%99_%D7%95%D7%A0%D7%91%D7%99%D7%90_%D7%9C%D7%9A_%D7%AA%26%2339%3BF%D7%90%D7%A0%D7%A7.html"],
  ["3851", "מלאך", "https://www.tab4u.com/tabs/songs/3851_%D7%9E%D7%A8%D7%A1%D7%93%D7%A1_%D7%91%D7%A0%D7%93_-_%D7%9E%D7%9C%D7%90%D7%9A.html"],
  ["2038", "את ואני", "https://www.tab4u.com/tabs/songs/2038_%D7%9E%D7%A8%D7%A1%D7%93%D7%A1_%D7%91%D7%A0%D7%93_-_%D7%90%D7%AA_%D7%95%D7%90%D7%A0%D7%99.html"],
  ["4640", "סופי", "https://www.tab4u.com/tabs/songs/4640_%D7%9E%D7%A8%D7%A1%D7%93%D7%A1_%D7%91%D7%A0%D7%93_-_%D7%A1%D7%95%D7%A4%D7%99.html"],
  ["3817", "תגידי לי את", "https://www.tab4u.com/tabs/songs/3817_%D7%9E%D7%A8%D7%A1%D7%93%D7%A1_%D7%91%D7%A0%D7%93_-_%D7%AA%D7%92%D7%99%D7%93%D7%99_%D7%9C%D7%99_%D7%90%D7%AA.html"],
  ["4632", "זהות", "https://www.tab4u.com/tabs/songs/4632_%D7%9E%D7%A8%D7%A1%D7%93%D7%A1_%D7%91%D7%A0%D7%93_-_%D7%96%D7%94%D7%95%D7%AA.html"],
  ["7680", "אור", "https://www.tab4u.com/tabs/songs/7680_%D7%9E%D7%A8%D7%A1%D7%93%D7%A1_%D7%91%D7%A0%D7%93_-_%D7%90%D7%95%D7%A8.html"],
  ["66537", "דאווינים", "https://www.tab4u.com/tabs/songs/66537_%D7%9E%D7%A8%D7%A1%D7%93%D7%A1_%D7%91%D7%A0%D7%93_-_%D7%93%D7%90%D7%95%D7%95%D7%99%D7%A0%D7%99%D7%9D.html"],
  ["4152", "אני משוגע", "https://www.tab4u.com/tabs/songs/4152_%D7%9E%D7%A8%D7%A1%D7%93%D7%A1_%D7%91%D7%A0%D7%93_-_%D7%90%D7%A0%D7%99_%D7%9E%D7%A9%D7%95%D7%92%D7%A2.html"],
] as const;

const output = [];
for (const [id, title, sourceUrl] of songs) {
  const html = await readFile(new URL(`../research/mercedes-html/${id}.html`, import.meta.url), "utf8");
  const parsed = parseTab4uHtml(html, sourceUrl);
  output.push({ id: `tab4u-${id}`, title, artist: "מרסדס בנד", sourceUrl, note: "", addedAt: Date.now(), lines: parsed.lines });
}
await writeFile(new URL("../research/mercedes-songs.json", import.meta.url), JSON.stringify(output, null, 2));
console.log(JSON.stringify(output.map((song) => ({ title: song.title, lines: song.lines.length })), null, 2));
