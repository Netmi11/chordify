import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, BookmarkPlus, CloudDownload, Download, ExternalLink, Eye, EyeOff, KeyRound, LibraryBig, Loader2, MoreHorizontal, Pencil, Play, Plus, RotateCcw, Sparkles, X } from "lucide-react";
import { ChordLine } from "@/components/ChordLine";
import { LibraryView } from "@/components/LibraryView";
import { useAutoScroll } from "@/hooks/useAutoScroll";
import { buildSongRenderBlocks, combineSongLines, getStartingKey, replaceChordToken, transposeChord } from "@/lib/chordEngine";
import { formatCloudRecoveryCode, getOrCreateCloudLibraryKey, parseCloudRecoveryCode, setCloudLibraryKey, type CloudLibraryKey } from "@/lib/libraryCloud";
import { makeSavedSong, parseSongBatchImport, parseSongImport, parseSongLibraryBackup, readSongLibrary, removeSong, serializeSongLibrary, type SavedSong, type SongLine, updateSongNote, upsertSong, writeSongLibrary } from "@/lib/songLibraryV2";
import { mergeLibraryForSync } from "@/lib/syncPolicy";
import { trpc } from "@/lib/trpc";

const demoSong: SongLine[] = [
  { label: "פתיחה", chord: "Am   Gm   Am   Fmaj7", lyric: "" },
  { label: "בית", chord: "Dmaj7", lyric: "החלה הפלישה" },
  { label: "", chord: "Dmaj7          Dmaj7", lyric: "תכיני תמיטה" },
  { label: "", chord: "Em7", lyric: "חכי לי אני בא" },
  { label: "", chord: "A7", lyric: "אני אתאפק   אני אתאפק   אני אתאפק" },
  { label: "", chord: "", lyric: "אני מבטיח לך" },
  { label: "פזמון", chord: "D", lyric: "אמוציונאלי ולא נורמאלית" },
  { label: "", chord: "D", lyric: "אני מוכרח לך את מוכרחה לי" },
  { label: "", chord: "Gmaj7", lyric: "כל כך הרבה זמן שלא הגעתי" },
  { label: "", chord: "A", lyric: "לא נתעסק בלהתרסק" },
];

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function formatAddedAt(timestamp: number) {
  return new Intl.DateTimeFormat("he-IL", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(timestamp));
}

export default function HomeV2() {
  const [shift, setShift] = useState(0);
  const [flats, setFlats] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [screen, setScreen] = useState<"player" | "library">("library");
  const [url, setUrl] = useState("https://www.tab4u.com/tabs/songs/75402_%D7%9E%D7%A8%D7%A1%D7%93%D7%A1_%D7%91%D7%A0%D7%93_-_%D7%9C%D7%94%D7%AA%D7%90%D7%A4%D7%A7.html");
  const [cleared, setCleared] = useState(false);
  const [library, setLibrary] = useState<SavedSong[]>([]);
  const [savedSong, setSavedSong] = useState<SavedSong | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [saveNotice, setSaveNotice] = useState(false);
  const [showChords, setShowChords] = useState(true);
  const [editingChords, setEditingChords] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [cloudKey, setCloudKey] = useState<CloudLibraryKey | null>(null);
  const [cloudReady, setCloudReady] = useState(false);
  const [cloudHydrated, setCloudHydrated] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [cloudStatus, setCloudStatus] = useState("הספרייה נשמרת בטלפון");
  const [, setHistoryVersion] = useState(0);

  const fetchSong = trpc.tab4u.fetchSong.useQuery({ url }, { enabled: false, retry: false });
  const cloudPush = trpc.librarySync.push.useMutation();
  const trpcUtils = trpc.useUtils();

  useAutoScroll(playing);

  useEffect(() => {
    const onPopState = () => {
      setScreen("library");
      setPlaying(false);
      setHistoryVersion((value) => value + 1);
    };
    window.history.replaceState({ chordshiftScreen: "library" }, "", window.location.href);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

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
        const next = writeSongLibrary(window.localStorage, [
          ...importedSongs,
          ...currentLibrary.filter((song) => !importedSongs.some((imported) => imported.sourceUrl === song.sourceUrl)),
        ]);
        setLibrary(next);
        setSavedSong(importedSongs[0] ?? null);
        setNoteDraft(importedSongs[0]?.note ?? "");
        setUrl(importedSongs[0]?.sourceUrl ?? "");
        window.history.pushState({ chordshiftScreen: "player" }, "", "#song");
        setHistoryVersion((value) => value + 1);
        setScreen("player");
        setSaveNotice(true);
        window.setTimeout(() => setSaveNotice(false), 2200);
        return;
      }

      const imported = parseSongImport(window.name);
      if (!imported) {
        setLibrary(currentLibrary);
        return;
      }
      window.name = "";
      const existing = currentLibrary.find((song) => song.sourceUrl === imported.song.sourceUrl);
      const song = makeSavedSong({ id: existing?.id, addedAt: existing?.addedAt, note: existing?.note, ...imported.song });
      setLibrary(upsertSong(window.localStorage, song));
      setSavedSong(song);
      setNoteDraft(song.note);
      setUrl(song.sourceUrl);
      window.history.pushState({ chordshiftScreen: "player" }, "", "#song");
      setHistoryVersion((value) => value + 1);
      setScreen("player");
      setSaveNotice(true);
      window.setTimeout(() => setSaveNotice(false), 2200);
    } catch {
      setLibrary([]);
    }
  }, []);

  useEffect(() => {
    setCloudKey(getOrCreateCloudLibraryKey(window.localStorage));
    setCloudReady(true);
  }, []);

  useEffect(() => {
    if (!cloudReady || !cloudKey) return;
    void trpcUtils.librarySync.pull.fetch(cloudKey)
      .then((cloudSongs) => {
        if (!cloudSongs.length) return;
        const cloudLibrary = cloudSongs.map((song) => makeSavedSong(song));
        const result = mergeLibraryForSync(library, cloudLibrary);
        if (!result.added && !result.updated) return;
        const restored = writeSongLibrary(window.localStorage, result.songs);
        setLibrary(restored);
        setCloudStatus(`סונכרנו ${result.added + result.updated} שירים מהענן`);
      })
      .catch(() => undefined)
      .finally(() => setCloudHydrated(true));
  }, [cloudKey, cloudReady]);

  useEffect(() => {
    if (!cloudReady || !cloudHydrated || !cloudKey || !navigator.onLine) return;
    const timer = window.setTimeout(() => {
      cloudPush.mutate(
        { libraryId: cloudKey.libraryId, secret: cloudKey.secret, songs: library },
        {
          onSuccess: () => setCloudStatus("מגובה בענן הפרטי שלך"),
          onError: () => setCloudStatus("נשמר בטלפון — הסנכרון ינסה שוב כשיש חיבור"),
        },
      );
    }, 450);
    return () => window.clearTimeout(timer);
  }, [cloudKey, cloudReady, cloudHydrated, library]);

  useEffect(() => {
    const onInstallAvailable = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => setInstallPrompt(null);
    window.addEventListener("beforeinstallprompt", onInstallAvailable);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onInstallAvailable);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const fetchedLines: SongLine[] = fetchSong.data?.lines?.map((line) => ({ label: line.section ?? "", chord: line.chord, lyric: line.lyric })) ?? [];
  const sourceLines = savedSong?.lines ?? (!cleared && fetchedLines.length ? fetchedLines : demoSong);
  const activeSong = useMemo(() => combineSongLines(sourceLines), [sourceLines]);
  const songBlocks = useMemo(() => buildSongRenderBlocks(sourceLines), [sourceLines]);
  const originalRoot = useMemo(() => getStartingKey(activeSong), [activeSong]);
  const keyLabel = useMemo(() => transposeChord(originalRoot, shift, flats), [originalRoot, shift, flats]);
  const activeTitle = savedSong?.title ?? (!cleared && fetchSong.data?.title ? fetchSong.data.title.replace(/^אקורדים לשיר\s*/i, "") : "להתאפק");
  const activeArtist = savedSong?.artist ?? (!cleared && fetchSong.data?.artist ? fetchSong.data.artist : "מרסדס בנד");
  const canSave = Boolean(savedSong || fetchSong.data?.title);

  const resetTranspose = () => {
    setShift(0);
    setFlats(false);
  };

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
    if (!imported.length) {
      window.alert("לא נמצא גיבוי תקין בקובץ.");
      return;
    }
    if (!window.confirm(`לשחזר ${imported.length} שירים מהגיבוי? השירים הקיימים יישמרו.`)) return;
    const result = mergeLibraryForSync(library, imported);
    const next = writeSongLibrary(window.localStorage, result.songs);
    setLibrary(next);
    setSavedSong(null);
    setScreen("library");
  };

  const showCloudRecoveryCode = async () => {
    if (!cloudKey) return;
    await navigator.clipboard?.writeText(formatCloudRecoveryCode(cloudKey));
    window.alert("קוד השחזור הועתק. שמור אותו ב־Notes או במנהל סיסמאות; בעזרתו אפשר לשחזר את הספרייה מהענן בטלפון חדש.");
  };

  const syncImportedLibrary = async () => {
    setIsSyncing(true);
    try {
      const cloudSongs = await trpcUtils.librarySync.catalog.fetch();
      const result = mergeLibraryForSync(library, cloudSongs.map((song) => makeSavedSong(song)));
      const next = writeSongLibrary(window.localStorage, result.songs);
      setLibrary(next);
      const changed = result.added + result.updated;
      setCloudStatus(changed ? `סונכרנו ${changed} שירים מהספרייה בענן` : "הספרייה כבר מעודכנת");
      window.alert(changed ? `נוספו ${result.added} ועודכנו ${result.updated} שירים. יש לך עכשיו ${next.length} שירים.` : `הספרייה כבר מעודכנת עם ${next.length} שירים.`);
    } catch {
      setCloudStatus("הסנכרון נכשל — נסה שוב עם חיבור לאינטרנט");
      window.alert("לא הצלחתי לסנכרן כרגע. בדוק את החיבור לאינטרנט ונסה שוב.");
    } finally {
      setIsSyncing(false);
    }
  };

  const restoreFromCloud = async () => {
    const raw = window.prompt("הדבק את קוד השחזור של הספרייה:");
    if (!raw) return;
    const key = parseCloudRecoveryCode(raw);
    if (!key) {
      window.alert("קוד השחזור אינו תקין.");
      return;
    }
    try {
      const cloudSongs = await trpcUtils.librarySync.pull.fetch(key);
      if (!cloudSongs.length) {
        window.alert("לא נמצאו שירים בספרייה הזו בענן.");
        return;
      }
      const result = mergeLibraryForSync(library, cloudSongs.map((song) => makeSavedSong(song)));
      const next = writeSongLibrary(window.localStorage, result.songs);
      setCloudLibraryKey(window.localStorage, key);
      setCloudKey(key);
      setLibrary(next);
      setCloudStatus(`שוחזרו ${next.length} שירים מהענן`);
      window.alert(`שוחזרו ${next.length} שירים מהענן בלי למחוק הערות מקומיות.`);
    } catch {
      window.alert("לא הצלחתי לשחזר מהענן. בדוק את הקוד ואת החיבור לאינטרנט.");
    }
  };

  const installApp = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    setInstallPrompt(null);
  };

  const persistCurrentSong = () => {
    if (!canSave) return;
    const existing = savedSong ?? library.find((song) => song.sourceUrl === url);
    const song = makeSavedSong({
      id: existing?.id,
      addedAt: existing?.addedAt,
      note: existing?.note ?? noteDraft,
      title: activeTitle,
      artist: activeArtist,
      sourceUrl: savedSong?.sourceUrl ?? url,
      lines: activeSong,
    });
    try {
      const next = upsertSong(window.localStorage, song);
      setLibrary(next);
      setSavedSong(song);
      setNoteDraft(song.note);
      setSaveNotice(true);
      window.setTimeout(() => setSaveNotice(false), 2200);
    } catch {
      window.alert("לא ניתן לשמור כרגע בטלפון הזה.");
    }
  };

  const openSavedSong = (song: SavedSong) => {
    setSavedSong(song);
    setNoteDraft(song.note);
    setUrl(song.sourceUrl);
    resetTranspose();
    setShowChords(true);
    setEditingChords(false);
    setPlaying(false);
    window.history.pushState({ chordshiftScreen: "player" }, "", "#song");
    setHistoryVersion((value) => value + 1);
    setScreen("player");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const returnToLibrary = () => {
    if (window.history.state?.chordshiftScreen === "player") window.history.back();
    else {
      setScreen("library");
      setPlaying(false);
    }
  };

  const deleteSavedSong = (id: string) => {
    if (!window.confirm("למחוק את השיר מהספרייה בטלפון הזה?")) return;
    try {
      const next = removeSong(window.localStorage, id);
      setLibrary(next);
      if (savedSong?.id === id) setSavedSong(null);
    } catch {
      window.alert("לא ניתן למחוק כרגע.");
    }
  };

  const saveNote = () => {
    if (!savedSong) return;
    try {
      const next = updateSongNote(window.localStorage, savedSong.id, noteDraft);
      setLibrary(next);
      setSavedSong(next.find((song) => song.id === savedSong.id) ?? savedSong);
    } catch {
      window.alert("לא ניתן לשמור את ההערה כרגע.");
    }
  };

  const editChordAt = (lineIndex: number, chordIndex: number, originalChord: string) => {
    if (!savedSong) return;
    const replacement = window.prompt(`החלף את ${originalChord} באקורד המקור הרצוי. התיקון נשמר רק בספרייה שלך.`, originalChord);
    if (replacement === null) return;
    const nextChord = replacement.trim();
    if (!nextChord || /\s/.test(nextChord) || !/^[A-G](?:#|b)?/.test(nextChord)) {
      window.alert("הזן אקורד אחד תקין, לדוגמה: C#m או Bbmaj7.");
      return;
    }
    const nextLines = savedSong.lines.map((line, index) => index === lineIndex ? { ...line, chord: replaceChordToken(line.chord, chordIndex, nextChord) } : { ...line });
    const nextSong = { ...savedSong, lines: nextLines };
    try {
      const nextLibrary = upsertSong(window.localStorage, nextSong);
      setLibrary(nextLibrary);
      setSavedSong(nextSong);
    } catch {
      window.alert("לא ניתן לשמור את תיקון האקורד כרגע.");
    }
  };

  const loadFromUrl = () => {
    setSavedSong(null);
    resetTranspose();
    setCleared(false);
    void fetchSong.refetch();
  };

  return (
    <div dir="rtl" className="app-shell">
      <header className="topbar">
        <div className="brand-lockup"><span className="brand-mark" aria-hidden="true">C</span><div><div className="brand-name">Chordify</div><div className="brand-caption">הספרייה שלך</div></div></div>
        <div className="topbar-actions">
          <span className="status-dot"><span /> {library.length} שירים</span>
          <button className="top-library-button" onClick={() => screen === "library" ? setScreen("player") : returnToLibrary()} aria-label={screen === "library" ? "הוסף שיר חדש" : "חזור לספרייה"}>{screen === "library" ? <Plus size={17} /> : <LibraryBig size={17} />} {screen === "library" ? "שיר חדש" : "הספרייה"}</button>
          <details className="app-menu">
            <summary aria-label="פתח תפריט נוסף"><MoreHorizontal size={20} /></summary>
            <div className="app-menu-panel">
              <div className="app-menu-heading"><strong>ניהול הספרייה</strong><span>{cloudStatus}</span></div>
              {installPrompt && <button onClick={() => void installApp()}><Plus size={15} /> התקן כאפליקציה</button>}
              <button onClick={exportLibraryBackup}><Download size={15} /> הורד קובץ גיבוי</button>
              <label><ExternalLink size={15} /> שחזר מקובץ<input type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importLibraryBackup(file); event.currentTarget.value = ""; }} /></label>
              <button onClick={() => void showCloudRecoveryCode()}><KeyRound size={15} /> העתק קוד שחזור</button>
              <button onClick={() => void restoreFromCloud()}><CloudDownload size={15} /> שחזר מהענן</button>
              <button onClick={() => void syncImportedLibrary()} disabled={isSyncing}><CloudDownload size={15} /> {isSyncing ? "מסנכרן…" : "סנכרן את קטלוג השירים"}</button>
            </div>
          </details>
        </div>
      </header>

      {screen === "library" ? (
        <LibraryView
          songs={library}
          onOpen={openSavedSong}
          onDelete={deleteSavedSong}
          onReturn={() => {
            if (savedSong) {
              window.history.pushState({ chordshiftScreen: "player" }, "", "#song");
              setHistoryVersion((value) => value + 1);
            }
            setScreen("player");
          }}
          showReturn={Boolean(savedSong)}
        />
      ) : (
        <main className={`workspace ${savedSong ? "workspace-song-only" : ""}`}>
          <section className={`control-rail ${savedSong ? "song-loaded-rail" : ""}`}>
            <div className="rail-copy"><p className="eyebrow"><Sparkles size={14} /> אוסף אישי</p><h1>שמור. ארגן.<br /><em>נגן.</em></h1><p className="intro">טען שיר מ־Tab4U, שמור את גרסת המקור שלו, וחזור אליו בכל זמן גם ללא חיבור.</p></div>
            <div className="url-entry">
              <label htmlFor="song-url">קישור לשיר</label>
              <div className="url-row"><input id="song-url" value={url} onChange={(event) => setUrl(event.target.value)} dir="ltr" /><button className="clear-url-button" onClick={() => { setUrl(""); setCleared(true); setSavedSong(null); resetTranspose(); }} aria-label="נקה קישור"><X size={16} /></button><button className="load-button" onClick={loadFromUrl} disabled={fetchSong.isFetching} aria-busy={fetchSong.isFetching}><span className={fetchSong.isFetching ? "loading-icon is-spinning" : "loading-icon"}>{fetchSong.isFetching ? <Loader2 size={16} /> : <ExternalLink size={16} />}</span> {fetchSong.isFetching ? "טוען…" : "טען"}</button></div>
              <p className="field-note" aria-live="polite">{fetchSong.isFetching ? "קורא את השיר ושומר את מיקום האקורדים והמילים…" : fetchSong.error ? "Tab4U חסם טעינה ישירה. פתח את השיר ב־Edge ולחץ בסרגל ChordShift על שמור בספרייה." : fetchSong.data ? "השיר נטען. אפשר לשמור את גרסת המקור בספרייה." : "הדרך היציבה: פתח שיר ב־Edge ולחץ בסרגל ChordShift על שמור בספרייה."}</p>
              <button className={saveNotice ? "save-song-button saved" : "save-song-button"} onClick={persistCurrentSong} disabled={!canSave}><BookmarkPlus size={16} /> {saveNotice ? "נשמר בספרייה" : "שמור בספרייה"}</button>
              <div className="bookmarklet-card"><strong>הפעלה ישירה בתוך Tab4U</strong><span>ב־Edge עם Tampermonkey, ChordShift מופיע אוטומטית בתוך דף השיר.</span><a className="userscript-link" href="/chordshift.user.js">התקן ChordShift ב־Tampermonkey</a></div>
            </div>
            <div className="shift-panel">
              <div className="panel-heading"><span>שינוי סולם זמני</span><strong>{shift > 0 ? `+${shift}` : shift} <small>חצאי טון</small></strong></div>
              <div className="shift-controls"><button className="shift-button" onClick={() => setShift((value) => value - 1)} aria-label="הורד חצי טון"><ArrowDown size={18} /><span>הורד</span></button><div className="key-display"><span>אקורד פתיחה</span><b>{keyLabel}</b></div><button className="shift-button" onClick={() => setShift((value) => value + 1)} aria-label="העלה חצי טון"><ArrowUp size={18} /><span>העלה</span></button></div>
              <div className="quick-shifts">{[-3, -2, -1, 0, 1, 2, 3].map((value) => <button key={value} className={shift === value ? "quick active" : "quick"} onClick={() => setShift(value)}>{value > 0 ? `+${value}` : value}</button>)}</div>
              <div className="shortcut-row"><button className={shift === 7 ? "shortcut-button active" : "shortcut-button"} onClick={() => setShift(7)}>+7</button><button className={shift === 0 ? "shortcut-button active" : "shortcut-button"} onClick={resetTranspose}><RotateCcw size={14} /> מקור</button></div>
              <div className="notation-row"><span>כתיבת אקורדים</span><button onClick={() => setFlats((value) => !value)} className="notation-toggle">{flats ? "♭ במולים" : "♯ דיאזים"}</button></div>
            </div>
            <div className="rail-footer"><button className="reset-button" onClick={resetTranspose}><RotateCcw size={14} /> חזור למקור</button><span>{library.length} שירים בספרייה</span></div>
          </section>

          <section className="song-stage">
            <div className="song-toolbar"><div className="song-meta"><span className="live-tag">{savedSong ? "LIBRARY" : "LIVE VIEW"}</span><div><h2>{activeTitle}</h2><p>{activeArtist} · {savedSong ? `נשמר ${formatAddedAt(savedSong.addedAt)}` : "Tab4U"}</p></div></div><div className="song-view-actions"><button className={showChords ? "song-view-toggle" : "song-view-toggle active"} onClick={() => { setShowChords((value) => !value); setEditingChords(false); }} aria-pressed={!showChords}>{showChords ? <EyeOff size={15} /> : <Eye size={15} />}{showChords ? "מילים בלבד" : "אקורדים"}</button>{savedSong && showChords && <button className={editingChords ? "song-edit-toggle active" : "song-edit-toggle"} onClick={() => setEditingChords((value) => !value)} aria-pressed={editingChords}><Pencil size={14} />{editingChords ? "סיום עריכה" : "ערוך אקורד"}</button>}</div></div>
            <div className="song-paper">
              <div className="paper-topline"><span>{showChords ? "אקורדים לשיר" : "מילים בלבד"}</span><span className="position-note">{showChords ? (shift === 0 ? "גרסת מקור" : `טרנספוזיציה ${shift > 0 ? "+" : ""}${shift}`) : "מצב קריאה"}</span></div>
              <article className={showChords ? "song-content" : "song-content lyrics-only"}>
                <div className="reading-guide" aria-hidden="true" />
                <div className="song-title">{activeTitle}</div>
                <div className="song-artist">{activeArtist}</div>
                {savedSong && <details className={`personal-note ${noteDraft.trim() ? "has-note" : ""}`}><summary><span>הערה אישית</span><span className="note-state">{noteDraft.trim() ? "נשמרה" : "הוספה"}</span></summary><div className="note-editor"><textarea value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} onBlur={saveNote} placeholder="לדוגמה: קאפו 2, פתיחה שקטה…" rows={3} /></div></details>}
                <div className="rule" />
                {songBlocks.map((block, index) => block.kind === "tab" ? (
                  showChords ? <section className={`tab-block ${block.label ? "section-row" : ""}`} key={`${block.tabs[0]}-${index}`} dir="ltr">{block.label && <div className="tab-section-label" dir="rtl">{block.label}:</div>}{block.chord && <ChordLine chord={block.chord} shift={shift} flats={flats} className="tab-chord-line" onEditChord={editingChords && block.chordSourceIndex !== null ? (chordIndex) => editChordAt(block.chordSourceIndex!, chordIndex, block.chord) : undefined} />}<div className="tab-sheet"><pre className="saved-tab-line">{block.tabs.join("\n")}</pre></div></section> : null
                ) : block.line.lyric ? (
                  <div className={`song-row ${block.line.label ? "section-row" : ""}`} key={`${block.line.lyric}-${index}`}>{block.line.label && <div className="section-label">{block.line.label}:</div>}{showChords && <ChordLine chord={block.line.chord} shift={shift} flats={flats} onEditChord={editingChords && savedSong ? (chordIndex, originalChord) => editChordAt(block.sourceIndex, chordIndex, originalChord) : undefined} />}<div className="lyric-line">{block.line.lyric}</div></div>
                ) : null)}
                <div className="end-marker">— סוף —</div>
              </article>
            </div>
          </section>
        </main>
      )}

      {screen === "player" && <nav className="mobile-dock" aria-label="פקדי נגינה בנייד"><button onClick={() => setShift((value) => value - 1)} aria-label="הורד חצי טון"><ArrowDown size={18} /><span>הורד</span></button><div className="mobile-key"><small>פתיחה</small><strong>{keyLabel}</strong></div><button onClick={() => setShift((value) => value + 1)} aria-label="העלה חצי טון"><ArrowUp size={18} /><span>העלה</span></button><button onClick={() => setShift(7)} aria-label="טרנספוזיציה פלוס שבע"><span>+7</span></button><button onClick={resetTranspose} aria-label="חזרה למקור"><RotateCcw size={17} /><span>מקור</span></button><button onClick={() => setPlaying((value) => !value)} className={playing ? "dock-active" : ""} aria-label="גלילה"><Play size={17} fill={playing ? "currentColor" : "none"} /><span>{playing ? "עצור" : "גלול"}</span></button></nav>}
    </div>
  );
}
