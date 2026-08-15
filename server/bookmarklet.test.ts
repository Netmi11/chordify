import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { BOOKMARKLET_SOURCE } from "../client/src/lib/bookmarkletSource";

describe("self-contained bookmarklet", () => {
  it("contains the Tab4U selectors and injected toolbar without external script loading", () => {
    expect(BOOKMARKLET_SOURCE).toContain("#songContentTPL");
    expect(BOOKMARKLET_SOURCE).toContain("chordshift-toolbar");
    expect(BOOKMARKLET_SOURCE).toContain("לא נמצא אזור השיר");
    expect(BOOKMARKLET_SOURCE).not.toContain("document.createElement('script')");
  });

  it("contains the +7 and reset controls", () => {
    expect(BOOKMARKLET_SOURCE).toContain("cs-seven");
    expect(BOOKMARKLET_SOURCE).toContain("shift = 7");
    expect(BOOKMARKLET_SOURCE).toContain("cs-reset");
    expect(BOOKMARKLET_SOURCE).toContain("shift = 0");
  });
});

describe("bookmarklet runtime", () => {
  it("injects the toolbar, transposes +7, resets, and preserves lyric rows", () => {
    const dom = new JSDOM(`<!doctype html><body><div id="songContentTPL"><div class="chords">Am Gm Am Fmaj7</div><div class="lyric">החלה הפלישה</div><div class="chords">Dmaj7</div><div class="lyric">תכיני תמיטה</div><div class="chords">Em7</div><div class="lyric">חכי לי אני בא</div></div></body>`, { runScripts: "outside-only" });
    dom.window.eval(BOOKMARKLET_SOURCE);
    const root = dom.window.document.querySelector("#songContentTPL")!;
    const toolbar = dom.window.document.querySelector("#chordshift-toolbar")!;
    expect(toolbar).toBeTruthy();
    expect(root.textContent).toContain("החלה הפלישה");
    expect(root.querySelectorAll(".lyric")).toHaveLength(3);
    (toolbar.querySelector(".cs-seven") as HTMLButtonElement).click();
    expect(root.textContent).toContain("Em Dm Em Cmaj7");
    expect(root.textContent).toContain("החלה הפלישה");
    (toolbar.querySelector(".cs-reset") as HTMLButtonElement).click();
    expect(root.textContent).toContain("Am Gm Am Fmaj7");
    expect(toolbar.querySelector(".cs-step")?.textContent).toBe("0");
    dom.window.close();
  });
});
