# Python Scripts Documentation

This folder contains various Python scripts used as the backend data processing, searching, downloading, and audio separation engine for the KraoQ application. These scripts are likely invoked by the Tauri Rust backend.

## Scripts Overview

### `check_gpu.py`
A simple diagnostic script to check whether a compatible GPU is available. It imports `torch` and `onnxruntime` to verify CUDA availability and available execution providers. The results, along with environment details (Python version, CWD, PATH), are written to a log file located at `%APPDATA%\com.cwbapplab.kraoq\gpu_check.txt`.

### `check_gpu_stable.py`
A more robust version of the GPU check script that wraps the imports in `try-except` blocks to prevent crashes if the environment is lacking the required dependencies (`torch` or `onnxruntime`). It writes the diagnostic output to `.\gpu_check.txt`.

### `download_pipeline.py`
A complete pipeline for downloading audio and fetching synchronized lyrics. 
- It uses `yt-dlp` to download the best audio format from a given YouTube Video ID and converts it to MP3 using a locally bundled Windows FFmpeg executable.
- It attempts to fetch synced lyrics `.lrc` via `yt-dlp`. If none are found, it falls back to querying the external **LRCLIB** API based on song metadata (artist, title, and duration).
- Outputs a JSON string containing the paths to the resulting `.mp3` and `.lrc` files, along with track metadata.

### `requirements.txt`
The `pip` requirements file that defines the Python package dependencies for the scripts in this folder: `yt-dlp`, `ytmusicapi`, `requests`, `audio-separator[gpu]`, `mutagen`, and `onnxruntime-gpu`.

### `search.py`
A script that queries YouTube Music for songs based on a search string using the `ytmusicapi` library. 
- Retrieves metadata for each search result (title, artists, album, duration, thumbnail).
- Uses a thread pool (`concurrent.futures`) to perform concurrent checks on each video ID to see if YouTube Music provides lyrics for that specific track.
- Returns a JSON array of the top song results, prioritized and sorted by lyric availability.

### `separate.py`
A core processing script that leverages the `audio-separator` library (using `onnxruntime`) to separate an input audio track into distinct vocal and instrumental MP3 files.
- It manages execution providers by manipulating path variables to detect NVIDIA DLLs to enable GPU/CUDA acceleration if possible, while also falling back to DirectML or CPU.
- Uses the `UVR-MDX-NET-Inst_HQ_5.onnx` model (or another specified ONNX model) to perform the separation.
- Outputs a JSON payload containing the absolute file paths to the newly derived `instrumental` and `vocals` tracks.

### `setup_deps.py`
A centralized setup script designed to be run during initialization or installation to bootstrap the required environment.
- Automatically downloads and installs `pip`.
- Executes `pip install -r requirements.txt` to install all necessary Python packages.
- Downloads a Windows release of `FFmpeg`, extracting `ffmpeg.exe` and `ffprobe.exe` into a local `bin` application data directory.
- Downloads the default `UVR-MDX-NET-Inst_HQ_5.onnx` separation model from GitHub into a local `models` directory.

### `suggestions.py`
A lightweight alternative to `search.py` intended for autocomplete or quick suggestions. It queries `ytmusicapi` for a given term but limits the response to 5 results and skips the intensive asynchronous lyrics verification step, quickly returning basic JSON metadata for the front-end.
