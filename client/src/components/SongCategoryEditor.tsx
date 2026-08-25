import React from "react";
import { Check, Tags } from "lucide-react";
import { SONG_CATEGORIES, type SongCategory } from "@shared/songCategories";

type SongCategoryEditorProps = {
  categories: readonly SongCategory[];
  onChange: (categories: SongCategory[]) => void;
};

export function SongCategoryEditor({ categories, onChange }: SongCategoryEditorProps) {
  const selected = new Set(categories);

  const toggleCategory = (category: SongCategory) => {
    const next = selected.has(category)
      ? categories.filter((value) => value !== category)
      : [...categories, category];
    if (!next.length) return;
    onChange(SONG_CATEGORIES.filter((value) => next.includes(value)));
  };

  return (
    <details className="song-category-editor">
      <summary>
        <span><Tags size={14} /> קטגוריות</span>
        <small>{categories.join(" · ")}</small>
      </summary>
      <div className="song-category-options" role="group" aria-label="עריכת קטגוריות השיר">
        {SONG_CATEGORIES.map((category) => {
          const isSelected = selected.has(category);
          const isOnlySelection = isSelected && categories.length === 1;
          return (
            <button
              type="button"
              key={category}
              className={isSelected ? "song-category-option selected" : "song-category-option"}
              aria-pressed={isSelected}
              aria-label={`${isSelected ? "הסר" : "הוסף"} קטגוריה ${category}`}
              disabled={isOnlySelection}
              onClick={() => toggleCategory(category)}
            >
              {isSelected && <Check size={13} aria-hidden="true" />}
              {category}
            </button>
          );
        })}
      </div>
      <p>השינויים נשמרים מיד ומסתנכרנים לענן. חייבת להישאר לפחות קטגוריה אחת.</p>
    </details>
  );
}
