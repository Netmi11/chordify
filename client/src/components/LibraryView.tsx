import { useMemo, useState } from "react";
import { ArrowDownUp, ChevronDown, ChevronLeft, LibraryBig, Music2, Search, Trash2, X } from "lucide-react";
import { filterSongs, groupSongsByArtist } from "@/lib/librarySearch";
import { sortSongsForLibrary, type LibrarySort, type SavedSong } from "@/lib/songLibraryV2";
import { SONG_CATEGORIES, type SongCategory } from "@shared/songCategories";

function formatAddedAt(timestamp: number) {
  return new Intl.DateTimeFormat("he-IL", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(timestamp));
}

type LibraryViewProps = {
  songs: SavedSong[];
  onOpen: (song: SavedSong) => void;
  onDelete: (id: string) => void;
  onReturn: () => void;
  showReturn: boolean;
};

export function LibraryView(props: LibraryViewProps) {
  const { songs, onOpen, onDelete, onReturn, showReturn } = props;
  const [query, setQuery] = useState("");
  const [artist, setArtist] = useState("הכול");
  const [category, setCategory] = useState<"הכול" | SongCategory>("הכול");
  const [sortBy, setSortBy] = useState<LibrarySort>("addedAt");
  const [expandedArtist, setExpandedArtist] = useState<string | null>(null);

  const artists = useMemo(
    () => ["הכול", ...Array.from(new Set(songs.map((song) => song.artist).filter(Boolean))).sort((a, b) => a.localeCompare(b, "he"))],
    [songs],
  );
  const categories = SONG_CATEGORIES;

  const filtered = useMemo(() => {
    const byArtist = artist === "הכול" ? songs : songs.filter((song) => song.artist === artist);
    const byCategory = category === "הכול" ? byArtist : byArtist.filter((song) => song.categories?.includes(category));
    return sortSongsForLibrary(filterSongs(byCategory, query), sortBy);
  }, [artist, category, query, sortBy, songs]);

  const groupedArtists = useMemo(() => groupSongsByArtist(filtered), [filtered]);
  const artistInitials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const isFiltered = Boolean(query.trim()) || artist !== "הכול" || category !== "הכול";

  const clearFilters = () => {
    setQuery("");
    setArtist("הכול");
    setCategory("הכול");
    setExpandedArtist(null);
  };

  return (
    <main className="library-page">
      <section className="library-hero">
        <div>
          <p className="eyebrow"><LibraryBig size={14} /> הספרייה שלך</p>
          <h1>מה מנגנים היום?</h1>
          <p><strong>{songs.length}</strong> שירים זמינים גם ללא חיבור לאינטרנט.</p>
        </div>
        {showReturn && <button className="library-return" onClick={onReturn}>חזור לשיר האחרון <ChevronLeft size={17} /></button>}
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
        <div className="library-filter-group">
          <span className="library-filter-label">קטגוריות</span>
          <div className="category-filters">
            <button className={category === "הכול" ? "category-filter active" : "category-filter"} onClick={() => setCategory("הכול")} aria-pressed={category === "הכול"}>הכול</button>
            {categories.map((name) => <button key={name} className={category === name ? "category-filter active" : "category-filter"} onClick={() => setCategory(name)} aria-pressed={category === name}>{name}</button>)}
          </div>
        </div>
        <div className="library-filter-group">
          <span className="library-filter-label">אמנים</span>
          <div className="artist-filters">{artists.map((name) => <button key={name} className={artist === name ? "artist-filter active" : "artist-filter"} onClick={() => setArtist(name)} aria-pressed={artist === name}>{name}</button>)}</div>
        </div>
        {isFiltered && <div className="library-backup-note" aria-live="polite">נמצאו {filtered.length} מתוך {songs.length} שירים · <button type="button" onClick={clearFilters}>נקה סינון</button></div>}
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
                <button className="song-card-main" onClick={() => onOpen(song)} aria-label={`פתח את ${song.title}`}>
                  <div><h3>{song.title}</h3><div className="song-card-categories">{song.categories?.map((name) => <span key={name}>{name}</span>)}</div><time>{formatAddedAt(song.addedAt)}</time></div>
                  <ChevronLeft size={18} aria-hidden="true" />
                </button>
                <button className="delete-song" aria-label={`מחק את ${song.title}`} onClick={() => onDelete(song.id)}><Trash2 size={15} /></button>
              </article>)}</div>}
            </section>
          );
        })}
        {!filtered.length && <div className="library-empty"><Music2 size={26} /><h2>{songs.length ? "לא נמצאו שירים מתאימים" : "הספרייה עדיין ריקה"}</h2><p>{songs.length ? "נסה לחפש בשם אחר או לבחור אמן אחר." : "פתח שיר ב־Tab4U ושמור אותו לספרייה כדי לנגן גם באופליין."}</p>{songs.length ? <button onClick={clearFilters}>נקה חיפוש וסינון</button> : <button onClick={onReturn}>טעינת שיר חדש</button>}</div>}
      </section>
    </main>
  );
}
