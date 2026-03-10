const db = require('../database');

const CachedSong = {
    findById: (videoId) => {
        return db.prepare('SELECT * FROM cached_songs WHERE videoId = ?').get(videoId);
    },
    findOne: (query) => {
        if (query.videoId) {
            return db.prepare('SELECT * FROM cached_songs WHERE videoId = ?').get(query.videoId);
        }
        return null;
    },
    find: (query) => {
        if (query.videoId && query.videoId.$in) {
            const placeholders = query.videoId.$in.map(() => '?').join(',');
            return db.prepare(`SELECT * FROM cached_songs WHERE videoId IN (${placeholders})`).all(...query.videoId.$in);
        }
        return [];
    },
    findOneAndUpdate: (query, update, options) => {
        const videoId = query.videoId;
        const existing = db.prepare('SELECT * FROM cached_songs WHERE videoId = ?').get(videoId);

        if (existing) {
            const fields = Object.keys(update).filter(k => k !== 'videoId');
            const setClause = fields.map(f => `${f} = ?`).join(', ');
            const values = fields.map(f => update[f]);
            db.prepare(`UPDATE cached_songs SET ${setClause} WHERE videoId = ?`).run(...values, videoId);
        } else {
            const fields = Object.keys(update);
            const placeholders = fields.map(() => '?').join(', ');
            db.prepare(`INSERT INTO cached_songs (${fields.join(', ')}) VALUES (${placeholders})`).run(...fields.map(f => update[f]));
        }
        return update;
    },
    deleteOne: (query) => {
        if (query.videoId) {
            return db.prepare('DELETE FROM cached_songs WHERE videoId = ?').run(query.videoId);
        }
    }
};

module.exports = CachedSong;
