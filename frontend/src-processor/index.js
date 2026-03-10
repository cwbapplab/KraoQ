const express = require('express');
const { PythonShell } = require('python-shell');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

require('dotenv').config();

const PORT = 3002;

const app = express();
app.use(cors());
app.use(express.json());


const upload = multer({ dest: path.join(__dirname, 'temp_uploads') });

// Ensure directories exist
if (!fs.existsSync(path.join(__dirname, 'temp_uploads'))) fs.mkdirSync(path.join(__dirname, 'temp_uploads'));
if (!fs.existsSync(path.join(__dirname, 'temp_outputs'))) fs.mkdirSync(path.join(__dirname, 'temp_outputs'));

const runPython = (scriptName, args) => {
    return new Promise((resolve, reject) => {
        const options = {
            mode: 'text',
            pythonPath: 'python', // Use local python
            pythonOptions: ['-u'],
            scriptPath: path.join(__dirname, 'src'),
            args: args
        };
        PythonShell.run(scriptName, options)
            .then(messages => resolve(messages.join('\n')))
            .catch(reject);
    });
};

function safeParseJSON(str) {
    try {
        const match = str.match(/\{[\s\S]*\}/);
        return match ? JSON.parse(match[0]) : JSON.parse(str);
    } catch (e) {
        throw new Error(`Failed to parse Python output`);
    }
}

app.post('/separate', upload.single('audio'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No audio file provided' });

    const audioPath = req.file.path;
    const modelName = req.body.modelName || "UVR-MDX-NET-Inst_HQ_5.onnx";
    const outputDir = path.resolve(__dirname, 'temp_outputs');

    try {
        const output = await runPython('separate.py', [audioPath, outputDir, modelName]);
        const result = safeParseJSON(output);
        const instrumentalPath = path.join(outputDir, result.instrumental);

        if (fs.existsSync(instrumentalPath)) {
            res.download(instrumentalPath, result.instrumental, () => {
                // Cleanup
                try {
                    fs.unlinkSync(audioPath);
                    fs.unlinkSync(instrumentalPath);
                    if (result.vocals) fs.unlinkSync(path.join(outputDir, result.vocals));
                } catch (e) { }
            });
        } else {
            throw new Error("File not found on disk");
        }
    } catch (err) {
        if (req.file) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: 'Separation failed', details: err.message });
    }
});

app.listen(PORT, () => console.log(`Audio Processor Service running on port ${PORT}`));
