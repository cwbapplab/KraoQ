const express = require('express');
require('dotenv').config();
const { PythonShell } = require('python-shell');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const session = require('express-session');
const { createClient } = require('redis');
const { RedisStore } = require('connect-redis');
const passport = require('./auth');
const FormData = require('form-data');
const axios = require('axios');

const mongoose = require('mongoose');
const User = require('./models/User');
const CachedSong = require('./models/CachedSong');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken'); // Added JWT support
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-env';

// Connect to MongoDB
const mongoUser = process.env.MONGO_USERNAME || 'root';
const mongoPass = process.env.MONGO_PASSWORD || 'example';
const mongoHost = process.env.MONGO_HOST || 'kraoq-mongo-service';
const mongoPort = process.env.MONGO_PORT || '27017';
const mongoURI = `mongodb://${mongoUser}:${mongoPass}@${mongoHost}:${mongoPort}/kraoq?authSource=admin`;

mongoose.connect(mongoURI)
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.error('MongoDB Connection Error:', err));

// Redis Setup
const redisClient = createClient({
    url: `redis://${process.env.REDIS_HOST || 'kraoq-redis'}:${process.env.REDIS_PORT || '6379'}`
});
redisClient.connect()
    .then(() => console.log('Redis Connected'))
    .catch(err => console.error('Redis Connection Error:', err));

const redisStore = new RedisStore({
    client: redisClient,
    prefix: "kraoq:sess:",
});


const app = express();
app.set('trust proxy', 1); // Required for cookies to work behind Ngrok/Proxy
const PORT = process.env.PORT || 3001;

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Middleware
app.use((req, res, next) => {
    console.log(`[DEBUG] ${req.method} ${req.url} - Origin: ${req.headers.origin}`);
    next();
});

app.use(cors({
    origin: function (origin, callback) {
        console.log(`[CORS DEBUG] Origin: ${origin}`);
        if (!origin) return callback(null, true);

        const allowedOrigins = [
            'http://localhost:1420',
            'http://127.0.0.1:1420',
            'http://tauri.localhost',
            'tauri://localhost',
            'https://karaoq.ngrok.io'
        ];

        // Check if origin is in list or starts with tauri
        const isAllowed = allowedOrigins.some(o => origin.startsWith(o)) ||
            origin.includes('localhost') ||
            origin.includes('127.0.0.1');

        if (isAllowed) {
            callback(null, true);
        } else {
            console.log(`[CORS REJECTED] ${origin}`);
            callback(null, false);
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-ID', 'X-Requested-With', 'ngrok-skip-browser-warning']
}));
app.use(express.json());
// app.use(express.static('public')); // Serve frontend files (Removed to expose only API)
app.use('/uploads', express.static('uploads')); // Serve uploaded/generated files

app.use(session({
    store: redisStore,
    secret: process.env.SESSION_SECRET || 'karaoq-super-secret-key-123',
    resave: false,
    saveUninitialized: false,
    proxy: true, // Necessary when behind a proxy like ngrok
    cookie: {
        secure: true,
        httpOnly: true, // Prevent XSS from reading the cookie
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        sameSite: 'none'
    }
}));

app.use(passport.initialize());
app.use(passport.session());

// Auth Guard Middleware
const isAuthenticated = (req, res, next) => {
    // 1. Check if already authenticated via session (Web)
    if (req.isAuthenticated()) return next();

    // 2. Check for JWT Token (Mobile/Tauri)
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Please log in to continue' });
    }

    jwt.verify(token, JWT_SECRET, async (err, decoded) => {
        if (err) return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });

        try {
            const user = await User.findById(decoded.id);
            if (!user) return res.status(401).json({ error: 'Unauthorized', message: 'User not found' });

            // Manually populate user for this request
            req.user = user;
            next();
        } catch (dbErr) {
            res.status(500).json({ error: 'Internal server error' });
        }
    });
};

const generateToken = (user) => {
    return jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
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
            const token = generateToken(user);
            res.json({ message: 'Registered', user, token });
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
            const token = generateToken(user);
            return res.json({ message: 'Logged in', user, token });
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
        const frontendUrl = process.env.FRONTEND_URL || 'http://192.168.1.11:1420';
        res.redirect(frontendUrl);
    }
);

app.post('/auth/google-native', async (req, res) => {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ error: 'Token required' });

    try {
        const audiences = [process.env.GOOGLE_CLIENT_ID];
        if (process.env.GOOGLE_ANDROID_CLIENT_ID) {
            audiences.push(process.env.GOOGLE_ANDROID_CLIENT_ID);
        }

        const ticket = await googleClient.verifyIdToken({
            idToken,
            audience: audiences,
        });
        const payload = ticket.getPayload();
        const googleId = payload['sub'];
        const email = payload['email'];
        const name = payload['name'];
        const picture = payload['picture'];

        // Find or create user
        let user = await User.findOne({
            $or: [
                { googleId },
                { username: email }
            ]
        });

        if (!user) {
            user = new User({
                googleId,
                username: email,
                displayName: name,
                profilePicture: picture
            });
            await user.save();
        } else if (!user.googleId) {
            user.googleId = googleId;
            if (!user.profilePicture) user.profilePicture = picture;
            await user.save();
        }

        req.login(user, (err) => {
            if (err) return res.status(500).json({ error: 'Login failed' });
            const token = generateToken(user);
            res.json({ message: 'Logged in', user, token });
        });

    } catch (err) {
        console.error("Token verification failed", err);
        res.status(401).json({ error: 'Invalid token' });
    }
});

app.get('/auth/logout', (req, res) => {
    req.logout((err) => {
        if (err) { return res.status(500).json({ error: 'Logout failed' }); }
        res.json({ message: 'Logged out' });
    });
});

app.get('/auth/status', (req, res) => {
    // 1. Session check
    if (req.isAuthenticated()) {
        return res.json({ isAuthenticated: true, user: req.user });
    }

    // 2. JWT check (for persistence on mobile)
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
        jwt.verify(token, JWT_SECRET, async (err, decoded) => {
            if (err) return res.json({ isAuthenticated: false });
            try {
                const user = await User.findById(decoded.id);
                if (user) return res.json({ isAuthenticated: true, user });
                res.json({ isAuthenticated: false });
            } catch (e) {
                res.json({ isAuthenticated: false });
            }
        });
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
    const processorUrl = process.env.AUDIO_PROCESSOR_URL || 'http://192.168.1.11:3002';

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
