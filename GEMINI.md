# Project Dependencies

This project relies on a combination of Node.js (React/Vite) for the frontend, Rust (Tauri) for the backend, and Python for some embedded scripts/services. Below is the full list of dependencies required to run the project.

## Frontend (Node.js/React/Vite)
These dependencies are defined in `frontend/package.json`.

**Dependencies:**
- `@tauri-apps/api` (^2.10.1): Tauri API wrapper for frontend-backend communication.
- `@tauri-apps/plugin-fs` (^2.4.5): Tauri filesystem plugin.
- `framer-motion` (^12.33.0): Animation library for React.
- `lucide-react` (^0.563.0): Icon library.
- `react` (^18.3.1): Core UI library.
- `react-dom` (^18.3.1): React DOM rendering for the web.

**Dev Dependencies:**
- `@tauri-apps/cli` (^2): Tauri command-line interface.
- `@vitejs/plugin-react` (^4.3.4): Vite plugin for React.
- `autoprefixer` (^10.4.24): PostCSS plugin for parsing CSS and adding vendor prefixes.
- `postcss` (^8.5.6): Tool for transforming CSS with JS plugins.
- `tailwindcss` (^3.4.17): Utility-first CSS framework.
- `vite` (^5.4.11): Next-generation frontend tooling and bundler.

## Backend (Rust/Tauri)
These dependencies are defined in `frontend/src-tauri/Cargo.toml`.

**Dependencies:**
- `tauri` (v2, protocol-asset): The core framework for the application.
- `tauri-plugin-opener` (v2): Plugin for opening files/URLs.
- `tauri-plugin-fs` (v2.0.0): Filesystem operations plugin.
- `serde` (v1, derive): Framework for serializing and deserializing Rust data structures.
- `serde_json` (v1): JSON serialization and deserialization.
- `rusqlite` (v0.32.1, bundled): SQLite database bindings for Rust.
- `anyhow` (v1.0.89): Flexible error handling.
- `tokio` (v1.40.0, full): Asynchronous runtime for Rust.
- `reqwest` (v0.12, stream): HTTP client for fulfilling requests.
- `zip` (v2.1.0): Library for reading/writing ZIP archives.

**Build Dependencies:**
- `tauri-build` (v2): Tauri build script utility.

## Python Scripts
These dependencies are defined in `frontend/src-tauri/python/requirements.txt` and are likely used for audio processing or other supplementary tasks.

**Requirements:**
- `yt-dlp`: Command-line program to download videos from YouTube and other sites.
- `ytmusicapi`: Unofficial API for YouTube Music.
- `requests`: Simple HTTP library for Python.
- `audio-separator[gpu]`: Tool for separating audio tracks, configured with GPU support.
- `mutagen`: Python module to handle audio metadata.
- `onnxruntime-gpu`: Machine learning inferencing and training accelerator (GPU enabled).
