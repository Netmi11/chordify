// @vitest-environment jsdom
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChordLine } from "./ChordLine";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("ChordLine", () => {
  it("anchors the scroll container in RTL while keeping chord text LTR", () => {
    const html = renderToStaticMarkup(<ChordLine chord="G   C#m7" shift={2} flats={false} />);

    expect(html).toContain('class="chord-line" dir="rtl"');
    expect(html).toContain('class="chord-line-content" dir="ltr"');
    expect(html).toContain("A");
    expect(html).toContain("D#m7");
  });

  it("returns the RTL scroll container to its right edge after modulation", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => root.render(<ChordLine chord="G   C#m7" shift={0} flats={false} />));
    const line = container.querySelector<HTMLDivElement>(".chord-line")!;
    line.scrollLeft = 42;

    act(() => root.render(<ChordLine chord="G   C#m7" shift={2} flats={false} />));

    expect(line.scrollLeft).toBe(0);
    act(() => root.unmount());
  });
});
