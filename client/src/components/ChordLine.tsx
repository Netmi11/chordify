import React, { useLayoutEffect, useRef } from "react";
import { transposeChord } from "@/lib/chordEngine";

type ChordLineProps = {
  chord: string;
  shift: number;
  flats: boolean;
  className?: string;
  onEditChord?: (chordIndex: number, originalChord: string) => void;
};

export function ChordLine({ chord, shift, flats, className = "", onEditChord }: ChordLineProps) {
  let chordIndex = 0;
  const lineRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    // An RTL scroller uses zero as its visible right edge in Chromium. Reset
    // after every modulation so a wider replacement chord cannot remain hidden.
    if (lineRef.current) lineRef.current.scrollLeft = 0;
  }, [chord, flats, shift]);

  return (
    <div ref={lineRef} className={`chord-line ${className}`.trim()} dir="rtl" aria-label={`אקורדים אחרי שינוי של ${shift} חצאי טונים`}>
      <span className="chord-line-content" dir="ltr">
        {chord.split(/(\s+)/).map((part, index) => {
          if (!/^[A-G](?:#|b)?/.test(part)) return <span key={`${part}-${index}`}>{part}</span>;
          const currentIndex = chordIndex;
          chordIndex += 1;
          const displayed = transposeChord(part, shift, flats);

          return onEditChord ? (
            <button
              type="button"
              className="chord-mark chord-editable"
              key={`${part}-${index}`}
              onClick={() => onEditChord(currentIndex, part)}
              aria-label={`ערוך את האקורד ${displayed}`}
            >
              {displayed}
            </button>
          ) : (
            <span className="chord-mark" key={`${part}-${index}`}>{displayed}</span>
          );
        })}
      </span>
    </div>
  );
}
