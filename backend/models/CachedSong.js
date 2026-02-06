const mongoose = require('mongoose');

const cachedSongSchema = new mongoose.Schema({
    videoId: { type: String, required: true, unique: true },
    title: { type: String },
    artist: { type: String },
    lrcPath: { type: String },
    instrumentalPath: { type: String }, // absolute path on disk
    missingLyrics: { type: Boolean, default: false },
    timestamp: { type: Number, default: Date.now }
});

const CachedSong = mongoose.model('CachedSong', cachedSongSchema);
module.exports = CachedSong;
