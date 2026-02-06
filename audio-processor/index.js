const express = require('express');
const { PythonShell } = require('python-shell');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

const API_KEY = process.env.AUDIO_PROCESSOR_API_KEY || process.env.API_KEY || "CHANGE_ME_KEY";
const PORT = 3002;

const app = express();
app.use(cors());
app.use(express.json());

// Authentication Middleware
const authMiddleware = (req, res, next) => {
    const clientKey = req.headers['x-api-key'];
    if (!clientKey || clientKey !== API_KEY) {
        return res.status(403).json({ error: 'Unauthorized: Invalid API Key' });
    }
    next();
};

app.use(authMiddleware);

// Helper for python execution
const runPython = (scriptName, args) => {
    return new Promise((resolve, reject) => {
        const options = {
            mode: 'text',
            pythonPath: 'py', // Assuming global python alias 'py' or 'python'
            pythonOptions: ['-u'],
            scriptPath: path.join(__dirname, 'src'),
            args: args
        };
        PythonShell.run(scriptName, options).then(messages => resolve(messages.join('\n'))).catch(reject);
    });
};

function safeParseJSON(str) {
    try {
        return JSON.parse(str);
    } catch (e) {
        // Try to find a JSON object in the string (fallback for noise in stdout)
        const match = str.match(/\{[\s\S]*\}/);
        if (match) {
            try { return JSON.parse(match[0]); } catch (e2) { }
        }
        throw new Error(`Failed to parse Python output`);
    }
}

const multer = require('multer');
const upload = multer({ dest: 'temp_uploads/' });

// Ensure temp directory exists
if (!fs.existsSync('temp_uploads/')) {
    fs.mkdirSync('temp_uploads/');
}
if (!fs.existsSync('temp_outputs/')) {
    fs.mkdirSync('temp_outputs/');
}

app.post('/separate', (req, res, next) => {
    upload.single('audio')(req, res, (err) => {
        if (err) {
            console.error("[Processor] Multer/Upload Error:", err);
            return res.status(500).json({ error: 'Upload failed', details: err.message });
        }
        next();
    });
}, async (req, res) => {
    if (!req.file) {
        console.error("[Processor] No file in request");
        return res.status(400).json({ error: 'No audio file provided' });
    }

    const audioPath = req.file.path;
    const modelName = req.body.modelName || "UVR-MDX-NET-Inst_HQ_5.onnx";
    const outputDir = path.resolve('temp_outputs');

    console.log(`[Processor] Processing uploaded file: ${req.file.originalname} (${req.file.size} bytes)`);
    console.log(`[Processor] Using model: ${modelName}`);

    try {
        const output = await runPython('separate.py', [audioPath, outputDir, modelName]);
        console.log(`[Processor] Python output received`);
        const result = safeParseJSON(output);

        if (result.error) throw new Error(result.error);

        // Find the instrumental file
        const instrumentalPath = path.join(outputDir, result.instrumental);
        console.log(`[Processor] Looking for instrumental at: ${instrumentalPath}`);

        if (fs.existsSync(instrumentalPath)) {
            console.log(`[Processor] Sending file back to backend...`);
            // Send the file back and cleanup after send
            res.download(instrumentalPath, result.instrumental, (err) => {
                // Cleanup temp files
                try {
                    console.log(`[Processor] Cleaning up temp files...`);
                    if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
                    if (fs.existsSync(instrumentalPath)) fs.unlinkSync(instrumentalPath);
                    if (result.vocals) {
                        const vocalPath = path.join(outputDir, result.vocals);
                        if (fs.existsSync(vocalPath)) fs.unlinkSync(vocalPath);
                    }
                } catch (cleanupErr) {
                    console.error("[Processor] Cleanup Error:", cleanupErr);
                }
            });
        } else {
            console.error(`[Processor] File not found after processing: ${instrumentalPath}`);
            throw new Error("Processed file not found on disk");
        }
    } catch (err) {
        console.error("[Processor] Separation Error:", err);
        // Cleanup on error
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: 'Separation failed', details: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Audio Processor Service running on port ${PORT}`);
    console.log(`Secured with API Key: ${API_KEY.substring(0, 5)}...`);
});
