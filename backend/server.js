const express = require('express');
require('dotenv').config();
const { PythonShell } = require('python-shell');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const passport = require('./auth');
const FormData = require('form-data');
const axios = require('axios');

const mongoose = require('mongoose');
const User = require('./models/User');
const CachedSong = require('./models/CachedSong');

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
    origin: function (origin, callback) {
        // Echo the origin if it matches our dev patterns
        if (!origin || origin.startsWith('tauri://') || origin.includes('localhost') || origin.includes('127.0.0.1')) {
            callback(null, origin || true);
        } else {
            callback(null, true);
        }
    },
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
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: 'lax'
    }
}));
app.use(passport.initialize());
app.use(passport.session());

// Auth Guard Middleware
const isAuthenticated = (req, res, next) => {
    // console.log(`[AUTH CHECK] Path: ${req.path}, Authenticated: ${req.isAuthenticated()}`);
    if (req.isAuthenticated()) return next();
    res.status(401).json({ error: 'Unauthorized', message: 'Please log in to continue' });
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
    console.log(`[AUTH] Register attempt for: ${req.body.username}`);
    try {
        const { username, password, displayName } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Missing fields' });

        // Password Security Enforcement
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
        if (!passwordRegex.test(password)) {
            return res.status(400).json({
                error: 'Password too weak',
                message: 'Password must be at least 8 characters long and include an uppercase letter, a lowercase letter, and a number.'
            });
        }

        const user = await User.register(username, password, displayName);
        console.log(`[AUTH] User created in DB: ${user.username}. Starting req.login...`);

        req.login(user, (err) => {
            if (err) {
                console.error("[AUTH] req.login error:", err);
                return res.status(500).json({ error: 'Login failed after register' });
            }
            console.log(`[AUTH] Register/Login successful for ${user.username}`);
            res.json({ message: 'Registered', user });
        });
    } catch (err) {
        console.error("[AUTH] Register Catch Error:", err);
        if (err.code === 11000) {
            return res.status(400).json({ error: 'Username or Email already exists' });
        }
        res.status(500).json({ error: 'Registration failed', details: err.message });
    }
});

app.post('/auth/login', (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) return res.status(500).json({ error: 'Internal server error' });
        if (!user) return res.status(401).json({ error: info?.message || 'Unauthorized' });

        req.login(user, (loginErr) => {
            if (loginErr) return res.status(500).json({ error: 'Login failed' });
            return res.json({ message: 'Logged in', user });
        });
    })(req, res, next);
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

        // Fetch negative cache (blocked songs) from MongoDB
        const videoIds = parsedResults.map(item => item.videoId);
        const blockedSongs = await CachedSong.find({
            videoId: { $in: videoIds },
            missingLyrics: true,
            timestamp: { $gt: Date.now() - (30 * 24 * 60 * 60 * 1000) }
        }).select('videoId');

        const blockedIdSet = new Set(blockedSongs.map(s => s.videoId));

        // Filter out blacklisted songs
        parsedResults = parsedResults.filter(item => !blockedIdSet.has(item.videoId));

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

        // Fetch cache status for these items to manage negative cache and recommendations
        const videoIds = parsedResults.map(item => item.videoId);
        const cachedSongs = await CachedSong.find({
            videoId: { $in: videoIds }
        }).select('videoId missingLyrics timestamp');

        const cacheMap = new Map(cachedSongs.map(s => [s.videoId, s]));

        // Process results: filter logic and tagging
        parsedResults = parsedResults.reduce((acc, item) => {
            const cached = cacheMap.get(item.videoId);

            // Filter out negative cache (songs with missing lyrics within 30 days)
            if (cached && cached.missingLyrics) {
                const thirtyDays = 30 * 24 * 60 * 60 * 1000;
                if (Date.now() - cached.timestamp < thirtyDays) {
                    return acc;
                }
            }

            // Tag as recommended if it's successfully cached and has lyrics
            if (cached && !cached.missingLyrics) {
                item.recommended = true;
                item.isCached = true;
                item.hasLyrics = true;
            }

            acc.push(item);
            return acc;
        }, []);

        res.json(parsedResults);
    } catch (err) {
        console.error("Suggestions failed", err);
        res.status(500).json({ error: err.message });
    }
});

// CACHE SYSTEM (MongoDB based)
async function migrateCacheToMongo() {
    const cachePath = path.join(__dirname, 'cache.json');
    if (fs.existsSync(cachePath)) {
        try {
            const songCache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
            console.log(`Migrating ${Object.keys(songCache).length} items from cache.json to MongoDB...`);

            for (const videoId in songCache) {
                const data = songCache[videoId];
                await CachedSong.findOneAndUpdate(
                    { videoId },
                    {
                        videoId,
                        ...data,
                        timestamp: data.timestamp || Date.now()
                    },
                    { upsert: true }
                );
            }

            // Rename file instead of delete to be safe
            fs.renameSync(cachePath, cachePath + '.bak');
            console.log("Migration complete. cache.json renamed to cache.json.bak");
        } catch (e) {
            console.error("Migration failed:", e);
        }
    }
}

// Call migration after DB connection
mongoose.connection.once('open', migrateCacheToMongo);

// Helper to call external Audio Processor Service
async function callAudioProcessorService(audioPath, outputDir) {
    const apiKey = process.env.AUDIO_PROCESSOR_API_KEY || "CHANGE_ME_KEY";
    const processorUrl = process.env.AUDIO_PROCESSOR_URL || 'http://localhost:3002';

    console.log(`[Backend] Streaming file to processor via Axios: ${audioPath}`);
    if (!fs.existsSync(audioPath)) {
        throw new Error(`File not found at ${audioPath}`);
    }

    const form = new FormData();
    form.append('audio', fs.createReadStream(audioPath));
    form.append('modelName', "UVR-MDX-NET-Inst_HQ_5.onnx");

    const getLength = () => new Promise((resolve, reject) => {
        form.getLength((err, length) => {
            if (err) reject(err);
            else resolve(length);
        });
    });

    try {
        const length = await getLength();
        console.log(`[Backend] Content Length: ${length}`);

        const response = await axios.post(`${processorUrl}/separate`, form, {
            headers: {
                ...form.getHeaders(),
                'x-api-key': apiKey,
                'Content-Length': length
            },
            responseType: 'stream',
            // Increase timeout for long processing
            timeout: 600000,
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });

        const contentDisposition = response.headers['content-disposition'];
        let filename = `instrumental_${Date.now()}.mp3`;
        if (contentDisposition) {
            const match = contentDisposition.match(/filename="(.+)"/);
            if (match) filename = match[1];
        }

        const finalPath = path.join(outputDir, filename);
        const fileStream = fs.createWriteStream(finalPath);

        return new Promise((resolve, reject) => {
            response.data.pipe(fileStream);
            fileStream.on('finish', () => {
                console.log(`[Backend] Processed file saved to: ${finalPath}`);
                resolve({ instrumental: finalPath });
            });
            fileStream.on('error', reject);
            response.data.on('error', reject);
        });
    } catch (err) {
        let errMsg = err.message;
        if (err.response && err.response.data) {
            // Since responseType is stream, we'd need to read the stream to see the error JSON
            // For now, just report the status
            errMsg = `Service Error: ${err.response.status}`;
        }
        throw new Error(errMsg);
    }
}

app.post('/api/process-yt', isAuthenticated, async (req, res) => {
    const { videoId } = req.body;
    if (!videoId) return res.status(400).json({ error: 'Video ID required' });

    console.log(`Processing YouTube ID: ${videoId}`);

    // CHECK CACHE
    try {
        const cached = await CachedSong.findOne({ videoId });
        if (cached) {
            // Check for Negative Cache (Missing Lyrics)
            if (cached.missingLyrics) {
                const thirtyDays = 30 * 24 * 60 * 60 * 1000;
                if (Date.now() - cached.timestamp < thirtyDays) {
                    console.log(`[CACHE] Blocked ${videoId} due to missing lyrics (Negative Cache)`);
                    return res.status(404).json({ error: 'Lyrics not available (Cached)' });
                } else {
                    // Expired, allow retry by removing the negative cache
                    await CachedSong.deleteOne({ videoId });
                }
            } else {
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
        }
    } catch (err) {
        console.error("Cache lookup error:", err);
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
                await CachedSong.findOneAndUpdate(
                    { videoId },
                    { videoId, missingLyrics: true, timestamp: Date.now() },
                    { upsert: true }
                );
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
            await CachedSong.findOneAndUpdate(
                { videoId },
                {
                    videoId,
                    title: dlResult.title,
                    artist: dlResult.artist,
                    lrcPath: lrc_path,
                    instrumentalPath: sepResult.instrumental,
                    timestamp: Date.now(),
                    missingLyrics: false
                },
                { upsert: true }
            );
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
                await CachedSong.findOneAndUpdate(
                    { videoId },
                    { videoId, missingLyrics: true, timestamp: Date.now() },
                    { upsert: true }
                );
                return res.status(404).json({ error: 'Lyrics not available' });
            }
        }

        res.status(500).json({ error: 'Processing failed', details: err.message || err });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
