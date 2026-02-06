const express = require('express');
const { PythonShell } = require('python-shell');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve frontend files
app.use('/uploads', express.static('uploads')); // Serve uploaded/generated files

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Helper to format timestamps for SRT (HH:MM:SS,ms)
function formatTimeSRT(seconds) {
    const date = new Date(0);
    date.setMilliseconds(seconds * 1000);
    const isoString = date.toISOString().substr(11, 12);
    return isoString.replace('.', ',');
}

// Helper to format timestamps for LRC ([MM:SS.xx])
function formatTimeLRC(seconds) {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `[${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(ms).padStart(2, '0')}]`;
}

// Determine if we should split by words for Karaoke? 
// Standard LRC is line based. We'll stick to segments for now, 
// using segment start time.
function generateLRC(segments) {
    let lrc = "";
    segments.forEach(seg => {
        lrc += `${formatTimeLRC(seg.start)}${seg.text}\n`;
    });
    return lrc;
}

// Helper for python shell to avoid duplication
const runPythonHelper = (script, args) => {
    return new Promise((resolve, reject) => {
        const options = {
            mode: 'text',
            pythonPath: 'py',
            pythonOptions: ['-u'],
            scriptPath: path.join(__dirname, 'scripts'),
            args: args
        };
        PythonShell.run(script, options).then(messages => resolve(messages.join('\n'))).catch(reject);
    });
};

function safeParseJSON(str) {
    try {
        return JSON.parse(str);
    } catch (e) {
        // Try to find a JSON object in the string
        const match = str.match(/\{[\s\S]*\}/);
        if (match) {
            try { return JSON.parse(match[0]); } catch (e2) { }
        }
        throw new Error(`Failed to parse Python output: ${str.substring(0, 100)}...`);
    }
}

// Helper to parse standard LRC into segments
function parseLRC(lrcContent) {
    // ... (rest is same, just skipped for brevity for the tool, but I need to include context to match)
    const lines = lrcContent.split('\n');
    const segments = [];
    const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const match = timeRegex.exec(line);
        if (match) {
            const min = parseInt(match[1]);
            const sec = parseInt(match[2]);
            const ms = parseInt(match[3].padEnd(3, '0').substring(0, 3)); // Normalize ms
            const time = min * 60 + sec + ms / 1000;
            const text = line.replace(timeRegex, '').trim();

            if (text) {
                // Set end time of previous segment to start time of this one
                if (segments.length > 0) {
                    segments[segments.length - 1].end = time;
                }
                segments.push({ start: time, end: time + 5, text: text }); // Default +5s end if last
            }
        }
    }
    return segments;
}

app.get('/api/search', async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: 'Query required' });

    try {
        const results = await runPythonHelper('search.py', [query]);
        let parsedResults = safeParseJSON(results);

        // Filter out blacklisted songs (Negative Cache)
        parsedResults = parsedResults.filter(item => {
            const cached = songCache[item.videoId];
            if (cached && cached.missingLyrics) {
                // Double check expiry
                const thirtyDays = 30 * 24 * 60 * 60 * 1000;
                if (Date.now() - cached.timestamp < thirtyDays) {
                    return false; // Hide this result
                }
            }
            return true;
        });

        res.json(parsedResults);
    } catch (err) {
        console.error("Search failed", err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/suggestions', async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: 'Query required' });

    try {
        const results = await runPythonHelper('suggestions.py', [query]);
        let parsedResults = safeParseJSON(results);

        // Filter out blacklisted songs (Negative Cache)
        parsedResults = parsedResults.filter(item => {
            const cached = songCache[item.videoId];
            if (cached && cached.missingLyrics) {
                const thirtyDays = 30 * 24 * 60 * 60 * 1000;
                if (Date.now() - cached.timestamp < thirtyDays) {
                    return false;
                }
            }
            return true;
        });

        res.json(parsedResults);
    } catch (err) {
        console.error("Suggestions failed", err);
        res.status(500).json({ error: err.message });
    }
});

// CACHE SYSTEM
const cachePath = path.join(__dirname, 'cache.json');
let songCache = {};

// Load cache on start
if (fs.existsSync(cachePath)) {
    try {
        songCache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        console.log(`Loaded ${Object.keys(songCache).length} items from cache.`);
    } catch (e) {
        console.error("Failed to load cache", e);
    }
}

function saveCache() {
    try {
        fs.writeFileSync(cachePath, JSON.stringify(songCache, null, 2));
    } catch (e) {
        console.error("Failed to save cache", e);
    }
}

app.post('/api/process-yt', async (req, res) => {
    const { videoId } = req.body;
    if (!videoId) return res.status(400).json({ error: 'Video ID required' });

    console.log(`Processing YouTube ID: ${videoId}`);

    // CHECK CACHE
    if (songCache[videoId]) {
        const cached = songCache[videoId];

        // Check for Negative Cache (Missing Lyrics)
        if (cached.missingLyrics) {
            const thirtyDays = 30 * 24 * 60 * 60 * 1000;
            if (Date.now() - cached.timestamp < thirtyDays) {
                console.log(`[CACHE] Blocked ${videoId} due to missing lyrics (Negative Cache)`);
                return res.status(404).json({ error: 'Lyrics not available (Cached)' });
            } else {
                // Expired, allow retry
                delete songCache[videoId];
                saveCache();
            }
        }

        // Verify files still exist
        const lrcExists = cached.lrcPath && fs.existsSync(cached.lrcPath);
        const instExists = cached.instrumentalPath && fs.existsSync(path.join(uploadDir, path.basename(cached.instrumentalPath)));

        if (lrcExists && instExists) {
            console.log(`[CACHE HIT] Returning cached data for ${videoId}`);
            const lrcContentRaw = fs.readFileSync(cached.lrcPath, 'utf8');
            const segments = parseLRC(lrcContentRaw);

            return res.json({
                message: 'Processing complete (Cached)',
                data: {
                    segments: segments,
                    lrc: lrcContentRaw,
                    instrumentalUrl: `/uploads/${path.basename(cached.instrumentalPath)}`,
                    title: cached.title,
                    artist: cached.artist
                }
            });
        }
    }

    try {
        // Step 1: Download MP3 and Fetch External Lyrics (LRC)
        console.log("Step 1: Downloading & Fetching Metadata/Lyrics...");
        const output = await runPythonHelper('download_pipeline.py', [videoId, uploadDir]);
        const dlResult = safeParseJSON(output);

        if (dlResult.error) {
            // Negative Caching for Lyrics Failure
            if (dlResult.error.includes("Lyrics not available")) {
                console.log(`[NEGATIVE CACHE] Caching missing lyrics for ${videoId}`);
                songCache[videoId] = {
                    missingLyrics: true,
                    timestamp: Date.now()
                };
                saveCache();
            }
            return res.status(404).json({ error: dlResult.error });
        }

        const { mp3_path, lrc_path } = dlResult;
        console.log(`Downloaded: ${mp3_path}`);
        console.log(`Lyrics: ${lrc_path}`);

        // Step 2: Separation (Instrumental Only)
        // We still run separation to get the instrumental track for the Karaoke experience.
        console.log("Step 2: Separating Instrumental...");
        const sepOutput = await runPythonHelper('separate.py', [mp3_path, uploadDir, "UVR-MDX-NET-Inst_HQ_5.onnx"]);
        const sepResult = safeParseJSON(sepOutput);

        // Step 3: Transcription (SKIPPED/DISABLED)
        // We use the downloaded lyrics instead.

        // Read and parse the downloaded LRC
        const lrcContentRaw = fs.readFileSync(lrc_path, 'utf8');
        const segments = parseLRC(lrcContentRaw);

        // Files
        const instrumentalUrl = sepResult.instrumental ? `/uploads/${path.basename(sepResult.instrumental)}` : null;

        // UPDATE CACHE
        if (instrumentalUrl) {
            songCache[videoId] = {
                title: dlResult.title,
                artist: dlResult.artist,
                lrcPath: lrc_path,
                instrumentalPath: sepResult.instrumental, // full path on disk
                timestamp: Date.now()
            };
            saveCache();
        }

        res.json({
            message: 'Processing complete',
            data: {
                segments: segments,
                lrc: lrcContentRaw,
                instrumentalUrl: instrumentalUrl,
                title: dlResult.title,
                artist: dlResult.artist
            }
        });

    } catch (err) {
        console.error('Processing Error:', err);

        // Check for specific Python script errors (exit code 1)
        if (err.logs && Array.isArray(err.logs)) {
            const logContent = err.logs.join(' ');
            if (logContent.includes("Lyrics not available")) {
                console.log(`[NEGATIVE CACHE] Caching missing lyrics for ${videoId} (from Catch block)`);
                songCache[videoId] = {
                    missingLyrics: true,
                    timestamp: Date.now()
                };
                saveCache();
                return res.status(404).json({ error: 'Lyrics not available' });
            }
        }

        res.status(500).json({ error: 'Processing failed', details: err.message || err });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
