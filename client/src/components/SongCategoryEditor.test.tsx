// @vitest-environment jsdom
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SongCategoryEditor } from "./SongCategoryEditor";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("SongCategoryEditor", () => {
  it("renders every category and protects the final selected category", () => {
    const html = renderToStaticMarkup(
      <SongCategoryEditor categories={["רוק ישראלי"]} onChange={vi.fn()} />,
    );

    expect(html).toContain("עריכת קטגוריות השיר");
    expect(html).toContain("שירי יום הזיכרון");
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("disabled");
  });

  it("returns the exact manual selection when a category is toggled", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const onChange = vi.fn();
    act(() => root.render(
      <SongCategoryEditor categories={["רוק ישראלי", "שירים שקטים"]} onChange={onChange} />,
    ));

    const removeRock = container.querySelector<HTMLButtonElement>('[aria-label="הסר קטגוריה רוק ישראלי"]')!;
    act(() => removeRock.click());

    expect(onChange).toHaveBeenCalledWith(["שירים שקטים"]);
    act(() => root.unmount());
  });
});
