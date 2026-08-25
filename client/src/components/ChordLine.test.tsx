import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChordLine } from "./ChordLine";

describe("ChordLine", () => {
  it("anchors the scroll container in RTL while keeping chord text LTR", () => {
    const html = renderToStaticMarkup(<ChordLine chord="G   C#m7" shift={2} flats={false} />);

    expect(html).toContain('class="chord-line" dir="rtl"');
    expect(html).toContain('class="chord-line-content" dir="ltr"');
    expect(html).toContain("A");
    expect(html).toContain("D#m7");
  });
});
