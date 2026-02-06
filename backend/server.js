const express = require('express');
require('dotenv').config();
const { PythonShell } = require('python-shell');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const passport = require('./auth');

const mongoose = require('mongoose');
const User = require('./models/User');

// Connect to MongoDB
const mongoUser = process.env.MONGO_USERNAME || 'root';
const mongoPass = process.env.MONGO_PASSWORD || 'example';
const mongoHost = process.env.MONGO_HOST || 'kraoq-mongo-service';
const mongoPort = process.env.MONGO_PORT || '27017';
const mongoURI = `mongodb://${mongoUser}:${mongoPass}@${mongoHost}:${mongoPort}/kraoq?authSource=admin`;

mongoose.connect(mongoURI)
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.error('MongoDB Connection Error:', err));


const app = express();
const PORT = process.env.PORT || 3001;

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Middleware
app.use(cors({
    origin: true, // Allow all origins for now (or configured via env), required for credentials
    credentials: true
}));
app.use(express.json());
// app.use(express.static('public')); // Serve frontend files (Removed to expose only API)
app.use('/uploads', express.static('uploads')); // Serve uploaded/generated files

// Session & Auth Middleware
app.use(session({
    store: new FileStore({ path: path.join(uploadDir, 'sessions'), ttl: 86400 }),
    secret: process.env.SESSION_SECRET || 'keyboard cat',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // true if https
        maxAge: 24 * 60 * 60 * 1000
    }
}));
app.use(passport.initialize());
app.use(passport.session());

// Auth Guard Middleware
const isAuthenticated = (req, res, next) => {
    console.log(`[AUTH CHECK] Path: ${req.path}, Authenticated: ${req.isAuthenticated()}`);
    if (req.isAuthenticated()) return next();
    res.status(401).json({ error: 'Unauthorized' });
};

// ... helpers ...

function runPythonHelper(scriptName, args) {
    return new Promise((resolve, reject) => {
        const scriptsDir = path.join(__dirname, 'scripts');
        const options = {
            mode: 'text',
            pythonPath: 'python3', // Default to python3 in most containers
            pythonOptions: ['-u'],
            scriptPath: scriptsDir,
            args: args
        };

        const shell = new PythonShell(scriptName, options);
        let results = [];

        shell.on('message', function (message) {
            // console.log(`[Python ${scriptName}]`, message); 
            results.push(message);
        });

        shell.end(function (err) {
            if (err) {
                err.logs = results;
                return reject(err);
            }
            // Return the last line as it likely contains the JSON result
            resolve(results.length > 0 ? results[results.length - 1] : null);
        });
    });
}

function safeParseJSON(input) {
    if (!input) return {};
    try {
        // If input is an array (from multiple python print(json)), take the last one?
        // But runPythonHelper returns the last line string.
        if (typeof input === 'object') return input;
        return JSON.parse(input);
    } catch (e) {
        console.error("JSON Parse Error:", e.message, "Input:", input);
        return { error: 'Invalid JSON from script' };
    }
}

function parseLRC(lrcContent) {
    const lines = lrcContent.split('\n');
    const segments = [];

    for (const line of lines) {
        // [mm:ss.xx] text
        const regex = /^\[(\d{2}):(\d{2}(?:\.\d+)?)\](.*)/;
        const match = line.match(regex);

        if (match) {
            const minutes = parseInt(match[1], 10);
            const seconds = parseFloat(match[2]);
            const text = match[3].trim();
            const timestamp = minutes * 60 + seconds;

            segments.push({
                time: timestamp,
                text: text
            });
        }
    }
    return segments;
}

// AUTH ROUTES
app.post('/auth/register', async (req, res) => {
    try {
        const { username, password, displayName } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Missing fields' });

        const user = await User.register(username, password, displayName);
        req.login(user, (err) => {
            if (err) return res.status(500).json({ error: 'Login failed after register' });
            res.json({ message: 'Registered', user });
        });
    } catch (err) {
        console.error("Register Error", err);
        res.status(500).json({ error: 'Registration failed', details: err.message });
    }
});

app.post('/auth/login', passport.authenticate('local'), (req, res) => {
    res.json({ message: 'Logged in', user: req.user });
});

app.get('/auth/google', (req, res, next) => {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        return res.status(501).json({ error: "Google OAuth is not configured. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to your .env file." });
    }
    passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/' }),
    function (req, res) {
        // Successful authentication, redirect home.
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:1420';
        res.redirect(frontendUrl);
    }
);

app.get('/auth/logout', (req, res) => {
    req.logout((err) => {
        if (err) { return res.status(500).json({ error: 'Logout failed' }); }
        res.json({ message: 'Logged out' });
    });
});

app.get('/auth/status', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({ isAuthenticated: true, user: req.user });
    } else {
        res.json({ isAuthenticated: false });
    }
});

app.get('/api/search', isAuthenticated, async (req, res) => {
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

app.get('/api/suggestions', isAuthenticated, async (req, res) => {
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

// Helper to call external Audio Processor Service
async function callAudioProcessorService(audioPath, outputDir) {
    const secretsLocations = [
        process.env.SECRETS_PATH,
        '/kraoq_secrets.json', // Docker root (parent of /app)
        path.join(__dirname, '..', 'kraoq_secrets.json') // Local dev
    ];

    let apiKey = "CHANGE_ME_KEY";

    for (const loc of secretsLocations) {
        if (loc && fs.existsSync(loc)) {
            try {
                apiKey = JSON.parse(fs.readFileSync(loc, 'utf8')).AUDIO_PROCESSOR_API_KEY;
                break;
            } catch (e) {
                console.error(`Failed to parse secrets from ${loc}`, e);
            }
        }
    }

    const processorUrl = process.env.AUDIO_PROCESSOR_URL || 'http://localhost:3002';
    const response = await fetch(`${processorUrl}/separate`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey
        },
        body: JSON.stringify({
            audioPath,
            outputDir,
            modelName: "UVR-MDX-NET-Inst_HQ_5.onnx"
        })
    });

    if (!response.ok) {
        let errMsg = 'Service request failed';
        try {
            const errData = await response.json();
            errMsg = errData.error || errMsg;
        } catch (e) { }
        throw new Error(errMsg);
    }

    const json = await response.json();
    return json.data;
}

app.post('/api/process-yt', isAuthenticated, async (req, res) => {
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
        // We run separation via the external Microservice
        console.log("Step 2: Separating Instrumental via Audio-Processor Service...");

        const sepResult = await callAudioProcessorService(mp3_path, uploadDir);

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
