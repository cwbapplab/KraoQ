const express = require('express');
require('dotenv').config();
const { PythonShell } = require('python-shell');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const FormData = require('form-data');
const axios = require('axios');

const CachedSong = require('./models/CachedSong');

const app = express();
const PORT = process.env.PORT || 3001;

// Ensure uploads and data directories exist
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
if (!fs.existsSync(path.join(__dirname, 'data'))) fs.mkdirSync(path.join(__dirname, 'data'));

// Middleware
app.use(cors({
    origin: true, // Allow all local origins in Tauri
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Session-ID']
}));
app.use(express.json());
app.use('/uploads', express.static('uploads'));

app.use(session({
    store: new FileStore({ path: path.join(__dirname, 'data', 'sessions') }),
    secret: process.env.SESSION_SECRET || 'CHANGE_ME_SECRET',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Local execution
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    }
}));


// Python Helper
function runPythonHelper(scriptName, args) {
    return new Promise((resolve, reject) => {
        const options = {
            mode: 'text',
            pythonPath: 'python', // Standard local python
            pythonOptions: ['-u'],
            scriptPath: path.join(__dirname, 'scripts'),
            args: args
        };

        const shell = new PythonShell(scriptName, options);
        let results = [];
        shell.on('message', (msg) => results.push(msg));
        shell.end((err) => {
            if (err) {
                err.logs = results;
                return reject(err);
            }
            resolve(results.length > 0 ? results[results.length - 1] : null);
        });
    });
}

function safeParseJSON(input) {
    if (!input) return {};
    try {
        if (typeof input === 'object') return input;
        return JSON.parse(input);
    } catch (e) {
        return { error: 'Invalid JSON' };
    }
}

function parseLRC(lrcContent) {
    const lines = lrcContent.split('\n');
    const segments = [];
    for (const line of lines) {
        const regex = /^\[(\d{2}):(\d{2}(?:\.\d+)?)\](.*)/;
        const match = line.match(regex);
        if (match) {
            const timestamp = parseInt(match[1], 10) * 60 + parseFloat(match[2]);
            segments.push({ time: timestamp, text: match[3].trim() });
        }
    }
    return segments;
}

// Routes



async function callAudioProcessorService(audioPath, outputDir) {
    const processorUrl = process.env.AUDIO_PROCESSOR_URL || 'http://localhost:3002';
    const form = new FormData();
    form.append('audio', fs.createReadStream(audioPath));
    form.append('modelName', "UVR-MDX-NET-Inst_HQ_5.onnx");

    const response = await axios.post(`${processorUrl}/separate`, form, {
        headers: { ...form.getHeaders(), 'x-api-key': process.env.AUDIO_PROCESSOR_API_KEY || "CHANGE_ME_KEY" },
        responseType: 'stream',
        timeout: 600000
    });

    const filename = `instrumental_${Date.now()}.mp3`;
    const finalPath = path.join(outputDir, filename);
    const fileStream = fs.createWriteStream(finalPath);

    return new Promise((resolve, reject) => {
        response.data.pipe(fileStream);
        fileStream.on('finish', () => resolve({ instrumental: finalPath }));
        fileStream.on('error', reject);
    });
}

app.get('/api/search', async (req, res) => {
    try {
        const results = await runPythonHelper('search.py', [req.query.q]);
        let parsedResults = safeParseJSON(results);
        res.json(parsedResults);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/suggestions', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) return res.json([]);
        const results = await runPythonHelper('suggestions.py', [query]);
        let parsedResults = safeParseJSON(results);
        res.json(Array.isArray(parsedResults) ? parsedResults : []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/process-yt', async (req, res) => {
    const { videoId } = req.body;
    const cached = CachedSong.findOne({ videoId });
    if (cached && !cached.missingLyrics) {
        const instExists = fs.existsSync(path.join(uploadDir, path.basename(cached.instrumentalPath)));
        if (instExists) {
            const lrcContent = fs.readFileSync(cached.lrcPath, 'utf8');
            return res.json({
                message: 'Processing complete (Cached)',
                data: {
                    segments: parseLRC(lrcContent),
                    lrc: lrcContent,
                    instrumentalUrl: `/uploads/${path.basename(cached.instrumentalPath)}`,
                    title: cached.title,
                    artist: cached.artist
                }
            });
        }
    }

    try {
        const output = await runPythonHelper('download_pipeline.py', [videoId, uploadDir]);
        const dlResult = safeParseJSON(output);
        if (dlResult.error) return res.status(404).json({ error: dlResult.error });

        const sepResult = await callAudioProcessorService(dlResult.mp3_path, uploadDir);
        const lrcContent = fs.readFileSync(dlResult.lrc_path, 'utf8');

        CachedSong.findOneAndUpdate({ videoId }, {
            videoId, title: dlResult.title, artist: dlResult.artist,
            lrcPath: dlResult.lrc_path, instrumentalPath: sepResult.instrumental,
            timestamp: Date.now(), missingLyrics: false
        });

        res.json({
            message: 'Processing complete',
            data: {
                segments: parseLRC(lrcContent),
                lrc: lrcContent,
                instrumentalUrl: `/uploads/${path.basename(sepResult.instrumental)}`,
                title: dlResult.title,
                artist: dlResult.artist
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Processing failed', details: err.message });
    }
});

app.listen(PORT, () => console.log(`Backend Server running on port ${PORT}`));
