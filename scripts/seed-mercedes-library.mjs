import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";

const libraryId = "2c41a12f-5f5a-4bd1-9f99-460299c9793d";
const songs = JSON.parse(await readFile(new URL("../research/mercedes-songs.json", import.meta.url), "utf8"));

const connection = await mysql.createConnection(process.env.DATABASE_URL);
try {
  await connection.beginTransaction();
  for (const song of songs) {
    await connection.execute(
      `INSERT INTO chordshift_songs (libraryId, clientSongId, title, artist, sourceUrl, note, addedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE title = VALUES(title), artist = VALUES(artist), sourceUrl = VALUES(sourceUrl), note = VALUES(note), addedAt = VALUES(addedAt)`,
      [libraryId, song.id, song.title, song.artist, song.sourceUrl, song.note, song.addedAt],
    );
    const [[storedSong]] = await connection.execute(
      "SELECT id FROM chordshift_songs WHERE libraryId = ? AND clientSongId = ? LIMIT 1",
      [libraryId, song.id],
    );
    await connection.execute("DELETE FROM chordshift_song_lines WHERE songId = ?", [storedSong.id]);
    if (song.lines.length) {
      await connection.query(
        "INSERT INTO chordshift_song_lines (songId, position, label, chord, lyric, tab) VALUES ?",
        [song.lines.map((line, position) => [storedSong.id, position, line.section ?? null, line.chord, line.lyric, line.tab ?? null])],
      );
    }
  }
  await connection.commit();
  console.log(JSON.stringify({ libraryId, added: songs.length, titles: songs.map((song) => song.title) }));
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  await connection.end();
}
