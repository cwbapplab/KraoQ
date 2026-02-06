const express = require('express');
const { PythonShell } = require('python-shell');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

// Load secrets from parent directory
let secrets = {};
try {
    const secretPath = path.join(__dirname, '..', 'kraoq_secrets.json');
    if (fs.existsSync(secretPath)) {
        secrets = JSON.parse(fs.readFileSync(secretPath, 'utf8'));
    }
} catch (e) {
    console.error("Failed to load secrets:", e);
}

const API_KEY = secrets.AUDIO_PROCESSOR_API_KEY || process.env.API_KEY || "CHANGE_ME_KEY";
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

app.post('/separate', async (req, res) => {
    const { audioPath, outputDir, modelName } = req.body;

    if (!audioPath || !outputDir) {
        return res.status(400).json({ error: 'Missing audioPath or outputDir' });
    }

    const model = modelName || "UVR-MDX-NET-Inst_HQ_5.onnx";
    console.log(`[Processor] Request received: ${path.basename(audioPath)} -> ${model}`);

    try {
        const output = await runPython('separate.py', [audioPath, outputDir, model]);
        const result = safeParseJSON(output);
        res.json({ status: 'success', data: result });
    } catch (err) {
        console.error("Separation Error:", err);
        res.status(500).json({ error: 'Separation failed', details: err.message, logs: err.logs });
    }
});

app.listen(PORT, () => {
    console.log(`Audio Processor Service running on port ${PORT}`);
    console.log(`Secured with API Key: ${API_KEY.substring(0, 5)}...`);
});
