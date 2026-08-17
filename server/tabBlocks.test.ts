import { describe, expect, it } from "vitest";
import { buildSongRenderBlocks } from "../client/src/pages/Home";

describe("buildSongRenderBlocks", () => {
  it("joins legacy Tab4U string lines into one continuous six-string block", () => {
    const blocks = buildSongRenderBlocks([
      { label: "פתיחה ובבתים", chord: "", lyric: "" },
      { chord: "Gm        Cm               x6", lyric: "" },
      { chord: "", lyric: "e|----------5-6-5-------------|" },
      { chord: "", lyric: "B|-3--3--3--4----4------------|" },
      { chord: "", lyric: "G|3--3--3-5-5-----5-----------|" },
      { chord: "", lyric: "D|--5--5----------------------|" },
      { chord: "", lyric: "A|----------------------------|" },
      { chord: "", lyric: "E|----------------------------|" },
      { chord: "", lyric: "חשבתי שאני האחד..." },
    ]);

    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({
      kind: "tab",
      label: "פתיחה ובבתים",
      chord: "Gm        Cm               x6",
      tabs: [
        "e|----------5-6-5-------------|",
        "B|-3--3--3--4----4------------|",
        "G|3--3--3-5-5-----5-----------|",
        "D|--5--5----------------------|",
        "A|----------------------------|",
        "E|----------------------------|",
      ],
    });
    expect(blocks[1]).toMatchObject({ kind: "line", line: { lyric: "חשבתי שאני האחד..." } });
  });

  it("keeps already-parsed tab data in the same continuous block", () => {
    const blocks = buildSongRenderBlocks([
      { chord: "Cm", lyric: "" },
      { chord: "", lyric: "", tab: "e|--8--8-----------------8--------|" },
      { chord: "", lyric: "", tab: "B|-8--8-8---10-11-10-------8------|" },
    ]);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      kind: "tab",
      chord: "Cm",
      tabs: ["e|--8--8-----------------8--------|", "B|-8--8-8---10-11-10-------8------|"],
    });
  });
});
