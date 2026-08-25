export const SONG_CATEGORIES = [
  "שירי יום הזיכרון",
  "רוק ישראלי",
  "פופ ישראלי",
  "רוק לועזי",
  "פופ לועזי",
  "שירים שקטים",
] as const;

export type SongCategory = (typeof SONG_CATEGORIES)[number];

const israeliRockArtists = [
  "אבטיפוס", "אביב גפן", "אהוד בנאי", "איפה הילד", "אלג'יר", "אריאל זילבר",
  "ברי סחרוף", "ג'ירפות", "ג'ינג'יות", "דודו טסה", "החברים של נטאשה", "היהודים",
  "זקני צפת", "יהודה פוליקר", "כנסיית השכל", "כוורת", "מאיר בנאי", "מוניקה סקס",
  "מופע הארנבות של דוקטור קספר", "מרסדס בנד", "משינה", "נקמת הטרקטור", "נוער שוליים",
  "פורטיס", "רוקפור", "שלום חנוך", "שייגעצ", "תיסלם", "תמוז", "full trunk",
];

const foreignRockArtists = [
  "4 non blondes", "arctic monkeys", "blur", "bon jovi", "coldplay", "foo fighters",
  "green day", "guns n roses", "milky chance", "muse", "nirvana", "oasis", "pink floyd",
  "queen", "radiohead", "red hot chili peppers", "the beatles", "the killers", "u2",
];

const memorialSongTitles = [
  "אחי הצעיר יהודה", "אצלנו בגן", "אליפלט", "אנחנו שנינו מאותו הכפר", "ארץ צבי",
  "בלדה לחובש", "גבעת התחמושת", "דם המכבים", "החיטה צומחת שוב", "הנסיך הקטן",
  "הרעות", "חורף 73", "לו יהי", "מיליון כוכבים", "מה אברך", "פרי גנך",
  "שיר הרעות", "שום דבר לא יפגע בי", "אין לי ארץ אחרת",
];

const quietSongTitles = [
  "אצלך בעולם", "באת עם השקט", "דברים שרציתי לומר", "החיטה צומחת שוב", "לו יהי",
  "ממעמקים", "מיליון כוכבים", "מה אברך", "ניצוצות", "פרי גנך", "שער הרחמים",
  "שום דבר לא יפגע בי", "שושנים עצובות",
];

function normalize(value: string): string {
  return value
    .toLocaleLowerCase("he")
    .replace(/[׳’`]/g, "'")
    .replace(/[״“”]/g, '"')
    .replace(/[^a-zA-Z0-9א-ת' ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesArtist(artist: string, candidates: string[]): boolean {
  const normalized = normalize(artist);
  return candidates.some((candidate) => normalized.includes(normalize(candidate)));
}

export function normalizeSongCategories(categories: readonly string[] | undefined): SongCategory[] {
  const allowed = new Set<string>(SONG_CATEGORIES);
  return Array.from(new Set((categories ?? []).filter((category): category is SongCategory => allowed.has(category))));
}

/** Supplies useful defaults for old songs while preserving explicit categories. */
export function inferSongCategories(title: string, artist: string, explicit?: readonly string[]): SongCategory[] {
  const selected = normalizeSongCategories(explicit);
  // A non-empty explicit selection is a user-owned override. Empty or missing
  // metadata still receives useful defaults for older/imported songs.
  if (selected.length) return SONG_CATEGORIES.filter((category) => selected.includes(category));

  const categories = new Set<SongCategory>();
  const normalizedTitle = normalize(title);
  const isIsraeli = /[א-ת]/.test(`${title} ${artist}`) || includesArtist(artist, israeliRockArtists);

  if (isIsraeli) categories.add(includesArtist(artist, israeliRockArtists) ? "רוק ישראלי" : "פופ ישראלי");
  else categories.add(includesArtist(artist, foreignRockArtists) ? "רוק לועזי" : "פופ לועזי");

  if (memorialSongTitles.some((candidate) => normalizedTitle === normalize(candidate))) categories.add("שירי יום הזיכרון");
  if (quietSongTitles.some((candidate) => normalizedTitle === normalize(candidate))) categories.add("שירים שקטים");
  return SONG_CATEGORIES.filter((category) => categories.has(category));
}
