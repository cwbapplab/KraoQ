# KraoQ

> [!WARNING]
> **KraoQ is in an early alpha stage.** It is under active development, features may be incomplete or change without notice, and it has **not been tested on Linux or macOS** — Windows is currently the only supported and tested platform. Expect bugs, and use it at your own risk.

KraoQ is a desktop karaoke app. Point it at a song and it downloads the audio, fetches its lyrics, removes the vocals with AI, and plays it back as a karaoke track with word-by-word, time-synced lyrics.

It is a [Tauri](https://tauri.app) desktop application: a React front end, a Rust core, and a Python media/AI pipeline that the Rust core manages for you.

---

### This Project is FREE and Open-Source, feel free to support if you want
[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/V3Q227QNVD)

## Features

- **Song search** — search YouTube Music with autocomplete, and see which results have lyrics available.
- **Automatic audio + lyrics download** — `yt-dlp` fetches the audio and any `.lrc` subtitles; when no subtitles exist it falls back to [LRCLIB](https://lrclib.net) synced lyrics.
- **AI vocal separation** — [audio-separator](https://github.com/nomadkaraoke/python-audio-separator) produces an instrumental and an isolated vocal stem using ensemble presets (RoFormer / MDX models). Vocal isolation can be turned off to save time and disk (see below).
- **Word-level lyric timing** — forced alignment (`stable-ts`) upgrades the plain `.lrc` into an Enhanced LRC, so the karaoke highlight tracks individual words.
- **Local cache** — processed songs are stored in a local SQLite database, so replaying is instant.
- **Party mode** — guests scan a QR code to join from their phones, search and queue songs, and follow the lyrics in sync. It is brokered by the separate **KraoQ Relay Server**, which must be running (see [Party mode](#party-mode)).
- **GPU acceleration** — optional NVIDIA CUDA acceleration with a self-diagnosing status panel and a one-click repair.
- **Zero-config runtime** — Python, FFmpeg, and the AI models are downloaded and installed automatically on first run.

<img width="1697" height="1290" alt="image" src="https://github.com/user-attachments/assets/4620926c-aa15-4879-9b48-2f67fb7de7c0" />
<img width="1367" height="970" alt="image" src="https://github.com/user-attachments/assets/e9e29a7f-7292-487f-bf1f-bb47df5e6fe4" />
<img width="1110" height="743" alt="image" src="https://github.com/user-attachments/assets/5b288892-80a5-41a4-87a4-b3b3aae41b78" />
<img width="1665" height="1218" alt="image" src="https://github.com/user-attachments/assets/aa920fcc-ce63-4204-bbae-f4938ab557bd" />
<img width="1695" height="1204" alt="image" src="https://github.com/user-attachments/assets/44ae2cb5-3b63-4cb3-9dbe-7ea7c3189823" />
<img width="680" height="1769" alt="image" src="https://github.com/user-attachments/assets/0c5626f0-f8d6-4b17-a27e-afdd82ac033d" />
<img width="2132" height="1759" alt="image" src="https://github.com/user-attachments/assets/0390e475-4cb5-4d00-8e9a-f93ffca15305" />

---

## How it works

1. **Search** — `search.py` (`ytmusicapi`) returns songs with metadata and a lyrics-availability flag.
2. **Download** — `download_pipeline.py` uses `yt-dlp` to grab the best audio stream and any `.lrc` subtitle track. If YouTube has no lyrics it queries the LRCLIB API and writes an `.lrc` file.
3. **Separate** — `separate.py` runs `audio-separator` to split the track into an instrumental and an isolated vocal stem.
4. **Align** — `align_elrc.py` uses `stable-ts` to force-align the vocal stem against the lyrics, upgrading the `.lrc` to a word-level Enhanced LRC. If vocal isolation is disabled in Settings, the full track is aligned instead — faster, but the word timings are less precise.
5. **Cache & play** — the result is written to SQLite and streamed back to the UI, which renders the synced lyrics over the instrumental.

The Rust core (`frontend/src-tauri/`) orchestrates all of this and exposes it to the front end through Tauri commands: `search`, `suggestions`, `process_yt`, `cancel_processing`, `setup_dependencies`, `reinstall_dependency`, `get_app_config`, `set_config`, `check_gpu_status`, and the party-mode commands.

---

## Tech stack

| Layer | Technology |
| --- | --- |
| UI | React 18, Vite 5, Tailwind CSS, Framer Motion, lucide-react |
| Desktop core | Tauri v2 (Rust), `rusqlite`, `tokio`, `axum` + `tower-http` (party server) |
| Media & AI | Python 3.11 — `yt-dlp`, `ytmusicapi`, `audio-separator`, `stable-ts`, `onnxruntime-gpu`, PyTorch |

---

## Requirements

- **Windows** is the primary target. The dependency bootstrapper installs a bundled Python runtime, FFmpeg, and the AI models for you.
- [Node.js](https://nodejs.org) 18+ and [Yarn](https://yarnpkg.com) for the front end.
- [Rust](https://www.rust-lang.org/tools/install) with the Tauri v2 prerequisites for building the desktop shell.
- **NVIDIA GPU (optional, strongly recommended)** for CUDA acceleration — without one, vocal separation runs on the CPU and is much slower. CUDA acceleration requires:
  - **Minimum GPU:** an NVIDIA GPU with compute capability **5.0+** (GeForce GTX 750 Ti / 900-series, 2014).
  - **Driver:** NVIDIA driver **R570 or newer** (the CUDA 12.8 baseline).
  - **Recommended:** Turing or newer (GTX 16-series / RTX 20-series) for usable speed.
  - **Disk:** roughly **5 GB** of downloads for the CUDA stack (CUDA-enabled PyTorch + NVIDIA runtime libraries); a CPU-only install is ~0.3 GB.

---

## Getting started

Run these commands from the `frontend/` workspace:

```bash
yarn install     # install front-end dependencies
yarn dev         # run the app in development (tauri dev)
```

`yarn dev` starts the Vite dev server on <http://localhost:1423> and launches the Tauri desktop shell, which loads the UI from it.

Other scripts:

```bash
yarn web          # run only the web UI in a browser (no native features)
yarn build        # production desktop build (tauri build)
yarn build-web    # build just the Vite bundle
```

Android development is available through `frontend/start_android_dev.ps1` (requires an Android SDK and JDK; runs `tauri android dev` as administrator).

---

## First-run setup

On first launch the app probes for an NVIDIA GPU and, if one is found, asks whether to use CUDA acceleration before installing anything. It then runs `setup_dependencies`, which provisions everything the pipeline needs and reports progress on screen:

1. **Python runtime** — downloads a self-contained Python 3.11 environment.
2. **FFmpeg** — downloads the FFmpeg build used for audio conversion.
3. **AI models** — downloads the vocal-separation model weights.
4. **Python modules** — installs `frontend/src-tauri/python/requirements.txt` for CPU mode (`yt-dlp`, `ytmusicapi`, `requests`, `audio-separator`, `mutagen`, `onnxruntime`, `stable-ts`) or `frontend/src-tauri/python/requirements-gpu.txt` when CUDA is enabled (`audio-separator[gpu]` and `onnxruntime-gpu`).
5. **GPU toolkit** — only when CUDA was chosen: installs a CUDA-enabled PyTorch build and the matching NVIDIA runtime libraries. On CPU-only installs this step is skipped and nothing GPU-related is downloaded.

Everything is written to the app data directory (see below), so re-running setup is safe.

---

## GPU acceleration

CUDA is opt-in. On first run, if an NVIDIA card is detected, the app asks whether to enable it; declining installs only the CPU dependencies. All GPU controls in Settings stay **locked** until CUDA support is installed — when a supported card is present but CUDA isn't installed, the **GPU Acceleration** row offers a **Download NVIDIA CUDA support** button that installs it on demand. If no NVIDIA card is found, the GPU controls remain locked and unavailable.

CUDA acceleration needs an NVIDIA GPU with compute capability **5.0 or newer** (GeForce GTX 750 Ti / 900-series, 2014) and a recent driver (**R570 or newer**); Turing (GTX 16-series / RTX 20-series) or newer is recommended. The CUDA install pulls a large stack — roughly **5 GB** (CUDA-enabled PyTorch plus the NVIDIA runtime libraries).

The Settings panel has a **GPU Status** card that reports one of:

- **Active** — PyTorch can run CUDA kernels and ONNX Runtime has a CUDA provider.
- **Degraded** — a GPU was detected but the CUDA stack is incomplete or unusable.
- **CPU Only** — no GPU acceleration available.

PyTorch must ship kernels for your GPU's compute architecture. For example, RTX 50-series cards (Blackwell, `sm_120`) require PyTorch ≥ 2.7 built for CUDA 12.8. The defaults in this project are **PyTorch 2.7.1 / CUDA 12.8**.

If the status is not **Active**, the card offers a **Repair GPU (Force Re-install)** button that reinstalls the broken layer automatically — the CUDA-enabled PyTorch build, or the Python modules when ONNX Runtime is the part missing CUDA support. You can also reinstall any component individually under **Manage Dependencies**, and pin the Python, FFmpeg, PyTorch, and CUDA versions there.

---

## Party mode

Party mode lets guests join from their phones: they scan a QR code, search and queue songs, and see the current song's lyrics in sync. Because phones connect over the network, the session is brokered by a separate service — the **KraoQ Relay Server** — rather than by the desktop app directly.

> [!IMPORTANT]
> **The relay server must be running for party mode to work.** The desktop app is the *host* and runs the full media/AI pipeline, but the phones never reach it directly. Every message flows through the relay. If the relay isn't running — or isn't reachable from the phones — starting party mode fails and the QR/join link won't work.

What the relay server does:

- **Accounts and sessions** — hosts register and log in (username + password, JWT-signed). The relay creates and tracks party sessions, issuing each one a party ID and an access token.
- **Live hub between host and phones** — the desktop connects as the `host` and phones connect as `client`s. The relay forwards queue add/remove, search, suggestions, lyrics, and playback-sync messages between them over WebSockets.
- **Cached state for late joiners** — it keeps the latest playback state and song metadata, so a phone that joins mid-song immediately sees the current queue and lyrics.
- **Mobile client UI** — it serves the web client (`public/`) that phones load from the QR link over HTTPS (required for screen-wake/WakeLock).
- **REST proxying** — phone requests such as search and lyrics are proxied through the relay to the host desktop, which does the actual work.

Because the phones connect through it, the relay must be reachable by them — on the same LAN or on a public host. Point the app at it in **Settings → Cloud Relay URL** (for example `http://192.168.1.5:3000`); leave it blank to auto-detect the machine's local IP. The relay listens on HTTP port `3000` (host connection and pairing) and HTTPS port `3001` (mobile). See [`relay_server/DEPLOYMENT.md`](relay_server/DEPLOYMENT.md) for how to configure and run it (Docker or Node.js, PostgreSQL, environment variables, and TLS).

---

## Configuration and data locations

All runtime data lives in the app data directory:

```
%APPDATA%\com.cwbapplab.kraoq\
├── python_env\   # bundled Python interpreter and packages
├── bin\          # FFmpeg and other binaries
├── models\       # downloaded separation models
├── uploads\      # downloaded audio and generated stems
├── kraoq.db      # SQLite cache of processed songs
└── settings.json # user configuration
```

Settings are managed in-app. `settings.json` holds `gpuEnabled`, `gpuChoiceMade`, `pythonVersion`, `torchVersion`, `cudaVersion`, `ffmpegVersion`, `instrumentalPreset`, `vocalPreset`, and `isolateVocals`. `gpuChoiceMade` records that the first-run CUDA decision was taken (so it isn't asked again), and `gpuEnabled` is the chosen mode — the first-run prompt sets both. Turning **Isolate Vocals** off skips the vocal-separation pass and force-aligns lyrics against the full track instead — quicker and lighter on disk, but less precise word timing.

---

## Project structure

```
frontend/src/                    React application (UI, player, settings, party mode)
frontend/src-tauri/
├── src/
│   ├── lib.rs          Tauri commands, app state, processing pipeline
│   ├── setup.rs        First-run dependency bootstrapper
│   ├── db.rs           SQLite cache
│   └── server.rs       Local presentation server (port 1425) and relay client
├── python/             yt-dlp / audio-separator / alignment scripts
└── tauri.conf.json     Bundler and window configuration
relay_server/           Party-mode relay server (Docker / Node.js / PostgreSQL)
```

The **relay server** that brokered party mode is a separate project alongside this one, at [`relay_server/`](relay_server) — see [Party mode](#party-mode).

---

## Troubleshooting

- **A song fails to play.** The status bar now shows the underlying backend error (for example a CUDA or download failure) rather than a generic message. Check the error text first.
- **Playback fails on every song.** Almost always the GPU stack: open Settings and check the GPU Status card. If it is not **Active**, use **Repair GPU (Force Re-install)**.
- **Songs are processed very slowly.** Vocal separation is falling back to the CPU. Enable GPU acceleration or fix the GPU status as above.
- **A build fails with a Tauri version mismatch.** Keep the `@tauri-apps/*` npm packages and the Rust `tauri` crate on the same major/minor line.

---

## Tools used

This software was created with the help of AI. Tools used during development:

- Antigravity
- Gemini
- DeepSeek 4.1 Flash

---

## License

Copyright (C) 2026 KraoQ contributors.

This program is free software: you can redistribute it and/or modify it under the terms of the **GNU General Public License** as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version (SPDX: `GPL-3.0-or-later`).

This program is distributed in the hope that it will be useful, but **WITHOUT ANY WARRANTY**; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. The full text is included in [LICENSE](frontend/LICENSE).

---

## Credits and licenses

KraoQ builds on the work of others. Every third-party dependency and bundled component, with the license it is distributed under, is listed below.

### Front end

| Component | License | Project |
| --- | --- | --- |
| React / React DOM | MIT | <https://react.dev> |
| Vite | MIT | <https://vitejs.dev> |
| @vitejs/plugin-react | MIT | <https://github.com/vitejs/vite-plugin-react> |
| Tailwind CSS | MIT | <https://tailwindcss.com> |
| PostCSS | MIT | <https://postcss.org> |
| Autoprefixer | MIT | <https://github.com/postcss/autoprefixer> |
| Framer Motion | MIT | <https://www.framer.com/motion> |
| lucide-react | ISC | <https://lucide.dev> |
| qrcode.react | ISC | <https://github.com/zpao/qrcode.react> |
| @tauri-apps/api | MIT OR Apache-2.0 | <https://github.com/tauri-apps/tauri> |
| @tauri-apps/plugin-fs | MIT OR Apache-2.0 | <https://github.com/tauri-apps/plugins-workspace> |
| @tauri-apps/cli | MIT OR Apache-2.0 | <https://github.com/tauri-apps/tauri> |

### Desktop core (Rust)

| Component | License | Project |
| --- | --- | --- |
| Tauri / tauri-build | MIT OR Apache-2.0 | <https://tauri.app> |
| tauri-plugin-opener | MIT OR Apache-2.0 | <https://github.com/tauri-apps/plugins-workspace> |
| tauri-plugin-fs | MIT OR Apache-2.0 | <https://github.com/tauri-apps/plugins-workspace> |
| axum | MIT | <https://github.com/tokio-rs/axum> |
| tokio | MIT | <https://tokio.rs> |
| tokio-tungstenite | MIT | <https://github.com/snapview/tokio-tungstenite> |
| tungstenite | MIT OR Apache-2.0 | <https://github.com/snapview/tungstenite-rs> |
| futures-util | MIT OR Apache-2.0 | <https://github.com/rust-lang/futures-rs> |
| tower-http | MIT | <https://github.com/tower-rs/tower-http> |
| reqwest | MIT OR Apache-2.0 | <https://github.com/seanmonstar/reqwest> |
| serde / serde_json | MIT OR Apache-2.0 | <https://serde.rs> |
| rusqlite | MIT | <https://github.com/rusqlite/rusqlite> |
| anyhow | MIT OR Apache-2.0 | <https://github.com/dtolnay/anyhow> |
| zip | MIT | <https://github.com/zip-rs/zip2> |
| urlencoding | MIT | <https://github.com/kornelski/rust_urlencoding> |
| regex | MIT OR Apache-2.0 | <https://github.com/rust-lang/regex> |
| local-ip-address | MIT OR Apache-2.0 | <https://github.com/EstebanBorai/local-ip-address> |

### Relay server

| Component | License | Project |
| --- | --- | --- |
| Express | MIT | <https://expressjs.com> |
| ws | MIT | <https://github.com/websockets/ws> |
| pg | MIT | <https://node-postgres.com> |
| jsonwebtoken | MIT | <https://github.com/auth0/node-jsonwebtoken> |
| bcryptjs | MIT | <https://github.com/dcodeIO/bcrypt.js> |
| cors | MIT | <https://github.com/expressjs/cors> |
| selfsigned | MIT | <https://github.com/jfromaniello/selfsigned> |

### Media & AI pipeline (Python)

| Component | License | Project |
| --- | --- | --- |
| yt-dlp | Unlicense | <https://github.com/yt-dlp/yt-dlp> |
| ytmusicapi | MIT | <https://github.com/sigma67/ytmusicapi> |
| python-audio-separator | MIT | <https://github.com/nomadkaraoke/python-audio-separator> |
| stable-ts | MIT | <https://github.com/jianfch/stable-ts> |
| requests | Apache-2.0 | <https://requests.readthedocs.io> |
| mutagen | GPL-2.0-or-later | <https://github.com/quodlibet/mutagen> |
| ONNX Runtime | MIT | <https://onnxruntime.ai> |
| PyTorch | BSD-3-Clause | <https://pytorch.org> |

### Bundled runtimes, tools, and data

| Component | License | Project |
| --- | --- | --- |
| Python 3.11 | PSF-2.0 | <https://www.python.org> |
| FFmpeg | LGPL-2.1-or-later / GPL-2.0-or-later | <https://ffmpeg.org> |
| NVIDIA CUDA & runtime libraries | NVIDIA proprietary license | <https://developer.nvidia.com/cuda-toolkit> |
| Ultimate Vocal Remover separation models | Per-model licenses | <https://github.com/Anjok07/ultimatevocalremovergui> |
| LRCLIB | Open-source service (MIT) | <https://lrclib.net> |

Full license texts for these components ship with their respective packages and are not bundled here. Where a project is dual-licensed, KraoQ uses it under the terms you prefer.
