import { describe, expect, it } from "vitest";
import { inferSongCategories, normalizeSongCategories } from "./songCategories";

describe("song categories", () => {
  it("classifies Israeli and international rock artists", () => {
    expect(inferSongCategories("גג", "ג׳ירפות")).toContain("רוק ישראלי");
    expect(inferSongCategories("Mr Brightside", "The Killers")).toContain("רוק לועזי");
  });

  it("adds memorial and quiet categories without losing the genre", () => {
    expect(inferSongCategories("אין לי ארץ אחרת", "גלי עטרי")).toEqual([
      "שירי יום הזיכרון",
      "פופ ישראלי",
    ]);
    expect(inferSongCategories("מיליון כוכבים", "עמית פרקש")).toEqual([
      "שירי יום הזיכרון",
      "פופ ישראלי",
      "שירים שקטים",
    ]);
  });

  it("drops unknown category values and keeps explicit categories unique", () => {
    expect(normalizeSongCategories(["רוק ישראלי", "לא קיים", "רוק ישראלי"])).toEqual(["רוק ישראלי"]);
  });
});
