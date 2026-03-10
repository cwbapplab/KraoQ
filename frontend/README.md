# KraoQ - Karaoke Generator

This project is a complete Karaoke generation and playback application powered by Tauri, React, Node.js, and Python.

## External Dependencies

The project is divided into several components, each with its own set of dependencies.

### 1. Frontend Web App (React / Vite)
Located in `frontend/package.json`. Responsible for the user interface.
- **Core:** `react`, `react-dom`
- **Styling & UI:** `tailwindcss`, `postcss`, `autoprefixer`, `framer-motion`, `lucide-react`
- **Build Tools:** `vite`, `@vitejs/plugin-react`, `@tauri-apps/cli`

### 2. Desktop Core (Tauri / Rust)
Located in `frontend/src-tauri/Cargo.toml`. Provides the native desktop environment.
- **Dependencies:** `tauri`, `tauri-plugin-opener`, `serde`, `serde_json`
- **Build:** `tauri-build`

### 3. Backend API (Node.js)
Located in `frontend/src-backend/package.json`. Handles core business logic, database, and authentication.
- **Core Framework:** `express`, `cors`, `dotenv`
- **Database:** `better-sqlite3`
- **Auth & Sessions:** `bcrypt`, `jsonwebtoken`, `express-session`, `passport`, `passport-local`, `session-file-store`
- **File & Processes:** `multer`, `form-data`, `axios`, `python-shell`
- **Dev Tools:** `nodemon`

### 4. Audio Download & Metadata (Python)
Located in `frontend/src-backend/requirements.txt`. Used for downloading media and editing properties.
- **Dependencies:** `yt-dlp`, `ytmusicapi`, `requests`, `mutagen`

### 5. Audio Separator Service (Node.js + Python)
Located in `frontend/src-processor/package.json`. A dedicated service for separating vocals and instrumentals.
- **Node Dependencies:** `express`, `cors`, `multer`, `python-shell`, `dotenv`
- **Python Dependencies:** `audio-separator` (used in `src/separate.py` for AI audio separation)

---

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
