import { useMemo, useState } from "react";
import { ArrowDownUp, ChevronDown, ChevronRight, CloudDownload, Download, ExternalLink, KeyRound, LibraryBig, Music2, Search, Trash2, X } from "lucide-react";
import { filterSongs, groupSongsByArtist } from "@/lib/librarySearch";
import { sortSongsForLibrary, type LibrarySort, type SavedSong } from "@/lib/songLibraryV2";

function formatAddedAt(timestamp: number) {
  return new Intl.DateTimeFormat("he-IL", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(timestamp));
}

type LibraryViewProps = {
  songs: SavedSong[];
  onOpen: (song: SavedSong) => void;
  onExport: (song: SavedSong) => void;
  onDelete: (id: string) => void;
  onReturn: () => void;
  onExportBackup: () => void;
  onImportBackup: (file: File) => void;
  onShowCloudCode: () => void;
  onRestoreCloud: () => void;
  onSyncImported: () => void;
  isSyncing: boolean;
  cloudStatus: string;
  showReturn: boolean;
};

export function LibraryView(props: LibraryViewProps) {
  const { songs, onOpen, onExport, onDelete, onReturn, onExportBackup, onImportBackup, onShowCloudCode, onRestoreCloud, onSyncImported, isSyncing, cloudStatus, showReturn } = props;
  const [query, setQuery] = useState("");
  const [artist, setArtist] = useState("הכול");
  const [sortBy, setSortBy] = useState<LibrarySort>("addedAt");
  const [expandedArtist, setExpandedArtist] = useState<string | null>(null);

  const artists = useMemo(
    () => ["הכול", ...Array.from(new Set(songs.map((song) => song.artist).filter(Boolean))).sort((a, b) => a.localeCompare(b, "he"))],
    [songs],
  );

  const filtered = useMemo(() => {
    const byArtist = artist === "הכול" ? songs : songs.filter((song) => song.artist === artist);
    return sortSongsForLibrary(filterSongs(byArtist, query), sortBy);
  }, [artist, query, sortBy, songs]);

  const groupedArtists = useMemo(() => groupSongsByArtist(filtered), [filtered]);
  const artistInitials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const isFiltered = Boolean(query.trim()) || artist !== "הכול";

  const clearFilters = () => {
    setQuery("");
    setArtist("הכול");
    setExpandedArtist(null);
  };

  return (
    <main className="library-page">
      <section className="library-hero">
        <div>
          <p className="eyebrow"><LibraryBig size={14} /> הספרייה האישית</p>
          <h1>בחר אמן.<br /><em>התחל לנגן.</em></h1>
          <p>כל השירים נשמרים בטלפון וזמינים גם ללא חיבור.</p>
          <div className="library-summary"><strong>{songs.length}</strong><span>{songs.length === 1 ? "שיר שמור" : "שירים שמורים"}</span><i /></div>
        </div>
        {showReturn && <button className="library-return" onClick={onReturn}><ChevronRight size={17} /> חזור לשיר</button>}
      </section>

      <section className="library-controls" aria-label="חיפוש, מיון וסינון ספרייה">
        <div className="library-search-row">
          <label className="library-search">
            <Search size={17} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="חיפוש לפי שיר או אמן" aria-label="חיפוש בספריית השירים" />
            {query && <button type="button" onClick={() => setQuery("")} aria-label="נקה חיפוש"><X size={15} /></button>}
          </label>
          <label className="library-sort"><ArrowDownUp size={16} /><span>מיון</span><select value={sortBy} onChange={(event) => setSortBy(event.target.value as LibrarySort)} aria-label="מיין את השירים"><option value="addedAt">תאריך הוספה</option><option value="artist">שם האמן</option><option value="title">שם השיר</option></select></label>
        </div>
        <div className="artist-filters">{artists.map((name) => <button key={name} className={artist === name ? "artist-filter active" : "artist-filter"} onClick={() => setArtist(name)} aria-pressed={artist === name}>{name}</button>)}</div>
        {isFiltered && <div className="library-backup-note" aria-live="polite">נמצאו {filtered.length} מתוך {songs.length} שירים · <button type="button" onClick={clearFilters}>נקה סינון</button></div>}
        <details className="library-utilities">
          <summary>גיבוי וסנכרון</summary>
          <div className="library-backup-actions"><button onClick={onExportBackup}><Download size={15} /> גיבוי לספרייה</button><label><ExternalLink size={15} /> שחזור מקובץ<input type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) onImportBackup(file); event.currentTarget.value = ""; }} /></label></div>
          <div className="library-backup-actions"><button onClick={onShowCloudCode}><KeyRound size={15} /> קוד שחזור ענן</button><button onClick={onRestoreCloud}><CloudDownload size={15} /> שחזר מהענן</button><button onClick={onSyncImported} disabled={isSyncing}><CloudDownload size={15} /> {isSyncing ? "מסנכרן…" : "סנכרן מהענן"}</button></div>
          <p className="library-backup-note">{cloudStatus} · שמור את קוד השחזור במקום פרטי כדי שתוכל להחזיר את הספרייה לטלפון חדש.</p>
        </details>
      </section>

      <section className="library-grid" aria-live="polite">
        {groupedArtists.map(([artistName, artistSongs]) => {
          const isExpanded = expandedArtist === artistName;
          return (
            <section className={isExpanded ? "artist-group is-expanded" : "artist-group"} key={artistName}>
              <button className="artist-group-header" onClick={() => setExpandedArtist(isExpanded ? null : artistName)} aria-expanded={isExpanded} aria-label={`${isExpanded ? "סגור" : "פתח"} את שירי ${artistName}`}>
                <div className="artist-avatar" aria-hidden="true">{artistInitials(artistName) || "♪"}</div>
                <div className="artist-group-copy"><p className="artist-kicker">אמן</p><h2>{artistName}</h2><span>{artistSongs.length} {artistSongs.length === 1 ? "שיר — לחץ להצגה" : "שירים — לחץ להצגה"}</span></div>
                <ChevronDown className={isExpanded ? "artist-chevron is-open" : "artist-chevron"} size={19} aria-hidden="true" />
              </button>
              {isExpanded && <div className="artist-song-grid">{artistSongs.map((song) => <article className="song-card" key={song.id}>
                <div className="song-card-top"><span>מקור</span><button className="delete-song" aria-label={`מחק את ${song.title}`} onClick={() => onDelete(song.id)}><Trash2 size={15} /></button></div>
                <h3>{song.title}</h3>
                {song.note && <p className="song-card-note">{song.note}</p>}
                <footer><time>{formatAddedAt(song.addedAt)}</time><div className="song-card-actions"><button className="song-pdf-button" onClick={() => onExport(song)} aria-label={`הורד PDF של ${song.title}`}><Download size={14} /> PDF</button><button onClick={() => onOpen(song)}>פתח לנגינה <ChevronRight size={15} /></button></div></footer>
              </article>)}</div>}
            </section>
          );
        })}
        {!filtered.length && <div className="library-empty"><Music2 size={26} /><h2>{songs.length ? "לא נמצאו שירים מתאימים" : "הספרייה עדיין ריקה"}</h2><p>{songs.length ? "נסה לחפש בשם אחר או לבחור אמן אחר." : "פתח שיר ב־Tab4U ושמור אותו לספרייה כדי לנגן גם באופליין."}</p>{songs.length ? <button onClick={clearFilters}>נקה חיפוש וסינון</button> : <button onClick={onReturn}>טעינת שיר חדש</button>}</div>}
      </section>
    </main>
  );
}
