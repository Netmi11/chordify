import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { BOOKMARKLET_SOURCE } from "../client/src/lib/bookmarkletSource";

describe("self-contained bookmarklet", () => {
  it("contains the Tab4U selectors and injected toolbar without external script loading", () => {
    expect(BOOKMARKLET_SOURCE).toContain("songContentTPL");
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

  it("uses a compact 26px launcher while retaining the full control panel", () => {
    expect(BOOKMARKLET_SOURCE).toContain("width:26px;height:26px");
    expect(BOOKMARKLET_SOURCE).toContain(".cs-panel");
  });
});

describe("bookmarklet runtime", () => {
  it("injects the toolbar, transposes +7, resets, and preserves lyric rows", () => {
    const dom = new JSDOM(`<!doctype html><body><div id="songContentTPL"><div class="chords">Am Gm Am Fmaj7</div><div class="lyric">החלה הפלישה</div><div class="chords">Dmaj7</div><div class="lyric">תכיני תמיטה</div><div class="chords">Em7</div><div class="lyric">חכי לי אני בא</div></div></body>`, { runScripts: "outside-only", url: "https://www.tab4u.com/tabs/songs/test.html" });
    dom.window.eval(BOOKMARKLET_SOURCE);
    const root = dom.window.document.querySelector("#songContentTPL")!;
    const toolbar = dom.window.document.querySelector("#chordshift-toolbar")!;
    expect(toolbar).toBeTruthy();
    expect(toolbar.classList.contains("cs-open")).toBe(false);
    (toolbar.querySelector(".cs-launcher") as HTMLButtonElement).click();
    expect(toolbar.classList.contains("cs-open")).toBe(true);
    expect(toolbar.dataset.side).toBe("left");
    (toolbar.querySelector(".cs-side") as HTMLButtonElement).click();
    expect(toolbar.dataset.side).toBe("right");
    expect(dom.window.localStorage.getItem("chordshift-side")).toBe("right");
    expect(root.textContent).toContain("החלה הפלישה");
    expect(root.querySelectorAll(".lyric")).toHaveLength(3);
    (toolbar.querySelector(".cs-seven") as HTMLButtonElement).click();
    expect(root.textContent).toContain("Em Dm Em Cmaj7");
    expect(root.textContent).toContain("החלה הפלישה");
    (toolbar.querySelector(".cs-reset") as HTMLButtonElement).click();
    expect(root.textContent).toContain("Am Gm Am Fmaj7");
    expect(toolbar.querySelector(".cs-step")?.textContent).toBe("0");
    (toolbar.querySelector(".cs-close") as HTMLButtonElement).click();
    expect(toolbar.classList.contains("cs-open")).toBe(false);
    dom.window.close();
  });

  it("keeps tablature opt-in, shifts valid fret numbers, preserves line widths, and resets safely", () => {
    const originalTab = "e|-9---|\nB|-0-2-10-|";
    const dom = new JSDOM(`<!doctype html><body><div id="songContentTPL"><div class="chords">Am</div><table><tbody><tr><td class="tabs">e|-9---|</td></tr><tr><td class="tabs">B|-0-2-10-|</td></tr></tbody></table><div class="lyric">מילים נשארות</div></div></body>`, { runScripts: "outside-only", url: "https://www.tab4u.com/tabs/songs/tab-test.html" });
    dom.window.eval(BOOKMARKLET_SOURCE);

    const root = dom.window.document.querySelector("#songContentTPL")!;
    const toolbar = dom.window.document.querySelector("#chordshift-toolbar")!;
    const tabCells = [...root.querySelectorAll<HTMLTableCellElement>("td.tabs")];
    const tabButton = toolbar.querySelector<HTMLButtonElement>(".cs-tabs")!;

    expect(tabButton.textContent).toBe("טאבים: כבוי");
    (toolbar.querySelector(".cs-seven") as HTMLButtonElement).click();
    expect(tabCells.map(cell => cell.textContent).join("\n")).toBe(originalTab);

    tabButton.click();
    expect(tabButton.textContent).toBe("טאבים: פעיל");
    expect(tabCells[0]?.textContent).toBe("e|-16--|");
    expect(tabCells[0]?.textContent).toHaveLength("e|-9---|".length);
    expect(tabCells[1]?.textContent).toBe("B|-7-9-17-|");
    expect(root.textContent).toContain("מילים נשארות");

    (toolbar.querySelector(".cs-reset") as HTMLButtonElement).click();
    expect(tabCells.map(cell => cell.textContent).join("\n")).toBe(originalTab);

    (toolbar.querySelector(".cs-minus") as HTMLButtonElement).click();
    expect(tabCells[1]?.textContent).toContain("B|-0-1-9");
    expect(tabCells[1]?.textContent).not.toContain("B|--1");
    dom.window.close();
  });
});
