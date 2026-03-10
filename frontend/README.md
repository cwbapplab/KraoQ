# KraoQ - Karaoke Generator

This project is a complete Karaoke generation and playback application powered by Tauri, React, Node.js, and Python.

## External Dependencies

The project is divided into several components, each with its own set of dependencies. The Node.js backends have been completely removed and functionality has been migrated to Rust native modules.

### 1. Frontend Web App (React / Vite)
Located in `frontend/package.json`. Responsible for the user interface.
- **Core:** `react`, `react-dom`
- **Styling & UI:** `tailwindcss`, `postcss`, `autoprefixer`, `framer-motion`, `lucide-react`
- **Build Tools:** `vite`, `@vitejs/plugin-react`, `@tauri-apps/cli`
- **Tauri Integration**: `@tauri-apps/api`, `@tauri-apps/plugin-fs`

### 2. Desktop Core (Tauri / Rust)
Located in `frontend/src-tauri/Cargo.toml`. Provides the native desktop environment, local database, and invokes python scripts.
- **Dependencies:** `tauri`, `tauri-plugin-opener`, `serde`, `serde_json`, `rusqlite`, `tokio`, `anyhow`, `tauri-plugin-fs`
- **Build:** `tauri-build`

### 3. Audio Extraction & Metadata (Python)
Scripts located in `frontend/src-tauri/python/`. Used for downloading media, separating vocals, and extracting lyrics.
- **Dependencies:** `yt-dlp`, `ytmusicapi`, `requests`, `mutagen`, `audio-separator`
- **Execution:** Rust core spawns `python` sub-processes asynchronously to handle download, search, and separation logic natively.

---

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
