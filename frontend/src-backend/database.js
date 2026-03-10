const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'data', 'kraoq.db');

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'));
}

const db = new Database(dbPath);

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    passwordHash TEXT,
    displayName TEXT,
    profilePicture TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS cached_songs (
    videoId TEXT PRIMARY KEY,
    title TEXT,
    artist TEXT,
    lrcPath TEXT,
    instrumentalPath TEXT,
    missingLyrics INTEGER DEFAULT 0,
    timestamp INTEGER
  );
`);

module.exports = db;
