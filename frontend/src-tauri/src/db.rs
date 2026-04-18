use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")] // Match frontend format
pub struct CachedSong {
    pub video_id: String,
    pub title: String,
    pub artist: String,
    pub lrc_path: String,
    pub instrumental_path: String,
    pub missing_lyrics: bool,
    pub timestamp: i64,
}

pub fn init_db(db_path: &str) -> Result<Connection> {
    let conn = Connection::open(db_path)?;
    conn.execute(
        "CREATE TABLE IF NOT EXISTS cached_songs (
            videoId TEXT PRIMARY KEY,
            title TEXT,
            artist TEXT,
            lrcPath TEXT,
            instrumentalPath TEXT,
            missingLyrics INTEGER DEFAULT 0,
            timestamp INTEGER
        )",
        [],
    )?;
    Ok(conn)
}

pub fn get_song(conn: &Connection, video_id: &str) -> Result<Option<CachedSong>> {
    let mut stmt = conn.prepare("SELECT videoId, title, artist, lrcPath, instrumentalPath, missingLyrics, timestamp FROM cached_songs WHERE videoId = ?")?;
    let mut rows = stmt.query(params![video_id])?;

    if let Some(row) = rows.next()? {
        Ok(Some(CachedSong {
            video_id: row.get(0)?,
            title: row.get(1)?,
            artist: row.get(2)?,
            lrc_path: row.get(3)?,
            instrumental_path: row.get(4)?,
            missing_lyrics: row.get::<_, i32>(5)? != 0,
            timestamp: row.get(6)?,
        }))
    } else {
        Ok(None)
    }
}

pub fn insert_song(conn: &Connection, song: &CachedSong) -> Result<()> {
    conn.execute(
        "INSERT OR REPLACE INTO cached_songs (videoId, title, artist, lrcPath, instrumentalPath, missingLyrics, timestamp)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            song.video_id,
            song.title,
            song.artist,
            song.lrc_path,
            song.instrumental_path,
            song.missing_lyrics as i32,
            song.timestamp,
        ],
    )?;
    Ok(())
}

pub fn get_recommendations(conn: &Connection, limit: i32) -> Result<Vec<CachedSong>> {
    let mut stmt = conn.prepare("SELECT videoId, title, artist, lrcPath, instrumentalPath, missingLyrics, timestamp FROM cached_songs ORDER BY timestamp ASC LIMIT ?")?;
    let rows = stmt.query_map(params![limit], |row| {
        Ok(CachedSong {
            video_id: row.get(0)?,
            title: row.get(1)?,
            artist: row.get(2)?,
            lrc_path: row.get(3)?,
            instrumental_path: row.get(4)?,
            missing_lyrics: row.get::<_, i32>(5)? != 0,
            timestamp: row.get(6)?,
        })
    })?;

    let mut songs = Vec::new();
    for song in rows {
        songs.push(song?);
    }
    Ok(songs)
}
