# Karaoke Generator API

This Node.js API uses `faster-whisper` (via Python) to transcribe MP3 files and generate Karaoke-ready lyrics (LRC/SRT).

## Setup

1.  **Install Node dependencies:**
    ```bash
    npm install
    ```

2.  **Install Python dependencies:**
    ```bash
    pip install -r requirements.txt
    ```
    *Note: Ensure you have Python installed and in your PATH.*

## Running the Server

```bash
node server.js
```
or for development:
```bash
npm run dev
```

The server runs on **port 3001** by default.

## API Usage

**Endpoint:** `POST /api/transcribe`

**Body:** `form-data` with a key `file` containing the MP3 file.

**Response:**
JSON object containing:
- `data.segments`: Raw segmentation data from Whisper (with timestamps).
- `data.srt`: String content formatted as SRT subtitles.
- `data.lrc`: String content formatted as LRC lyrics (Karaoke).

**Example using curl:**
```bash
curl -F "file=@/path/to/song.mp3" http://localhost:3001/api/transcribe
```
