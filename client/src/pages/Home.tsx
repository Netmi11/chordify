import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowDownUp, BookmarkPlus, ChevronRight, CloudDownload, Copy, Download, ExternalLink, KeyRound, LibraryBig, Loader2, Maximize2, Moon, Music2, Play, RotateCcw, Search, Sparkles, Sun, Trash2, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { BOOKMARKLET_SOURCE } from "@/lib/bookmarkletSource";
import { makeSavedSong, mergeCloudSongs, parseSongBatchImport, parseSongImport, parseSongLibraryBackup, readSongLibrary, removeSong, serializeSongLibrary, sortSongsForLibrary, type LibrarySort, type SavedSong, type SongLine, updateSongNote, upsertSong, writeSongLibrary } from "@/lib/songLibraryV2";
import { useTheme } from "@/contexts/ThemeContext";
import { exportSongToPdf } from "@/lib/songPdf";
import { formatCloudRecoveryCode, getOrCreateCloudLibraryKey, parseCloudRecoveryCode, setCloudLibraryKey, type CloudLibraryKey } from "@/lib/libraryCloud";

const sharpNotes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const flatNotes = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

const demoSong: SongLine[] = [
  { label: "פתיחה", chord: "Am   Gm   Am   Fmaj7", lyric: "" }, { label: "בית", chord: "Dmaj7", lyric: "החלה הפלישה" },
  { label: "", chord: "Dmaj7          Dmaj7", lyric: "תכיני תמיטה" }, { label: "", chord: "Em7", lyric: "חכי לי אני בא" },
  { label: "", chord: "A7", lyric: "אני אתאפק   אני אתאפק   אני אתאפק" }, { label: "", chord: "", lyric: "אני מבטיח לך" },
  { label: "פזמון", chord: "D", lyric: "אמוציונאלי ולא נורמאלית" }, { label: "", chord: "D", lyric: "אני מוכרח לך את מוכרחה לי" },
  { label: "", chord: "Gmaj7", lyric: "כל כך הרבה זמן שלא הגעתי" }, { label: "", chord: "A", lyric: "לא נתעסק בלהתרסק" },
];

export function transposeChord(chord: string, steps: number, flats: boolean) {
  return chord.replace(/([A-G](?:#|b)?)([^/\s]*)(?:\/([A-G](?:#|b)?))?/g, (_match, root: string, suffix: string, bass?: string) => {
    const source = root.includes("b") ? flatNotes : sharpNotes;
    const rootIndex = source.indexOf(root);
    if (rootIndex < 0) return _match;
    const output = flats ? flatNotes : sharpNotes;
    const shiftedRoot = output[(rootIndex + steps + 120) % 12];
    const shiftedBass = bass ? output[(source.indexOf(bass) + steps + 120) % 12] : "";
    return `${shiftedRoot}${suffix}${shiftedBass ? `/${shiftedBass}` : ""}`;
  });
}

export function combineSongLines(lines: SongLine[]) {
  const combined: SongLine[] = [];
  for (const line of lines) {
    const previous = combined[combined.length - 1];
    if (previous && !previous.lyric && previous.chord && !line.chord && line.lyric && !line.label) previous.lyric = line.lyric;
    else combined.push({ ...line });
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

function transposeChordLine(chord: string, shift: number, flats: boolean): string {
  return chord.split(/(\s+)/).map((part) => /[A-G](?:#|b)?/.test(part) ? transposeChord(part, shift, flats) : part).join("");
}

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

function formatAddedAt(timestamp: number) {
  return new Intl.DateTimeFormat("he-IL", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(timestamp));
}

function LibraryView({ songs, onOpen, onExport, onDelete, onReturn, onExportBackup, onImportBackup, onShowCloudCode, onRestoreCloud, cloudStatus }: { songs: SavedSong[]; onOpen: (song: SavedSong) => void; onExport: (song: SavedSong) => void; onDelete: (id: string) => void; onReturn: () => void; onExportBackup: () => void; onImportBackup: (file: File) => void; onShowCloudCode: () => void; onRestoreCloud: () => void; cloudStatus: string }) {
  const [query, setQuery] = useState("");
  const [artist, setArtist] = useState("הכול");
  const [sortBy, setSortBy] = useState<LibrarySort>("addedAt");
  const artists = useMemo(() => ["הכול", ...Array.from(new Set(songs.map((song) => song.artist).filter(Boolean))).sort((a, b) => a.localeCompare(b, "he"))], [songs]);
  const filtered = useMemo(() => {
    const matching = songs.filter((song) => (artist === "הכול" || song.artist === artist) && `${song.title} ${song.artist}`.toLowerCase().includes(query.trim().toLowerCase()));
    return sortSongsForLibrary(matching, sortBy);
  }, [artist, query, sortBy, songs]);

  return <main className="library-page">
    <section className="library-hero">
      <div><p className="eyebrow"><LibraryBig size={14} /> הספרייה האישית</p><h1>כל השירים שלך.<br /><em>תמיד מוכנים לנגינה.</em></h1><p>השירים נשמרים בטלפון הזה בלבד, בגרסת המקור שלהם, וזמינים גם ללא חיבור לאחר פתיחת האפליקציה פעם אחת.</p></div>
      <button className="library-return" onClick={onReturn}><ChevronRight size={17} /> חזור לשיר</button>
    </section>
    <section className="library-controls" aria-label="חיפוש, מיון וסינון ספרייה">
      <div className="library-search-row"><label className="library-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="חיפוש לפי שיר או אמן" /></label><label className="library-sort"><ArrowDownUp size={16} /><span>מיון</span><select value={sortBy} onChange={(event) => setSortBy(event.target.value as LibrarySort)} aria-label="מיין את השירים"><option value="addedAt">תאריך הוספה</option><option value="artist">שם האמן</option><option value="title">שם השיר</option></select></label></div>
      <div className="artist-filters">{artists.map((name) => <button key={name} className={artist === name ? "artist-filter active" : "artist-filter"} onClick={() => setArtist(name)}>{name}</button>)}</div>
      <div className="library-backup-actions"><button onClick={onExportBackup}><Download size={15} /> גיבוי לספרייה</button><label><ExternalLink size={15} /> שחזור מקובץ<input type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) onImportBackup(file); event.currentTarget.value = ""; }} /></label><a href="https://www.tab4u.com/tabs/artists/154_%D7%9E%D7%A8%D7%A1%D7%93%D7%A1_%D7%91%D7%A0%D7%93.html" target="_blank" rel="noreferrer"><Music2 size={15} /> ייבוא 10 מרסדס בנד</a></div><p className="library-backup-note">כדי להוסיף את עשרת השירים: פתח את עמוד האמן ב־Edge עם Tampermonkey מותקן ולחץ על העיגול „10”.</p>
      <div className="library-backup-actions"><button onClick={onShowCloudCode}><KeyRound size={15} /> קוד שחזור ענן</button><button onClick={onRestoreCloud}><CloudDownload size={15} /> שחזר מהענן</button></div><p className="library-backup-note">{cloudStatus} · שמור את קוד השחזור במקום פרטי כדי שתוכל להחזיר את הספרייה לטלפון חדש.</p>
    </section>
    <section className="library-grid" aria-live="polite">
      {filtered.map((song) => <article className="song-card" key={song.id}>
        <div className="song-card-top"><span>מקור</span><button className="delete-song" aria-label={`מחק את ${song.title}`} onClick={() => onDelete(song.id)}><Trash2 size={15} /></button></div>
        <h2>{song.title}</h2><p className="song-card-artist">{song.artist || "אמן לא צוין"}</p>
        {song.note && <p className="song-card-note">{song.note}</p>}
        <footer><time>{formatAddedAt(song.addedAt)}</time><div className="song-card-actions"><button className="song-pdf-button" onClick={() => onExport(song)} aria-label={`הורד PDF של ${song.title}`}><Download size={14} /> PDF</button><button onClick={() => onOpen(song)}>פתח לנגינה <ChevronRight size={15} /></button></div></footer>
      </article>)}
      {!filtered.length && <div className="library-empty"><Music2 size={26} /><h2>{songs.length ? "לא נמצאו שירים מתאימים" : "הספרייה עדיין ריקה"}</h2><p>{songs.length ? "נסה לחפש בשם אחר או לבחור אמן אחר." : "טען שיר מקישור Tab4U ולחץ על שמור בספרייה."}</p><button onClick={onReturn}>עבור לטעינת שיר</button></div>}
    </section>
  </main>;
}

export default function Home() {
  const { theme, toggleTheme } = useTheme();
  const [shift, setShift] = useState(0);
  const [flats, setFlats] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [readingMode, setReadingMode] = useState(false);
  const [screen, setScreen] = useState<"player" | "library">("player");
  const [url, setUrl] = useState("https://www.tab4u.com/tabs/songs/75402_%D7%9E%D7%A8%D7%A1%D7%93%D7%A1_%D7%91%D7%A0%D7%93_-_%D7%9C%D7%94%D7%AA%D7%90%D7%A4%D7%A7.html");
  const [cleared, setCleared] = useState(false);
  const [library, setLibrary] = useState<SavedSong[]>([]);
  const [savedSong, setSavedSong] = useState<SavedSong | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [saveNotice, setSaveNotice] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [cloudKey, setCloudKey] = useState<CloudLibraryKey | null>(null);
  const [cloudReady, setCloudReady] = useState(false);
  const [cloudHydrated, setCloudHydrated] = useState(false);
  const [cloudStatus, setCloudStatus] = useState("הספרייה נשמרת בטלפון");
  const fetchSong = trpc.tab4u.fetchSong.useQuery({ url }, { enabled: false, retry: false });
  const cloudPush = trpc.librarySync.push.useMutation();
  const trpcUtils = trpc.useUtils();

  useEffect(() => {
    try {
      const currentLibrary = readSongLibrary(window.localStorage);
      const batch = parseSongBatchImport(window.name);
      if (batch) {
        window.name = "";
        const importedSongs = batch.songs.map((imported) => {
          const existing = currentLibrary.find((song) => song.sourceUrl === imported.sourceUrl);
          return makeSavedSong({ id: existing?.id, addedAt: existing?.addedAt, note: existing?.note, ...imported });
        });
        const next = writeSongLibrary(window.localStorage, [...importedSongs, ...currentLibrary.filter((song) => !importedSongs.some((imported) => imported.sourceUrl === song.sourceUrl))]);
        setLibrary(next);
        setSavedSong(importedSongs[0] ?? null);
        setNoteDraft(importedSongs[0]?.note ?? "");
        setUrl(importedSongs[0]?.sourceUrl ?? "");
        setSaveNotice(true);
        window.setTimeout(() => setSaveNotice(false), 2200);
        return;
      }
      const imported = parseSongImport(window.name);
      if (!imported) { setLibrary(currentLibrary); return; }
      window.name = "";
      const existing = currentLibrary.find((song) => song.sourceUrl === imported.song.sourceUrl);
      const song = makeSavedSong({ id: existing?.id, addedAt: existing?.addedAt, note: existing?.note, ...imported.song });
      setLibrary(upsertSong(window.localStorage, song));
      setSavedSong(song);
      setNoteDraft(song.note);
      setUrl(song.sourceUrl);
      setSaveNotice(true);
      window.setTimeout(() => setSaveNotice(false), 2200);
    } catch { setLibrary([]); }
  }, []);
  useEffect(() => { if (!playing) return; const timer = window.setInterval(() => window.scrollBy({ top: 1, behavior: "auto" }), 55); return () => window.clearInterval(timer); }, [playing]);
  useEffect(() => { setCloudKey(getOrCreateCloudLibraryKey(window.localStorage)); setCloudReady(true); }, []);
  useEffect(() => {
    if (!cloudReady || !cloudKey) return;
    void trpcUtils.librarySync.pull.fetch(cloudKey).then((cloudSongs) => {
      if (cloudSongs.length) {
        const cloudLibrary = cloudSongs.map((song) => makeSavedSong(song));
        const merged = mergeCloudSongs(library, cloudLibrary);
        if (merged.length !== library.length) {
          const restored = writeSongLibrary(window.localStorage, merged);
          setLibrary(restored);
          setCloudStatus(`נוספו ${restored.length - library.length} שירים מהענן`);
        }
      }
    }).catch(() => undefined).finally(() => setCloudHydrated(true));
  }, [cloudKey, cloudReady]);
  useEffect(() => {
    if (!cloudReady || !cloudHydrated || !cloudKey || !navigator.onLine) return;
    const timer = window.setTimeout(() => cloudPush.mutate({ libraryId: cloudKey.libraryId, secret: cloudKey.secret, songs: library }, {
      onSuccess: () => setCloudStatus("מגובה בענן הפרטי שלך"),
      onError: () => setCloudStatus("נשמר בטלפון — הסנכרון ינסה שוב כשיש חיבור"),
    }), 450);
    return () => window.clearTimeout(timer);
  }, [cloudKey, cloudReady, cloudHydrated, library]);
  useEffect(() => {
    const onInstallAvailable = (event: Event) => { event.preventDefault(); setInstallPrompt(event as InstallPromptEvent); };
    const onInstalled = () => setInstallPrompt(null);
    window.addEventListener("beforeinstallprompt", onInstallAvailable);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onInstallAvailable); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  const fetchedLines: SongLine[] = fetchSong.data?.lines?.map((line) => ({ label: line.section ?? "", chord: line.chord, lyric: line.lyric })) ?? [];
  const sourceLines = savedSong?.lines ?? (!cleared && fetchedLines.length ? fetchedLines : demoSong);
  const activeSong = useMemo(() => combineSongLines(sourceLines), [sourceLines]);
  const originalRoot = useMemo(() => getStartingKey(activeSong), [activeSong]);
  const keyLabel = useMemo(() => transposeChord(originalRoot, shift, flats), [originalRoot, shift, flats]);
  const activeTitle = savedSong?.title ?? (!cleared && fetchSong.data?.title ? fetchSong.data.title.replace(/^אקורדים לשיר\s*/i, "") : "להתאפק");
  const activeArtist = savedSong?.artist ?? (!cleared && fetchSong.data?.artist ? fetchSong.data.artist : "מרסדס בנד");
  const canSave = Boolean(savedSong || fetchSong.data?.title);

  const resetTranspose = () => { setShift(0); setFlats(false); };
  const toggleFullscreen = async () => { if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.(); else await document.exitFullscreen?.(); };
  const copySong = async () => { await navigator.clipboard?.writeText(activeSong.map((line) => `${line.chord}\n${line.lyric}`).join("\n")); };
  const exportPdf = (song: { title: string; artist: string; lines: SongLine[] }, exportShift = 0) => {
    const opened = exportSongToPdf({ ...song, lines: song.lines.map((line) => ({ ...line, chord: transposeChordLine(line.chord, exportShift, flats) })) });
    if (!opened) window.alert("הדפדפן חסם פתיחת חלון ל־PDF. אפשר חלונות קופצים ונסה שוב.");
  };
  const exportCurrentSongPdf = () => exportPdf({ title: activeTitle, artist: activeArtist, lines: activeSong }, shift);
  const exportLibraryBackup = () => {
    const blob = new Blob([serializeSongLibrary(library)], { type: "application/json;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `chordshift-library-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  };
  const importLibraryBackup = async (file: File) => {
    const imported = parseSongLibraryBackup(await file.text());
    if (!imported.length) { window.alert("לא נמצא גיבוי תקין בקובץ."); return; }
    if (!window.confirm(`לשחזר ${imported.length} שירים מהגיבוי? השירים הקיימים יישמרו.`)) return;
    const merged = [...imported, ...library.filter((song) => !imported.some((item) => item.sourceUrl === song.sourceUrl))];
    const next = writeSongLibrary(window.localStorage, merged);
    setLibrary(next);
    setSavedSong(null);
    setScreen("library");
  };
  const showCloudRecoveryCode = async () => {
    if (!cloudKey) return;
    await navigator.clipboard?.writeText(formatCloudRecoveryCode(cloudKey));
    window.alert("קוד השחזור הועתק. שמור אותו ב־Notes או במנהל סיסמאות; בעזרתו אפשר לשחזר את הספרייה מהענן בטלפון חדש.");
  };
  const restoreFromCloud = async () => {
    const raw = window.prompt("הדבק את קוד השחזור של הספרייה:");
    if (!raw) return;
    const key = parseCloudRecoveryCode(raw);
    if (!key) { window.alert("קוד השחזור אינו תקין."); return; }
    try {
      const cloudSongs = await trpcUtils.librarySync.pull.fetch(key);
      if (!cloudSongs.length) { window.alert("לא נמצאו שירים בספרייה הזו בענן."); return; }
      const next = writeSongLibrary(window.localStorage, cloudSongs.map((song) => makeSavedSong(song)));
      setCloudLibraryKey(window.localStorage, key);
      setCloudKey(key);
      setLibrary(next);
      setCloudStatus(`שוחזרו ${next.length} שירים מהענן`);
      window.alert(`שוחזרו ${next.length} שירים מהענן.`);
    } catch { window.alert("לא הצלחתי לשחזר מהענן. בדוק את הקוד ואת החיבור לאינטרנט."); }
  };
  const bookmarkletUrl = `javascript:${BOOKMARKLET_SOURCE.replace(/\s+/g, " ")}`;
  const copyBookmarklet = async () => { await navigator.clipboard?.writeText(bookmarkletUrl); };
  const installApp = async () => { if (!installPrompt) return; await installPrompt.prompt(); setInstallPrompt(null); };

  const persistCurrentSong = () => {
    if (!canSave) return;
    const existing = savedSong ?? library.find((song) => song.sourceUrl === url);
    const song = makeSavedSong({ id: existing?.id, addedAt: existing?.addedAt, note: existing?.note ?? noteDraft, title: activeTitle, artist: activeArtist, sourceUrl: savedSong?.sourceUrl ?? url, lines: activeSong });
    try {
      const next = upsertSong(window.localStorage, song);
      setLibrary(next); setSavedSong(song); setNoteDraft(song.note); setSaveNotice(true); window.setTimeout(() => setSaveNotice(false), 2200);
    } catch { window.alert("לא ניתן לשמור כרגע בטלפון הזה."); }
  };
  const openSavedSong = (song: SavedSong) => { setSavedSong(song); setNoteDraft(song.note); setUrl(song.sourceUrl); resetTranspose(); setPlaying(false); setReadingMode(false); setScreen("player"); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const deleteSavedSong = (id: string) => { if (!window.confirm("למחוק את השיר מהספרייה בטלפון הזה?")) return; try { const next = removeSong(window.localStorage, id); setLibrary(next); if (savedSong?.id === id) setSavedSong(null); } catch { window.alert("לא ניתן למחוק כרגע."); } };
  const saveNote = () => { if (!savedSong) return; try { const next = updateSongNote(window.localStorage, savedSong.id, noteDraft); setLibrary(next); setSavedSong(next.find((song) => song.id === savedSong.id) ?? savedSong); } catch { window.alert("לא ניתן לשמור את ההערה כרגע."); } };

  const loadFromUrl = () => { setSavedSong(null); resetTranspose(); setCleared(false); void fetchSong.refetch(); };

  return <div dir="rtl" className={`app-shell ${readingMode ? "is-reading" : ""}`}>
    <header className="topbar"><div className="brand-lockup"><img src="/manus-storage/stage-slate-pick-mark_6b2a5d37.png" alt="" className="brand-mark" /><div><div className="brand-name">ChordShift</div><div className="brand-caption">הספרייה הפרטית שלך</div></div></div><div className="topbar-actions"><span className="status-dot"><span /> נשמר בטלפון</span>{installPrompt && <button className="install-app-button" onClick={() => void installApp()}>התקן כאפליקציה</button>}<button className="top-library-button" onClick={() => { setReadingMode(false); setScreen(screen === "library" ? "player" : "library"); }}><LibraryBig size={17} /> {screen === "library" ? "שיר נוכחי" : "הספרייה"}</button><button className="theme-toggle" onClick={toggleTheme} aria-label={theme === "dark" ? "עבור למצב יום" : "עבור למצב לילה"} title={theme === "dark" ? "מצב יום" : "מצב לילה"}>{theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}</button></div></header>
    {screen === "library" ? <LibraryView songs={library} onOpen={openSavedSong} onExport={(song) => exportPdf(song)} onDelete={deleteSavedSong} onReturn={() => setScreen("player")} onExportBackup={exportLibraryBackup} onImportBackup={importLibraryBackup} onShowCloudCode={() => void showCloudRecoveryCode()} onRestoreCloud={() => void restoreFromCloud()} cloudStatus={cloudStatus} /> : <main className="workspace">
      <section className="control-rail"><div className="rail-copy"><p className="eyebrow"><Sparkles size={14} /> אוסף אישי</p><h1>שמור. ארגן.<br /><em>נגן.</em></h1><p className="intro">טען שיר מ־Tab4U, שמור את גרסת המקור שלו, וחזור אליו בכל זמן גם ללא חיבור.</p></div>
        <div className="url-entry"><label htmlFor="song-url">קישור לשיר</label><div className="url-row"><input id="song-url" value={url} onChange={(event) => setUrl(event.target.value)} dir="ltr" /><button className="clear-url-button" onClick={() => { setUrl(""); setCleared(true); setSavedSong(null); resetTranspose(); }} aria-label="נקה קישור"><X size={16} /></button><button className="load-button" onClick={loadFromUrl} disabled={fetchSong.isFetching} aria-busy={fetchSong.isFetching}><span className={fetchSong.isFetching ? "loading-icon is-spinning" : "loading-icon"}>{fetchSong.isFetching ? <Loader2 size={16} /> : <ExternalLink size={16} />}</span> {fetchSong.isFetching ? "טוען…" : "טען"}</button></div><p className="field-note" aria-live="polite">{fetchSong.isFetching ? "קורא את השיר ושומר את מיקום האקורדים והמילים…" : fetchSong.error ? "Tab4U חסם טעינה ישירה. פתח את השיר ב־Edge ולחץ בסרגל ChordShift על שמור בספרייה." : fetchSong.data ? "השיר נטען. אפשר לשמור את גרסת המקור בספרייה." : "הדרך היציבה: פתח שיר ב־Edge ולחץ בסרגל ChordShift על שמור בספרייה."}</p><button className={saveNotice ? "save-song-button saved" : "save-song-button"} onClick={persistCurrentSong} disabled={!canSave}><BookmarkPlus size={16} /> {saveNotice ? "נשמר בספרייה" : "שמור בספרייה"}</button><div className="bookmarklet-card"><strong>הפעלה ישירה בתוך Tab4U</strong><span>ב־Edge עם Tampermonkey, ChordShift מופיע אוטומטית בתוך דף השיר.</span><a className="userscript-link" href="/chordshift.user.js">התקן ChordShift ב־Tampermonkey</a></div></div>
        <div className="shift-panel"><div className="panel-heading"><span>שינוי סולם זמני</span><strong>{shift > 0 ? `+${shift}` : shift} <small>חצאי טון</small></strong></div><div className="shift-controls"><button className="shift-button" onClick={() => setShift((value) => value - 1)} aria-label="הורד חצי טון"><ArrowDown size={18} /><span>הורד</span></button><div className="key-display"><span>אקורד פתיחה</span><b>{keyLabel}</b></div><button className="shift-button" onClick={() => setShift((value) => value + 1)} aria-label="העלה חצי טון"><ArrowUp size={18} /><span>העלה</span></button></div><div className="quick-shifts">{[-3, -2, -1, 0, 1, 2, 3].map((value) => <button key={value} className={shift === value ? "quick active" : "quick"} onClick={() => setShift(value)}>{value > 0 ? `+${value}` : value}</button>)}</div><div className="shortcut-row"><button className={shift === 7 ? "shortcut-button active" : "shortcut-button"} onClick={() => setShift(7)}>+7</button><button className={shift === 0 ? "shortcut-button active" : "shortcut-button"} onClick={resetTranspose}><RotateCcw size={14} /> מקור</button></div><div className="notation-row"><span>כתיבת אקורדים</span><button onClick={() => setFlats((value) => !value)} className="notation-toggle">{flats ? "♭ במולים" : "♯ דיאזים"}</button></div></div>
        <div className="rail-footer"><button className="reset-button" onClick={resetTranspose}><RotateCcw size={14} /> חזור למקור</button><span>{library.length} שירים בספרייה</span></div>
      </section>
      <section className="song-stage"><div className="song-toolbar"><div className="song-meta"><span className="live-tag">{savedSong ? "LIBRARY" : "LIVE VIEW"}</span><div><h2>{activeTitle}</h2><p>{activeArtist} · {savedSong ? `נשמר ${formatAddedAt(savedSong.addedAt)}` : "Tab4U"}</p></div></div><div className="song-tools"><button onClick={() => setReadingMode((value) => !value)} className={readingMode ? "tool active-tool" : "tool"}><Music2 size={15} /> {readingMode ? "יציאה מנגינה" : "מצב נגינה"}</button><button onClick={() => setPlaying((value) => !value)} className={playing ? "tool active-tool" : "tool"}><Play size={15} fill={playing ? "currentColor" : "none"} /> {playing ? "עצור" : "גלילה"}</button><button onClick={toggleFullscreen} className="tool"><Maximize2 size={15} /> מסך מלא</button><button onClick={copySong} className="tool"><Copy size={15} /> העתק</button><button onClick={exportCurrentSongPdf} className="tool song-pdf-tool"><Download size={15} /> PDF</button></div></div>
        <div className="song-paper"><div className="paper-topline"><span>אקורדים לשיר</span><span className="position-note">{shift === 0 ? "גרסת מקור" : `טרנספוזיציה ${shift > 0 ? "+" : ""}${shift}`}</span></div><article className="song-content"><div className="reading-guide" aria-hidden="true" /><div className="song-title">{activeTitle}</div><div className="song-artist">{activeArtist}</div>{savedSong && <label className="personal-note"><span>הערה אישית</span><textarea value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} onBlur={saveNote} placeholder="לדוגמה: קאפו 2, פתיחה שקטה…" rows={2} /></label>}<div className="rule" />{activeSong.map((line, index) => <div className={`song-row ${line.label ? "section-row" : ""}`} key={`${line.lyric}-${index}`}>{line.label && <div className="section-label">{line.label}:</div>}<ChordLine chord={line.chord} shift={shift} flats={flats} />{line.tab && <pre className="saved-tab-line">{line.tab}</pre>}<div className="lyric-line">{line.lyric || "\u00A0"}</div></div>)}<div className="end-marker">— סוף —</div></article></div>
      </section>
    </main>}
    {screen === "player" && <nav className="mobile-dock" aria-label="פקדי נגינה בנייד"><button onClick={() => setShift((value) => value - 1)} aria-label="הורד חצי טון"><ArrowDown size={18} /><span>הורד</span></button><div className="mobile-key"><small>פתיחה</small><strong>{keyLabel}</strong></div><button onClick={() => setShift((value) => value + 1)} aria-label="העלה חצי טון"><ArrowUp size={18} /><span>העלה</span></button><button onClick={() => setShift(7)} aria-label="טרנספוזיציה פלוס שבע"><span>+7</span></button><button onClick={resetTranspose} aria-label="חזרה למקור"><RotateCcw size={17} /><span>מקור</span></button><button onClick={exportCurrentSongPdf} aria-label="הורד את השיר כ־PDF"><Download size={17} /><span>PDF</span></button><button onClick={() => setPlaying((value) => !value)} className={playing ? "dock-active" : ""} aria-label="גלילה"><Play size={17} fill={playing ? "currentColor" : "none"} /><span>{playing ? "עצור" : "גלול"}</span></button></nav>}
  </div>;
}
