# KraoQ Rust Backend (`frontend/src-tauri/src`)

The `src-tauri/src` directory contains the Rust backend for the KraoQ Tauri application. This backend acts as the bridge between the frontend user interface and the heavy-lifting Python scripts used for scraping, downloading, and AI audio processing.

Below is an overview of the core files and how they work together:

## 1. `main.rs`
This is the simple entry point of the Tauri application. It abstracts the initialization logic into the library crate by calling `tauri_app_lib::run()`.

## 2. `lib.rs`
This is the heart of the Rust application, handling application state, configuration, and Tauri commands invoked by the frontend.
- **State Management**: Maintains an `AppState` containing the database connection (`db_conn`), paths to Python scripts (`python_dir`), uploads (`uploads_dir`), and the general app data directory (`app_data_dir`).
- **Configuration**: Uses an `AppConfig` struct that stores settings like whether GPU acceleration is enabled, and the versions of Python, PyTorch, CUDA, and FFmpeg to use. It saves and loads this from `settings.json`.
- **Tauri Commands**: Exposes asynchronous commands to the frontend:
  - `search` & `suggestions`: Execute Python scripts (`search.py` and `suggestions.py`) to fetch search results and autocomplete suggestions.
  - `process_yt`: A complex pipeline command that:
    1. Checks the local SQLite cache to see if the video has already been processed.
    2. If not, it executes `download_pipeline.py` to download the audio (`mp3_path`) and lyrics (`lrc_path`).
    3. It then executes `separate.py` to run AI vocal separation (using UVR ONNX models), isolating the instrumental track.
    4. Parses the lyrics (LRC) format into a structured segment array (time and text).
    5. Saves the metadata to the SQLite database to cache it for future requests.
  - `set_config`: Allows the frontend to update backend settings.
  - `reinstall_dependency`: Allows the user/frontend to forcibly reinstall a specific dependency (like FFmpeg or Python) via the `setup.rs` module.

## 3. `setup.rs`
Since KraoQ relies on a complex set of external tools (Python, FFmpeg, PyTorch, ONNX models), `setup.rs` handles the automated provisioning of these dependencies directly onto the user's machine.
- It exposes a `setup_dependencies` Tauri command that the frontend can call during a loading/initialization screen.
- It performs the following steps sequentially, emitting progress events (`setup_step`) back to the frontend:
  1. **Python Runtime**: Downloads and extracts an embedded `python-*-embed-amd64.zip` distribution and installs `pip`.
  2. **FFmpeg**: Downloads and extracts an FFmpeg build for multimedia processing.
  3. **AI Models**: Downloads the specific UVR model (`UVR-MDX-NET-Inst_HQ_5.onnx`) required for vocal separation.
  4. **Pip Modules**: Installs Python dependencies listed in `requirements.txt`.
  5. **GPU Acceleration**: Installs heavily optimized NVIDIA and CUDA libraries along with PyTorch for hardware-accelerated separation.

## 4. `db.rs`
A straightforward SQLite database module utilizing `rusqlite`.
- **Initialization**: Creates a `cached_songs` table in `kraoq.db` if it doesn't exist.
- **Schema**: Stores `videoId`, `title`, `artist`, `lrcPath`, `instrumentalPath`, `missingLyrics`, and a unix `timestamp`.
- **Functions**: Provides `get_song` and `insert_song` utilities to easily check for cached audio separations before attempting to redownload and reprocess them via the Python pipeline.
