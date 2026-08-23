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

  return (
    <div className={`chord-line ${className}`.trim()} aria-label={`אקורדים אחרי שינוי של ${shift} חצאי טונים`}>
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
    </div>
  );
}
