import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Copy, ExternalLink, Loader2, Maximize2, Play, RotateCcw, Settings2, Sparkles, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { BOOKMARKLET_SOURCE } from "@/lib/bookmarkletSource";

const sharpNotes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const flatNotes = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

const demoSong = [
  { label: "פתיחה", chord: "Am   Gm   Am   Fmaj7", lyric: "" }, { label: "בית", chord: "Dmaj7", lyric: "החלה הפלישה" },
  { label: "", chord: "Dmaj7          Dmaj7", lyric: "תכיני תמיטה" }, { label: "", chord: "Em7", lyric: "חכי לי אני בא" },
  { label: "", chord: "A7", lyric: "אני אתאפק   אני אתאפק   אני אתאפק" }, { label: "", chord: "", lyric: "אני מבטיח לך" },
  { label: "", chord: "Dmaj7", lyric: "נתחיל בלחישה" }, { label: "", chord: "Dmaj7", lyric: "נמשיך בנשיכה" },
  { label: "", chord: "Em7", lyric: "אל מעבר לבושה" }, { label: "", chord: "A7", lyric: "אני אתאפק   אני אתאפק   אני אתאפק" },
  { label: "", chord: "", lyric: "אני אוהב אותך" }, { label: "פזמון", chord: "D", lyric: "אמוציונאלי ולא נורמאלית" },
  { label: "", chord: "D", lyric: "אני מוכרח לך את מוכרחה לי" }, { label: "", chord: "Gmaj7", lyric: "כל כך הרבה זמן שלא הגעתי" },
  { label: "", chord: "A", lyric: "לא נתעסק בלהתרסק" }, { label: "", chord: "", lyric: "לא נתעסק בלהתרסק" },
  { label: "", chord: "", lyric: "אני מבטיח לך" }, { label: "מעבר", chord: "D   D   Gmaj7   A", lyric: "" }, { label: "", chord: "Dmaj7", lyric: "אני מבטיח לך" },
];

export function transposeChord(chord: string, steps: number, flats: boolean) {
  return chord.replace(/([A-G](?:#|b)?)([^/\s]*)(?:\/([A-G](?:#|b)?))?/g, (_match, root: string, suffix: string, bass?: string) => {
    const source = root.includes("b") ? flatNotes : sharpNotes;
    const rootIndex = source.indexOf(root); if (rootIndex < 0) return _match;
    const output = flats ? flatNotes : sharpNotes;
    const shiftedRoot = output[(rootIndex + steps + 120) % 12];
    const shiftedBass = bass ? output[(source.indexOf(bass) + steps + 120) % 12] : "";
    return `${shiftedRoot}${suffix}${shiftedBass ? `/${shiftedBass}` : ""}`;
  });
}

export function combineSongLines(lines: Array<{ label?: string; chord: string; lyric: string }>) {
  const combined: Array<{ label?: string; chord: string; lyric: string }> = [];
  for (const line of lines) {
    const previous = combined[combined.length - 1];
    if (previous && !previous.lyric && previous.chord && !line.chord && line.lyric && !line.label) {
      previous.lyric = line.lyric;
    } else {
      combined.push({ ...line });
    }
  }
  return combined;
}

export function getStartingKey(lines: Array<{ chord: string }>) {
  const firstChord = lines.flatMap((line) => line.chord.match(/[A-G](?:#|b)?[^\s]*/g) ?? [])[0];
  if (!firstChord) return "D";
  const match = firstChord.match(/^([A-G](?:#|b)?)(m(?!aj))?/i);
  return match ? `${match[1]}${match[2] ?? ""}` : firstChord;
}

function ChordLine({ chord, shift, flats }: { chord: string; shift: number; flats: boolean }) {
  return <div className="chord-line" aria-label={`אקורדים אחרי שינוי של ${shift} חצאי טונים`}>
    {chord.split(/(\s+)/).map((part, index) => /[A-G](?:#|b)?/.test(part) ? <span className="chord-mark" key={`${part}-${index}`}>{transposeChord(part, shift, flats)}</span> : <span key={`${part}-${index}`}>{part}</span>)}
  </div>;
}

export default function Home() {
  const [shift, setShift] = useState(0); const [flats, setFlats] = useState(false); const [playing, setPlaying] = useState(false); const [url, setUrl] = useState("https://www.tab4u.com/tabs/songs/75402_%D7%9E%D7%A8%D7%A1%D7%93%D7%A1_%D7%91%D7%A0%D7%93_-_%D7%9C%D7%94%D7%AA%D7%90%D7%A4%D7%A7.html"); const [loaded, setLoaded] = useState(true); const [cleared, setCleared] = useState(false); const [bookmarkCopied, setBookmarkCopied] = useState(false);
  const fetchSong = trpc.tab4u.fetchSong.useQuery({ url }, { enabled: false, retry: false });
  const rawSong = fetchSong.data?.lines?.map((line) => ({ label: line.section ?? "", chord: line.chord, lyric: line.lyric })) ?? demoSong;
  const activeSong = useMemo(() => combineSongLines(cleared ? demoSong : rawSong), [cleared, fetchSong.data]);
  const originalRoot = useMemo(() => getStartingKey(activeSong), [activeSong]);
  const keyLabel = useMemo(() => transposeChord(originalRoot, shift, flats), [originalRoot, shift, flats]);
  const activeTitle = !cleared && fetchSong.data?.title ? fetchSong.data.title.replace(/^אקורדים לשיר\s*/i, "") : "להתאפק"; const activeArtist = !cleared && fetchSong.data?.artist ? fetchSong.data.artist : "מרסדס בנד";

  useEffect(() => { if (!playing) return; const timer = window.setInterval(() => window.scrollBy({ top: 1, behavior: "auto" }), 55); return () => window.clearInterval(timer); }, [playing]);
  const toggleFullscreen = async () => { if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.(); else await document.exitFullscreen?.(); };
  const copySong = async () => { await navigator.clipboard?.writeText(activeSong.map((line) => `${line.chord}\n${line.lyric}`).join("\n")); };
  const bookmarkletUrl = `javascript:${encodeURIComponent(BOOKMARKLET_SOURCE.replace(/\s+/g, " "))}`;
  const copyBookmarklet = async () => { await navigator.clipboard?.writeText(bookmarkletUrl); setBookmarkCopied(true); window.setTimeout(() => setBookmarkCopied(false), 2400); };

  return <div dir="rtl" className="app-shell">
    <header className="topbar"><div className="brand-lockup"><img src="/manus-storage/stage-slate-pick-mark_6b2a5d37.png" alt="" className="brand-mark" /><div><div className="brand-name">ChordShift</div><div className="brand-caption">כלי נגינה ל־Tab4U</div></div></div><div className="topbar-actions"><span className="status-dot"><span /> מוכן לנגינה</span><button className="icon-button" aria-label="הגדרות"><Settings2 size={18} /></button></div></header>
    <main className="workspace">
      <section className="control-rail"><div className="rail-copy"><p className="eyebrow"><Sparkles size={14} /> שלב ראשון</p><h1>בחר סולם.<br /><em>נגן.</em></h1><p className="intro">שינוי מהיר של שמות האקורדים, בלי לשנות את מיקום ההחלפה בשיר.</p></div>
        <div className="url-entry"><label htmlFor="song-url">קישור לשיר</label><div className="url-row"><input id="song-url" value={url} onChange={(event) => setUrl(event.target.value)} dir="ltr" /><button className="clear-url-button" onClick={() => { setUrl(""); setCleared(true); setLoaded(true); setShift(0); setFlats(false); }} disabled={!url && cleared} aria-label="נקה קישור"><X size={16} /></button><button className="load-button" onClick={() => { setCleared(false); setShift(0); setFlats(false); void fetchSong.refetch(); setLoaded(true); }} disabled={fetchSong.isFetching} aria-busy={fetchSong.isFetching}><span className={fetchSong.isFetching ? "loading-icon is-spinning" : "loading-icon"}>{fetchSong.isFetching ? <Loader2 size={16} /> : <ExternalLink size={16} />}</span> {fetchSong.isFetching ? "טוען את השיר…" : "טען"}</button></div><p className="field-note" aria-live="polite">{fetchSong.isFetching ? "קורא את השיר מ־Tab4U ושומר את מיקום האקורדים והמילים…" : fetchSong.error ? "לא הצלחתי לקרוא את הדף. אפשר להמשיך עם תצוגת ההדגמה." : fetchSong.data ? "השיר נטען מהקישור. מיקומי האקורדים והמילים נשמרו." : "אפשר לטעון קישור של Tab4U; תצוגת הדגמה זמינה מיד."}</p><div className="bookmarklet-card"><strong>קיצור להפעלה בתוך Tab4U</strong><span>שמור את הקיצור כסימנייה, פתח שיר ב־Tab4U ולחץ עליו כדי להציג סרגל צף.</span><button type="button" onClick={copyBookmarklet}>{bookmarkCopied ? "הועתק — הדבק בסימנייה" : "העתק קיצור להתקנה"}</button><details className="bookmarklet-help"><summary>איך מתקינים בטלפון?</summary><p>1. לחץ על העתק קיצור להתקנה.</p><p>2. פתח Chrome, שמור סימנייה כלשהי, ואז ערוך אותה.</p><p>3. החלף את כתובת הסימנייה בקיצור שהועתק ושמור בשם ChordShift.</p><p>4. פתח שיר ב־Tab4U, פתח את הסימניות ולחץ על ChordShift.</p></details></div></div>
        <div className="shift-panel"><div className="panel-heading"><span>שינוי סולם</span><strong>{shift > 0 ? `+${shift}` : shift} <small>חצאי טון</small></strong></div><div className="shift-controls"><button className="shift-button" onClick={() => setShift((value) => value - 1)} aria-label="הורד חצי טון"><ArrowDown size={18} /><span>הורד</span></button><div className="key-display"><span>אקורד פתיחה</span><b>{keyLabel}</b></div><button className="shift-button" onClick={() => setShift((value) => value + 1)} aria-label="העלה חצי טון"><ArrowUp size={18} /><span>העלה</span></button></div><div className="quick-shifts">{[-3, -2, -1, 0, 1, 2, 3].map((value) => <button key={value} className={shift === value ? "quick active" : "quick"} onClick={() => setShift(value)}>{value > 0 ? `+${value}` : value}</button>)}</div><div className="shortcut-row" aria-label="קיצורי טרנספוזיציה"><button className={shift === 7 ? "shortcut-button active" : "shortcut-button"} onClick={() => setShift(7)}>+7</button><button className={shift === 0 ? "shortcut-button active" : "shortcut-button"} onClick={() => { setShift(0); setFlats(false); }}><RotateCcw size={14} /> חזרה למקור</button></div><div className="notation-row"><span>כתיבת אקורדים</span><button onClick={() => setFlats((value) => !value)} className="notation-toggle">{flats ? "♭ במולים" : "♯ דיאזים"}</button></div></div>
        <div className="rail-footer"><button className="reset-button" onClick={() => { setShift(0); setFlats(false); }}><RotateCcw size={14} /> חזור למקור</button><span>שמירה מקומית בלבד</span></div>
      </section>
      <section className="song-stage"><div className="song-toolbar"><div className="song-meta"><span className="live-tag">LIVE VIEW</span><div><h2>{loaded ? activeTitle : "עדיין לא נטען"}</h2><p>{activeArtist} · Tab4U</p></div></div><div className="song-tools"><button onClick={() => setPlaying((value) => !value)} className={playing ? "tool active-tool" : "tool"}><Play size={15} fill={playing ? "currentColor" : "none"} /> {playing ? "עצור" : "גלילה"}</button><button onClick={toggleFullscreen} className="tool"><Maximize2 size={15} /> מסך מלא</button><button onClick={copySong} className="tool"><Copy size={15} /> העתק</button></div></div>
        <div className="song-paper"><div className="paper-topline"><span>אקורדים לשיר</span><span className="position-note">המיקום נשמר · {shift === 0 ? "מקור" : `טרנספוזיציה ${shift > 0 ? "+" : ""}${shift}`}</span></div><article className="song-content"><div className="reading-guide" aria-hidden="true" /><div className="song-title">{activeTitle}</div><div className="song-artist">{activeArtist}</div><div className="rule" />{activeSong.map((line, index) => <div className={`song-row ${line.label ? "section-row" : ""}`} key={`${line.lyric}-${index}`}>{line.label && <div className="section-label">{line.label}:</div>}<ChordLine chord={line.chord} shift={shift} flats={flats} /><div className="lyric-line">{line.lyric || "\u00A0"}</div></div>)}<div className="end-marker">— סוף —</div></article></div>
      </section>
    </main>
    <nav className="mobile-dock" aria-label="פקדי נגינה בנייד"><button onClick={() => setShift((value) => value - 1)} aria-label="הורד חצי טון"><ArrowDown size={18} /><span>הורד</span></button><div className="mobile-key"><small>פתיחה</small><strong>{keyLabel}</strong></div><button onClick={() => setShift((value) => value + 1)} aria-label="העלה חצי טון"><ArrowUp size={18} /><span>העלה</span></button><button onClick={() => setShift(7)} aria-label="טרנספוזיציה פלוס שבע"><span>+7</span></button><button onClick={() => { setShift(0); setFlats(false); }} aria-label="חזרה למקור"><RotateCcw size={17} /><span>מקור</span></button><button onClick={() => setPlaying((value) => !value)} className={playing ? "dock-active" : ""} aria-label="גלילה"><Play size={17} fill={playing ? "currentColor" : "none"} /><span>{playing ? "עצור" : "גלול"}</span></button><button onClick={toggleFullscreen} aria-label="מסך מלא"><Maximize2 size={17} /><span>מלא</span></button></nav>
    <button className="mobile-reset" onClick={() => { setShift(0); setFlats(false); }} aria-label="איפוס"><RotateCcw size={16} /></button>
  </div>;
}
