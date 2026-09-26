import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Music, Mic2, Maximize2, Minimize2, Play, Pause, X, ArrowRight, Loader2, Trash2, CheckCircle2, Circle, AlertCircle, Settings, Zap, RefreshCw, Cpu, Monitor, Check, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AuroraBackground from './components/AuroraBackground';
import KaraokePlayer from './components/KaraokePlayer';
// Tauri imports are loaded dynamically to prevent browser crashes
import { QRCodeSVG } from 'qrcode.react';

const DEFAULT_THUMBNAIL = `data:image/svg+xml;base64,PCFET0NUWVBFIHN2ZyBQVUJMSUMgIi0vL1czQy8vRFREIFNWRyAxLjEvL0VOIiAiaHR0cDovL3d3dy53My5vcmcvR3JhcGhpY3MvU1ZHLzEuMS9EVEQvc3ZnMTEuZHRkIj4KDTwhLS0gVXBsb2FkZWQgdG86IFNWRyBSZXBvLCB3d3cuc3ZncmVwby5jb20sIFRyYW5zZm9ybWVkIGJ5OiBTVkcgUmVwbyBNaXhlciBUb29scyAtLT4KPHN2ZyB3aWR0aD0iMTkzcHgiIGhlaWdodD0iMTkzcHgiIHZpZXdCb3g9Ii02LjQ4IC02LjQ4IDM2LjYgMzYuOTYiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+Cg08ZyBpZD0iU1ZHUmVwb19iZ0NhcnJpZXIiIHN0cm9rZS13aWR0aD0iMCI+Cg08cmVjdCB4PSItNi40OCIgeT0iLTYuNDgiIHdpZHRoPSIzNi45NiIgaGVpZ2h0PSIzNi45NiIgcng9IjIuOTU2OCIgZmlsbD0iIzI5MjkyOSIgc3Ryb2tlLXdpZHRoPSIwIi8+Cg08L2c+Cg08ZyBpZD0iU1ZHUmVwb190cmFjZXJDYXJyaWVyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KDTxnIGlkPSJTVkdSZXBvX2ljb25DYXJyaWVyIj4gPHBhdGggZD0iTTEyLjc1IDEyLjUwOEwyMS4yNSA5LjEwOFYxNC43NjA5QzIwLjc0NDkgMTQuNDM3NSAyMC4xNDQzIDE0LjI1IDE5LjUgMTQuMjVDMTcuNzA1MSAxNC4yNSAxNi4yNSAxNS43MDUxIDE2LjI1IDE3LjVDMTYuMjUgMTkuMjk0OSAxNy43MDUxIDIwLjc1IDE5LjUgMjAuNzVDMjEuMjk0OSAyMC43NSAyMi43NSAxOS4yOTQ5IDIyLjc1IDE3LjVDMjIuNzUgMTcuNSAyMi43NSAxNy41IDIyLjc1IDE3LjVMMjIuNzUgNy45NDYyNUMyMi43NSA2LjgwMzQyIDIyLjc1IDUuODQ0OTYgMjIuNjY5NiA1LjA4MTMxQzIyLjY1ODIgNC45NzMzOSAyMi42NDQ4IDQuODY2MDkgMjIuNjMgNC43NjU5N0MyMi41NTI1IDQuMjQ0MjYgMjIuNDE1NiAzLjc1NzU3IDIyLjE1MTQgMy4zNTExNUMyMi4wMTkzIDMuMTQ3OTQgMjEuODU1MyAyLjk2NDgxIDIxLjY1MTEgMi44MDczOUMyMS42MTI4IDIuNzc3ODggMjEuNTczIDIuNzQ5MjcgMjEuNTMxOSAyLjcyMTZMMjEuNTIzNiAyLjcxNjA4QzIwLjgxNjQgMi4yNDU0IDIwLjAyMTMgMi4yNzkwNiAxOS4yMDIzIDIuNDg3NzdDMTguNDEwMiAyLjY4OTYxIDE3LjQyODIgMy4xMDA2NSAxNi4yMjQgMy42MDQ2OUwxNC4xMyA0LjQ4MTE1QzEzLjU2NTUgNC43MTczNyAxMy4wODczIDQuOTE3NTEgMTIuNzEyIDUuMTI0OEMxMi4zMTI2IDUuMzQ1MzUgMTEuOTY4NiA1LjYwNTQ4IDExLjcxMDYgNS45OTMxMUMxMS40NTI3IDYuMzgwNzUgMTEuMzQ1NSA2Ljc5ODUgMTEuMjk2MyA3LjI1MjA0QzExLjI1IDcuNjc4MzEgMTEuMjUgOC4xOTY3MSAxMS4yNSA4LjgwODU4VjE2Ljc2MDlDMTAuNzQ0OCAxNi40Mzc1IDEwLjE0NDMgMTYuMjUgOS41IDE2LjI1QzcuNzA1MDcgMTYuMjUgNi4yNSAxNy43MDUxIDYuMjUgMTkuNUM2LjI1IDIxLjI5NDkgNy43MDUwNyAyMi43NSA5LjUgMjIuNzVDMTEuMjk0OSAyMi43NSAxMi43NSAyMS4yOTQ5IDEyLjczIDE5LjVDMTIuNzUgMTkuNSAxMi43NSAxOS41IDEyLjczIDE5LjVMMTIuNzUgMTIuNTA4WiIgZmlsbD0iI2ZmZmZmZiIvPiA8cGF0aCBvcGFjaXR5PSIwLjUiIGQ9Ik03Ljc1IDJDNy43NSAxLjU4NTc5IDcuNDE0MjEgMS4yNSA3IDEuMjVDNi41ODU3OSAxLjI1IDYuMjUgMS41ODU3OSA2LjI1IDJWNy43NjA5MUM1Ljc0NDg1IDcuNDM3NSA1LjE0NDMyIDcuMjUgNC41IDcuMjVDMi43MDUwNyA3LjI1IDEuMjUgOC43MDUwNyAxLjI1IDEwLjVDMS4yNSAxMi4yOTQ5IDIuNzA1MDcgMTMuNzUgNC41IDEzLjc1QzYuMjk0OTMgMTMuNzUgNy43NSAxMi4yOTQ5IDcuNzUgMTAuNVY1LjAwNDVDOC40NDg1MiA1LjUwOTEzIDkuMjc5NTUgNS43NSAxMCA1Ljc1QzEwLjQxNDIgNS43NSAxMC43NSA1LjQxNDIxIDEwLjc1IDVDMTAuNzUgNC41ODU3OSAxMC40MTQyIDQuMjUgMTAgNC4yNUM5LjU0NTY1IDQuMjUgOC45NjYzIDQuMDczODkgOC41MTE1OSAzLjY5ODM3QzguMDc4NCAzLjM0MDYxIDcuNzUgMi43OTc4NSA3Ljc1IDJaIiBmaWxsPSIjZmZmZmZmIi8+IDwvZz4KDTwvc3ZnPg==`;

const AVAILABLE_VERSIONS = {
    pythonVersion: ['3.11.8', '3.10.11', '3.9.13'],
    ffmpegVersion: ['latest', '7.1', '6.1', '5.1'],
    torchVersion: ['2.5.1', '2.4.1', '2.3.1', '2.2.2'],
    cudaVersion: ['12.1', '11.8']
};

const isMobile = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

const isPresentationView = typeof window !== 'undefined' && window.location.href.toLowerCase().includes('view=presentation');

const isTauri = typeof window !== 'undefined' && 
                window.__TAURI_INTERNALS__ !== undefined && 
                !isPresentationView;

const appListen = async (event, handler) => {
    if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__) {
        try {
            // We still need the event module for listen because it's complex
            // but we'll only import it if we are sure we are in Tauri
            const { listen } = await import('@tauri-apps/api/event');
            return await listen(event, handler);
        } catch (e) {
            console.error(`Tauri listen error for ${event}:`, e);
            return () => {};
        }
    }
    return () => {};
};

const appInvoke = async (cmd, args = {}) => {
    if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__) {
        try {
            // Use the raw invoke from internals to avoid package-level side effects
            return await window.__TAURI_INTERNALS__.invoke(cmd, args);
        } catch (e) {
            console.error(`Tauri invoke error for ${cmd}:`, e);
            throw e;
        }
    }
    
    // For browser (presentation view or party client)
    try {
        const response = await fetch(`/invoke`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cmd, args })
        });
        
        if (!response.ok) {
            throw new Error(`Command failed with status ${response.status}`);
        }

        const text = await response.text();
        try {
            return JSON.parse(text);
        } catch (e) {
            return text;
        }
    } catch (e) {
        console.error(`Local invoke error for ${cmd}:`, e);
        // Fallback for relay API if applicable
        if (cmd === 'search' || cmd === 'suggestions' || cmd === 'process_yt') {
             const route = cmd === 'process_yt' ? 'process_yt?query=' : `${cmd}?query=`;
             const response = await fetch(`/api/${route}${encodeURIComponent(args.query || args.videoId || '')}`);
             const data = await response.json();
             return JSON.stringify(data);
        }
        throw e;
    }
};

const appConvertFileSrc = async (path) => {
    if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__) {
        try {
            const { convertFileSrc } = await import('@tauri-apps/api/core');
            return convertFileSrc(path);
        } catch (e) {
            console.error("convertFileSrc failed", e);
        }
    }
    if (!path) return "";
    
    // In Browser, we assume the file name is unique and served from either /uploads or /library
    // The backend now hosts both. We try to infer which one to use.
    const filename = path.split(/[\\/]/).pop();
    const protocol = window.location.protocol;
    const host = window.location.hostname;
    const port = 1425;
    
    // Most processed files are in uploads. Original ones are in library.
    // For simplicity, we can default to /uploads and fallback to /library if we had more info,
    // but usually files have tags like _(Instrumental) if they are processed.
    const isLibrary = !path.includes('uploads') && !path.includes('separate');
    const folder = isLibrary ? 'library' : 'uploads';
    
    return `${protocol}//${host}:${port}/${folder}/${filename}`;
};

function App() {
    // safe wrappers to prevent browser crashes
    const listen = appListen; 
    const invoke = appInvoke;
    const convertFileSrc = appConvertFileSrc;


    const [setupStatus, setSetupStatus] = useState("Checking dependencies...");
    const [isLockedByWeb, setIsLockedByWeb] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [showControls, setShowControls] = useState(false);
    const forceReconnectRef = useRef(false);
    const [reconnectTrigger, setReconnectTrigger] = useState(0);
    const [resumeTime, setResumeTime] = useState(0);
    const wsRef = useRef(null);

    useEffect(() => {
        if (!isTauri) {
            let ws;
            const timer = setTimeout(() => {
                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                const host = window.location.hostname;
                const url = `${protocol}//${host}:1425/api/ws${forceReconnectRef.current ? '?force=true' : ''}`;
                ws = new WebSocket(url);
                wsRef.current = ws;

                ws.onopen = () => {
                    setIsLockedByWeb(false);
                    forceReconnectRef.current = false;
                };

                ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        if (data.type === 'error' && data.message === 'disconnected_by_force') {
                            if (audioRef.current) audioRef.current.pause();
                            setKaraokeMode(false);
                            setCurrentSong(null);
                            setIsLockedByWeb(true);
                            alert("Disconnected: Display taken over by another screen.");
                        } else if (data.type === 'sync_state') {
                            const payload = data.payload;
                            if (payload.lyricsData) {
                                setLyricsData(payload.lyricsData);
                            }
                            if (payload.audioMode) {
                                setAudioMode(payload.audioMode);
                            }
                            
                            // Resolve local URLs for web clients
                            const processedSong = payload.currentSong ? { ...payload.currentSong } : null;
                            if (processedSong && !isTauri) {
                                const resolveWebUrl = (path) => {
                                    if (!path) return "";
                                    if (path.startsWith('http') && !path.includes('asset.localhost') && !path.includes('localhost:1425')) return path;
                                    
                                    const decodedPath = decodeURIComponent(path);
                                    const filename = decodedPath.split(/[\\/]/).pop();
                                    const isLibrary = !decodedPath.includes('uploads') && !decodedPath.includes('separate');
                                    const folder = isLibrary ? 'library' : (decodedPath.includes('separate') ? 'separate' : 'uploads');
                                    
                                    return `${window.location.protocol}//${window.location.hostname}:1425/${folder}/${filename}`;
                                };
                                processedSong.instrumentalUrl = resolveWebUrl(processedSong.instrumentalUrl);
                                processedSong.vocalsUrl = resolveWebUrl(processedSong.vocalsUrl);
                            }

                            setCurrentSong(processedSong);
                            setIsPlaying(payload.isPlaying);
                            setIsAutoPaused(!payload.isPlaying);
                            
                            if (audioRef.current && Math.abs(audioRef.current.currentTime - payload.currentTime) > 1.5) {
                                audioRef.current.currentTime = payload.currentTime;
                            }
                        } else if (data.type === 'error' && data.message === 'locked') {
                            setIsLockedByWeb(true);
                        } else if (data.type === 'queue_add') {
                            const payload = data.payload;
                            setQueue(prev => {
                                if (prev.some(item => (item.videoId || item.video_id) === (payload.videoId || payload.video_id) && item.deviceId === payload.deviceId)) return prev;
                                return [...prev, { ...payload, status: 'waiting' }];
                            });
                        } else if (data.type === 'queue_remove') {
                            const payload = data.payload;
                            setQueue(prev => prev.filter(item => !((item.videoId || item.video_id) === (payload.videoId || payload.video_id) && item.deviceId === payload.deviceId)));
                        }
                    } catch (e) {
                        console.error("WS error parsing", e);
                    }
                };
            }, 100);

            return () => {
                clearTimeout(timer);
                if (ws) ws.close();
            };
        }

        let unlistenLock;
        let unlistenForce;
        let unlistenDisconnect;

        const listenWebStatus = async () => {
            unlistenLock = await listen('web_viewer_status', (event) => {
                setIsLockedByWeb(!!event.payload);
            });
            unlistenForce = await listen('force_takeover_happened', () => {
                if (audioRef.current) audioRef.current.pause();
                setKaraokeMode(false);
                setCurrentSong(null);
            });
            unlistenDisconnect = await listen('party_mode_disconnected', () => {
                setIsPartyMode(false);
                setPartyUrl("");
                setConfirmModal({
                    isOpen: true,
                    title: "Relay Lost",
                    message: "Connection to the party relay was lost. You are now offline.",
                    type: 'error'
                });
            });
        };
        listenWebStatus();
        return () => {
            if (unlistenLock) unlistenLock();
            if (unlistenForce) unlistenForce();
            if (unlistenDisconnect) unlistenDisconnect();
        }

    }, [reconnectTrigger]);

    // Party mode cleanup on refresh
    useEffect(() => {
        return () => {
            if (isTauri) {
                invoke('stop_party_mode').catch(console.error);
            }
        };
    }, []);

    const handleTauriTakeover = async () => {
        await invoke('force_takeover');
        setIsLockedByWeb(false);
    };

    const [setupSteps, setSetupSteps] = useState([
        { id: 'python', label: 'Python Runtime', status: 'pending', progress: 0 },
        { id: 'ffmpeg', label: 'FFmpeg Engine', status: 'pending', progress: 0 },
        { id: 'models', label: 'AI Vocal Models', status: 'pending', progress: 0 },
        { id: 'pip', label: 'Neural Modules', status: 'pending', progress: 0 },
        { id: 'gpu', label: 'GPU Acceleration', status: 'pending', progress: 0 },
    ]);
    const [isReady, setIsReady] = useState(isPresentationView);
    const [query, setQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [karaokeMode, setKaraokeMode] = useState(false);
    const [currentSong, setCurrentSong] = useState(null);
    const [status, setStatus] = useState("");
    const [lyricsData, setLyricsData] = useState([]);
    const [songCache, setSongCache] = useState({});
    const [recentSongs, setRecentSongs] = useState([]);
    const [searchHistory, setSearchHistory] = useState([]);
    const [showSearchDropdown, setShowSearchDropdown] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [activeLineIndex, setActiveLineIndex] = useState(-1);
    const [nextLinesPreview, setNextLinesPreview] = useState("");
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [selectedRect, setSelectedRect] = useState(null);
    const [transitionStage, setTransitionStage] = useState('idle'); // idle, start, hero
    const [selectedSource, setSelectedSource] = useState(null); // 'search' or 'recent'
    const [isProcessing, setIsProcessing] = useState(false);
    const [isAutoPaused, setIsAutoPaused] = useState(false);
    const [nextSingerCount, setNextSingerCount] = useState(null);
    const [nextSingerName, setNextSingerName] = useState("");
    const [nextSongItem, setNextSongItem] = useState(null);
    const [isWaitingForNextQueue, setIsWaitingForNextQueue] = useState(false);
    const [suggestions, setSuggestions] = useState([]);




    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [searchLimit, setSearchLimit] = useState(20);
    const [headerRect, setHeaderRect] = useState(null);
    // const [showLoginModal, setShowLoginModal] = useState(false); // Removed for local single-user
    const [contextMenu, setContextMenu] = useState({ isOpen: false, videoId: null, position: { x: 0, y: 0 } });
    const [showSettings, setShowSettings] = useState(false);
    const [appConfig, setAppConfig] = useState({ gpuEnabled: true });
    const [isPartyMode, setIsPartyMode] = useState(false);
    const [partyUrl, setPartyUrl] = useState("");
    const [activePartyId, setActivePartyId] = useState("");
    const [activePartyToken, setActivePartyToken] = useState("");
    const [queue, setQueue] = useState([]); // Array of { videoId, title, artists, status }
    const [showLyricsSearch, setShowLyricsSearch] = useState(false);
    const [lyricsSearchQuery, setLyricsSearchQuery] = useState("");
    const [lyricsSearchResults, setLyricsSearchResults] = useState([]);
    const [isSearchingLyrics, setIsSearchingLyrics] = useState(false);
    const [targetVideoIdForLyrics, setTargetVideoIdForLyrics] = useState(null);
    const [presentationUrl, setPresentationUrl] = useState("");
    const [lyricsStatus, setLyricsStatus] = useState({ activeId: null, downloadedIds: [] });
    // Auth State
    const [loginToken, setLoginToken] = useState(null);
    const [loginUser, setLoginUser] = useState(null);
    const [showLoginOverlay, setShowLoginOverlay] = useState(false);
    const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
    const [authLoading, setAuthLoading] = useState(false);

    const [isReinstalling, setIsReinstalling] = useState(null); // id of dependency being reinstalled
    const [gpuStatus, setGpuStatus] = useState(null); // { status, message, torchVersion, ... }
    const [isCheckingGpu, setIsCheckingGpu] = useState(false);
    const [audioMode, setAudioMode] = useState('instrumental'); // 'instrumental' or 'vocals'
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', type: 'default', confirmText: 'Confirm', onConfirm: () => { } });
    const headerRef = useRef(null);
    const audioRef = useRef(null);
    const karaokeContainerRef = useRef(null);
    const recentSongsRef = useRef(null);
    const targetScrollRef = useRef(0);
    const currentScrollRef = useRef(0);
    const isScrollingRef = useRef(false);
    const [scrollingTick, setScrollingTick] = useState(0);
    const searchInputRef = useRef(null);
    const pressTimerRef = useRef(null);
    const longPressTriggeredRef = useRef(false);

    // Force body overflow for presentation mode
    useEffect(() => {
        if (isPresentationView) {
            document.body.style.overflow = 'hidden';
            return () => { document.body.style.overflow = 'auto'; };
        }
    }, [isPresentationView]);

    // HTTP Server Management
    useEffect(() => {
        if (!isTauri) return;

        const manageServer = async () => {
            if (appConfig.appMode === 'presentation') {
                try {
                    const url = await invoke('start_http_server');
                    setPresentationUrl(`${url}/?view=presentation`);
                } catch (err) {
                    console.error("Failed to start presentation server:", err);
                }
            } else {
                try {
                    await invoke('stop_http_server');
                    setPresentationUrl("");
                } catch (err) {
                    // Ignore
                }
            }
        };

        manageServer();

        return () => {
            if (isTauri) invoke('stop_http_server').catch(() => { });
        };
    }, [appConfig.appMode]);

    // Inertial Smooth Scroll Loop
    useEffect(() => {
        if (!recentSongsRef.current || !isScrollingRef.current) return;

        let frameId;
        const smooth = () => {
            if (!recentSongsRef.current) {
                isScrollingRef.current = false;
                return;
            }

            const diff = targetScrollRef.current - currentScrollRef.current;
            if (Math.abs(diff) > 0.1) {
                currentScrollRef.current += diff * 0.12;
                recentSongsRef.current.scrollLeft = currentScrollRef.current;
                frameId = requestAnimationFrame(smooth);
            } else {
                currentScrollRef.current = targetScrollRef.current;
                recentSongsRef.current.scrollLeft = currentScrollRef.current;
                isScrollingRef.current = false;
            }
        };

        frameId = requestAnimationFrame(smooth);
        return () => cancelAnimationFrame(frameId);
    }, [scrollingTick]);

    // Setup Dependencies Logic
    const setupStarted = useRef(false);
    useEffect(() => {
        if (setupStarted.current) return;
        setupStarted.current = true;

        let unlisten;
        const initApp = async () => {
            if (!isTauri || isPresentationView) {
                console.log("Browser environment detected. Skipping native dependency check.");
                setIsReady(true);
                return;
            }
            try {
                // Double check isTauri inside the async block
                if (!window.__TAURI_INTERNALS__) {
                    setIsReady(true);
                    return;
                }

                // Listen for granular step updates
                const unlistenStep = await listen('setup_step', (event) => {
                    const { id, label, status, progress } = event.payload;
                    setSetupSteps(prev => prev.map(step =>
                        step.id === id ? { ...step, label, status, progress } : step
                    ));
                    setSetupStatus(label);
                });

                const unlistenComplete = await listen('setup_complete', () => {
                    setIsReady(true);
                });

                await invoke('setup_dependencies');

                return () => {
                    unlistenStep();
                    unlistenComplete();
                };
            } catch (e) {
                console.error("Setup failed", e);
                setSetupStatus("Critical Error: " + e.message);
            }
        };

        unlisten = initApp();
        loadConfig();

        return () => {
            if (unlisten) unlisten.then(f => f && typeof f === 'function' && f());
        };
    }, []);

    // Listen to processing status updates
    useEffect(() => {
        if (!isTauri) return;
        let unlistenStatus;
        const initStatusListener = async () => {
            unlistenStatus = await listen('process_status', (event) => {
                if (event.payload && event.payload.step) {
                    setStatus(event.payload.step);
                }
            });
        };
        initStatusListener();
        return () => {
            if (unlistenStatus) unlistenStatus();
        };
    }, []);

    const isJwtExpired = (token) => {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return payload.exp && payload.exp * 1000 < Date.now();
        } catch { return true; }
    };

    const loadConfig = async () => {
        if (!isTauri || isPresentationView) return;
        try {
            const config = await invoke('get_app_config');
            setAppConfig(config);
            if (config.userToken && !isJwtExpired(config.userToken)) {
                setLoginToken(config.userToken);
                setLoginUser(config.username);
            } else if (config.userToken) {
                // Token expired, clear it
                updateConfig({ ...config, userToken: '', username: '' });
            }
        } catch (e) {
            console.error("Failed to load config", e);
        }
    };

    const updateConfig = async (newConfig) => {
        try {
            setAppConfig(newConfig);
            await invoke('set_config', { config: newConfig });
        } catch (e) {
            console.error("Failed to save config", e);
        }
    };

    const checkGpuStatus = useCallback(async () => {
        setIsCheckingGpu(true);
        try {
            const status = await invoke('check_gpu_status');
            setGpuStatus(status);
        } catch (e) {
            console.error('GPU check failed', e);
            setGpuStatus({ status: 'unavailable', message: 'Failed to check: ' + e, torchVersion: '', torchCudaAvailable: false, torchCudaVersion: '', onnxProviders: [], cudaDeviceName: '' });
        } finally {
            setIsCheckingGpu(false);
        }
    }, []);

    // Check GPU status when settings are opened
    useEffect(() => {
        if (showSettings && !gpuStatus && !isCheckingGpu) {
            checkGpuStatus();
        }
    }, [showSettings]);

    const handleReinstall = async (id) => {
        setIsReinstalling(id);
        try {
            await invoke('reinstall_dependency', { id });
            setSetupSteps(prev => prev.map(step =>
                step.id === id ? { ...step, status: 'done', progress: 100 } : step
            ));
            // Refresh GPU status after reinstalling GPU toolkit or pip
            if (id === 'gpu' || id === 'pip') {
                setGpuStatus(null);
                checkGpuStatus();
            }
        } catch (e) {
            console.error(`Failed to reinstall ${id}`, e);
            alert(`Failed to reinstall ${id}: ${e}`);
        } finally {
            setIsReinstalling(null);
        }
    };

    const openLyricsSearch = (videoId, defaultQuery) => {
        setTargetVideoIdForLyrics(videoId);
        setLyricsSearchQuery(defaultQuery || "");
        setShowLyricsSearch(true);
        invoke('get_lyrics_status', { videoId: videoId }).then(res => setLyricsStatus(res)).catch(e => console.error("Status error", e));
        if (defaultQuery) {
            handleLyricsSearch(defaultQuery, videoId);
        }
    };

    const handleLyricsSearch = async (q, overrideVideoId = null) => {
        setIsSearchingLyrics(true);
        const searchTargetId = overrideVideoId || targetVideoIdForLyrics;
        
        try {
            const results = await invoke('search_lrclib', { query: q });
            let sortedResults = results;
            
            // Sort by duration proximity if searching for the currently playing song
            if (audioRef.current && currentSong && (currentSong.videoId === searchTargetId || currentSong.video_id === searchTargetId)) {
                const targetDuration = audioRef.current.duration;
                if (targetDuration && targetDuration > 0) {
                    sortedResults.sort((a, b) => Math.abs(a.songLength - targetDuration) - Math.abs(b.songLength - targetDuration));
                }
            }
            
            setLyricsSearchResults(sortedResults);
        } catch (e) {
            console.error("Lyrics search failed", e);
        } finally {
            setIsSearchingLyrics(false);
        }
    };

    const confirmApplyLyrics = (result) => {
        setConfirmModal({
            isOpen: true,
            title: "Apply Lyrics?",
            message: `Do you want to apply lyrics for "${result.lrcName}"? This will trigger AI re-synchronization.`,
            confirmText: "Yes, Apply",
            cancelText: "Cancel",
            onConfirm: () => applyAltLyrics(result.syncedLyrics || result.plainLyrics, result.id),
            type: 'warning'
        });
    };

    const applyAltLyrics = async (lyricsText, lrclibId) => {
        // Auto close the search modal immediately on selection
        setShowLyricsSearch(false);
        
        const wasInKaraoke = karaokeMode;
        if (wasInKaraoke) {
            setKaraokeMode(false);
            if (audioRef.current) audioRef.current.pause();
        }
        
        setStatus("Applying alternative lyrics...");
        try {
            const resStr = await invoke('apply_alternative_lyrics', { 
                videoId: targetVideoIdForLyrics, 
                lyricsText,
                lrclibId
            });
            const res = JSON.parse(resStr);
            
            // If the song being updated is the current song, update the player state
            if (currentSong && (currentSong.videoId === targetVideoIdForLyrics || currentSong.video_id === targetVideoIdForLyrics)) {
                setLyricsData(res.data.segments);
            }
            
            setConfirmModal({
                isOpen: true,
                title: "Success",
                message: "Alternative lyrics applied and synchronized.",
                type: 'default',
                confirmText: wasInKaraoke ? 'Sing Now!' : 'Great',
                onConfirm: () => {
                    if (wasInKaraoke && currentSong) {
                        processSong(currentSong, currentSong.thumbnail);
                    }
                }
            });
        } catch (e) {
            console.error("Failed to apply lyrics", e);
            alert("Error: " + e);
        } finally {
            setStatus("");
        }
    };

    const handleAuth = async (username, password) => {
        setAuthLoading(true);
        try {
            const relayHost = appConfig.relayUrl || "http://localhost:3000";
            const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
            const response = await fetch(`${relayHost}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Auth failed');

            if (authMode === 'login') {
                setLoginToken(data.token);
                setLoginUser(data.username);
                setShowLoginOverlay(false);
                updateConfig({ ...appConfig, userToken: data.token, username: data.username });
                // Auto-trigger party creation after successful login
                setTimeout(() => handlePartyToggle(), 100);
            } else {
                setConfirmModal({
                    isOpen: true,
                    title: "Registered!",
                    message: "Account created successfully. You can now log in.",
                    type: 'default',
                    onConfirm: () => setAuthMode('login')
                });
            }
        } catch (e) {
            alert("Auth Error: " + e.message);
        } finally {
            setAuthLoading(false);
        }
    };

    const handlePartyToggle = async () => {
        if (!isTauri) return;

        if (isPartyMode) {
            setIsPartyMode(false);
            setPartyUrl("");
            invoke('stop_party_mode').catch(console.error);
        } else {
            // Check for login first
            if (!loginToken) {
                setShowLoginOverlay(true);
                return;
            }

            let partyName = "";
            let existingPartyId = "";
            let existingToken = "";

            const now = Math.floor(Date.now() / 1000);
            const isRecent = appConfig.lastPartyTimestamp && (now - appConfig.lastPartyTimestamp < 24 * 3600);

            if (isRecent && appConfig.lastPartyId) {
                const displayName = appConfig.lastPartyName || appConfig.lastPartyId;
                const choice = confirm(`You had an active party "${displayName}" in the last 24h. Do you want to continue it?\n\n(Cancel to create a new one)`);
                if (choice) {
                    partyName = appConfig.lastPartyName || '';
                    existingPartyId = appConfig.lastPartyId;
                    existingToken = appConfig.lastPartyToken;
                }
            }

            if (!partyName && !existingPartyId) {
                partyName = prompt("Enter a Party Name:", "KraoQ Party");
                if (!partyName) return;
            }

            let relayHost = appConfig.relayUrl || "";
            let secureRelayHost = "";

            if (!relayHost) {
                try {
                    const ip = await invoke('get_local_ip_addr');
                    relayHost = `http://${ip}:3000`;
                    // Secure link for mobile (WakeLock requirement)
                    secureRelayHost = `https://${ip}:3001`;
                } catch (e) {
                    relayHost = "http://localhost:3000";
                    secureRelayHost = "https://localhost:3001";
                }
            } else {
                // If user has a custom relay, try to derive secure port
                secureRelayHost = relayHost.replace("http://", "https://");
                if (secureRelayHost.includes(":3000")) {
                     secureRelayHost = secureRelayHost.replace(":3000", ":3001");
                }
            }

            try {
                const resultStr = await invoke('start_party_mode', {
                    relayUrl: relayHost,
                    jwtToken: loginToken,
                    partyName: partyName,
                    partyId: existingPartyId,
                    token: existingToken
                });
                const partyResult = JSON.parse(resultStr);

                setIsPartyMode(true);
                // The Join URL we show the user should be the SECURE one for mobile features
                setPartyUrl(`${secureRelayHost}/?party_id=${partyResult.partyId}&token=${partyResult.token}`);
                setActivePartyId(partyResult.partyId);
                setActivePartyToken(partyResult.token);

                // Save this party as the last one
                const newConfig = {
                    ...appConfig,
                    lastPartyName: partyResult.partyName,
                    lastPartyId: partyResult.partyId,
                    lastPartyToken: partyResult.token,
                    lastPartyTimestamp: now
                };
                setAppConfig(newConfig);
                invoke('set_config', { config: newConfig }).catch(console.error);

            } catch (e) {
                console.error("Failed to connect to relay", e);
                const errMsg = String(e);
                if (errMsg.includes('401') || errMsg.includes('403') || errMsg.includes('Authentication')) {
                    setLoginToken(null);
                    updateConfig({ ...appConfig, userToken: '', username: '' });
                    setShowLoginOverlay(true);
                } else {
                    alert(`Failed to start party mode: ${e}`);
                }
            }
        }
    };

    // Listen for queue updates from local webserver
    useEffect(() => {
        if (!isTauri) {
            const pollQueue = async () => {
                try {
                    const response = await fetch('/api/queue');
                    if (response.ok) {
                        const data = await response.json();
                        setQueue(prev => {
                            const qList = data.queue || [];
                            return qList.map(item => {
                                const existing = prev.find(p => p.videoId === item.videoId && p.deviceId === item.deviceId);
                                return existing ? existing : { ...item, status: 'waiting' };
                            });
                        });
                    }
                } catch (e) {
                    console.error("Polling queue error", e);
                }
            };
            pollQueue();
            return;
        }

        let unlistenParty;
        const initPartyListener = async () => {
            unlistenParty = await listen('party_add_to_queue', (event) => {
                const payload = event.payload;
                setQueue(prev => {
                    if (prev.some(item => item.videoId === payload.videoId)) return prev;
                    return [...prev, { ...payload, status: 'waiting' }];
                });
            });
        };
        initPartyListener();
        return () => { if (unlistenParty) unlistenParty(); };
    }, []);

    // Upload song metadata once when track changes or lyrics become available
    useEffect(() => {
        if (!isPartyMode || !currentSong?.videoId || !activePartyId) return;

        const uploadMetadata = async () => {
            // Use HTTP for local/internal metadata sync to avoid self-signed cert issues with HTTPS in Tauri
            const relayBase = partyUrl.split('/?')[0].replace("https://", "http://").replace(":3001", ":3000");
            const payload = {
                partyId: activePartyId,
                token: activePartyToken,
                metadata: {
                    title: currentSong.title,
                    artist: currentSong.artist,
                    lyrics: lyricsData,
                    videoId: currentSong.videoId
                }
            };

            try {
                console.log(`[Party] Uploading metadata for ${currentSong.title} to ${relayBase} (${lyricsData?.length || 0} lines)`);
                const res = await fetch(`${relayBase}/api/party/metadata`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (!res.ok) console.warn('[Party] Metadata upload failed:', res.status);
                else console.log('[Party] Metadata uploaded successfully');
            } catch (e) {
                console.error('[Party] Failed to upload metadata to', relayBase, e);
            }
        };

        uploadMetadata();
    }, [currentSong?.videoId, lyricsData, isPartyMode, activePartyId]);

    // Sync playback state with Party Relay
    const syncStateRef = useRef({ currentSong, isPlaying, karaokeMode, lyricsData, audioMode });
    useEffect(() => {
        syncStateRef.current = { currentSong, isPlaying, karaokeMode, lyricsData, audioMode };
    }, [currentSong, isPlaying, karaokeMode, lyricsData, audioMode]);

    useEffect(() => {
        if (!isPartyMode && appConfig.appMode !== 'presentation') return;
        const isPresentation = appConfig.appMode === 'presentation';

        const syncState = (isFull = false) => {
            const { currentSong: cs, isPlaying: ip, karaokeMode: km, lyricsData: ld, audioMode: am } = syncStateRef.current;
            const msg = {
                type: 'sync_state',
                payload: {
                    currentSong: isFull ? cs : { videoId: cs?.videoId, title: cs?.title, artist: cs?.artist, thumbnail: cs?.thumbnail },
                    isPlaying: ip,
                    isKaraokeMode: km,
                    currentTime: (audioRef.current && isFinite(audioRef.current.currentTime)) ? audioRef.current.currentTime : 0,
                    duration: (audioRef.current && isFinite(audioRef.current.duration)) ? audioRef.current.duration : 0,
                    lyricsData: isFull ? ld : undefined,
                    audioMode: am,
                    singer: cs?.singer || "Host",
                    partyUrl: partyUrl || undefined
                }
            };

            if (isPartyMode || appConfig.appMode === 'presentation') {
                if (isTauri) {
                    invoke('broadcast_ws', { payload: msg, localOnly: isPresentation }).catch(console.error);
                } else if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify(msg));
                }
            }
        };

        // Immediate Full Sync (always needed for initial song delivery)
        syncState(true);

        // One retry for reliability
        const t1 = setTimeout(() => syncState(true), 2000);

        // Periodic Light Sync — only when NOT in presentation mode (presentation view sends its own sync)
        let interval;
        if (!isPresentation) {
            interval = setInterval(() => syncState(false), 10000);
        }

        return () => {
            clearTimeout(t1);
            if (interval) clearInterval(interval);

            // Send one last "stopped" update
            const stopMsg = {
                type: 'sync_state',
                payload: {
                    currentSong: null,
                    isPlaying: false,
                    isKaraokeMode: false,
                    currentTime: 0,
                    duration: 0,
                    singer: ""
                }
            };
            if (isTauri) {
                invoke('broadcast_ws', { payload: stopMsg }).catch(console.error);
            } else if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify(stopMsg));
            }
        };
    }, [isPartyMode, appConfig.appMode]);

    // Broadcast full sync when meaningful state changes
    useEffect(() => {
        if (!isPartyMode && appConfig.appMode !== 'presentation') return;

        const isPresentation = appConfig.appMode === 'presentation';
        const { currentSong: cs, isPlaying: ip, karaokeMode: km, lyricsData: ld, audioMode: am } = syncStateRef.current;
        const msg = {
            type: 'sync_state',
            payload: {
                currentSong: cs,
                // In presentation mode, always send isPlaying: false to avoid conflicting
                // with the presentation view's own playback control
                isPlaying: isPresentation ? false : ip,
                isKaraokeMode: km,
                currentTime: isPresentation ? 0 : (audioRef.current && isFinite(audioRef.current.currentTime)) ? audioRef.current.currentTime : 0,
                duration: isPresentation ? 0 : (audioRef.current && isFinite(audioRef.current.duration)) ? audioRef.current.duration : 0,
                lyricsData: ld,
                audioMode: am,
                singer: cs?.singer || "Host",
                partyUrl: partyUrl || undefined
            }
        };
        if (isTauri) {
            invoke('broadcast_ws', { payload: msg, localOnly: isPresentation }).catch(console.error);
        } else if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(msg));
        }
    }, [currentSong?.videoId, isPlaying, audioMode, karaokeMode, lyricsData, appConfig.appMode, partyUrl]);

    // Listen for client joins to trigger immediate sync
    useEffect(() => {
        if (!isPartyMode && appConfig.appMode !== 'presentation') return;
        const isPresentation = appConfig.appMode === 'presentation';

        const unlisten = listen('party_client_joined', () => {
            // CRITICAL: If we are in presentation mode, the PresentationView is the sync master.
            // We (the Host app) are followers only. We MUST NOT broadcast state updates directly
            // from here, but we SHOULD trigger the PresentationView to broadcast its current state.
            if (isPresentation) {
                console.log("[Party] Client joined. Requesting sync from Master Presentation View...");
                emit('request_presentation_sync', {});
                return;
            }

            console.log("[Party] Client joined notification received. Pushing fresh sync...");
            const { currentSong: cs, isPlaying: ip, karaokeMode: km, lyricsData: ld, audioMode: am } = syncStateRef.current;
            
            const msg = {
                type: 'sync_state',
                payload: {
                    currentSong: cs,
                    isPlaying: ip,
                    isKaraokeMode: km,
                    currentTime: (audioRef.current && isFinite(audioRef.current.currentTime)) ? audioRef.current.currentTime : 0,
                    duration: (audioRef.current && isFinite(audioRef.current.duration)) ? audioRef.current.duration : 0,
                    lyricsData: ld,
                    audioMode: am,
                    singer: cs?.singer || "Host",
                    partyUrl: partyUrl || undefined
                }
            };
            if (isTauri) {
                invoke('broadcast_ws', { payload: msg, localOnly: isPresentation }).catch(console.error);
            }
        });

        return () => {
            unlisten.then(f => f());
        };
    }, [isPartyMode, appConfig.appMode, partyUrl]);

    // Broadcast party URL to presentation screen
    useEffect(() => {
        if (!partyUrl) return;
        const msg = { type: 'party_url', url: partyUrl };
        if (isTauri) {
            invoke('broadcast_ws', { payload: msg }).catch(console.error);
        } else if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(msg));
        }
    }, [partyUrl]);

    // Listen for presentation screen play/pause commands
    useEffect(() => {
        if (appConfig.appMode !== 'presentation' || !isTauri) return;

        const unlistenPlay = listen('presentation_play', () => {
            console.log("[App] Presentation screen requested PLAY");
            if (audioRef.current) {
                audioRef.current.play().catch(console.error);
            }
        });

        const unlistenPause = listen('presentation_pause', () => {
            console.log("[App] Presentation screen requested PAUSE");
            if (audioRef.current) {
                audioRef.current.pause();
            }
        });

        return () => {
            unlistenPlay.then(f => f());
            unlistenPause.then(f => f());
        };
    }, [appConfig.appMode]);

    // Bridge presentation view's sync state to the party relay
    useEffect(() => {
        if (appConfig.appMode !== 'presentation' || !isTauri) return;

        const unlisten = listen('presentation_sync_state', (event) => {
            const payload = event.payload?.payload || event.payload;
            if (!payload) return;

            // Bridge to WebSocket if we are in a party
            if (isPartyMode && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                const msg = {
                    type: 'sync_state',
                    payload: payload
                };
                const msgParty = {
                    type: 'party_sync',
                    payload: payload
                };
                wsRef.current.send(JSON.stringify(msg));
                wsRef.current.send(JSON.stringify(msgParty));
            }

            // Optional: Mirror locally for the host preview
            if (audioRef.current) {
                if (payload.isPlaying) {
                    if (audioRef.current.paused) audioRef.current.play().catch(() => {});
                    if (Math.abs(audioRef.current.currentTime - payload.currentTime) > 1.5) {
                        audioRef.current.currentTime = payload.currentTime;
                    }
                } else {
                    if (!audioRef.current.paused) audioRef.current.pause();
                }
            }
        });

        return () => { unlisten.then(f => f()); };
    }, [appConfig.appMode, isPartyMode]);

    // Sync Queue with Party Relay
    useEffect(() => {
        if (!isPartyMode) return;

        const msg = {
            type: 'sync_queue',
            queue: queue
        };

        if (isTauri) {
            invoke('broadcast_ws', { payload: msg }).catch(console.error);
        } else if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(msg));
        }
    }, [queue, isPartyMode]);

    // Ref to track waiting state without stale closures inside setKaraokeMode
    const isWaitingRef = useRef(false);

    // Process Queue Worker
    useEffect(() => {
        if (queue.length === 0) return;

        const processNext = async () => {
            const nextItem = queue.find(item => item.status === 'waiting');
            if (!nextItem) return;

            setQueue(prev => prev.map(i => i.videoId === nextItem.videoId ? { ...i, status: 'processing' } : i));

            try {
                let res;
                if (isTauri) {
                    res = await invoke('process_yt', { videoId: nextItem.videoId });
                } else {
                    const protocol = window.location.protocol;
                    const host = window.location.hostname;
                    const response = await fetch(`${protocol}//${host}:1425/api/process_yt?query=${encodeURIComponent(nextItem.videoId)}`);
                    if (!response.ok) throw new Error("Failed to process");
                    res = await response.text();
                }
                const result = JSON.parse(res);

                // Load the song into the player - either opening it fresh OR replacing the waiting screen
                const resolvedInstrumentalUrl = await convertFileSrc(result.data.instrumentalUrl.replace('asset://localhost/', ''));
                const resolvedVocalsUrl = result.data.vocalsUrl ? await convertFileSrc(result.data.vocalsUrl.replace('asset://localhost/', '')) : "";
                const openSong = () => {
                    setLyricsData(result.data.segments);
                    setCurrentSong({
                        title: nextItem.title,
                        artist: nextItem.artists,
                        thumbnail: nextItem.thumbnail || "https://music.youtube.com/img/on_platform_logo_dark.svg",
                        videoId: nextItem.videoId,
                        instrumentalUrl: resolvedInstrumentalUrl,
                        vocalsUrl: resolvedVocalsUrl,
                        singer: nextItem.singer,
                        deviceId: nextItem.deviceId
                    });
                    setIsPlaying(false);
                    setIsAutoPaused(true);
                    setShowControls(true);
                    setIsWaitingForNextQueue(false);
                    isWaitingRef.current = false;
                    setQueue(prev => prev.filter(i => i.videoId !== nextItem.videoId));
                    if (isTauri) {
                        invoke('remove_from_party_queue', { videoId: nextItem.videoId, deviceId: nextItem.deviceId || "" }).catch(console.error);
                    } else {
                        fetch('/api/remove_queue', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ videoId: nextItem.videoId, deviceId: nextItem.deviceId || "" })
                        }).catch(console.error);
                    }
                };

                setKaraokeMode(currentValue => {
                    if (!currentValue) {
                        // First song: open karaoke screen
                        openSong();
                        return true;
                    } else if (isWaitingRef.current) {
                        // Song ended while next was still downloading -- now it's ready
                        openSong();
                        return true;
                    }
                    // Song already playing: just mark as ready, countdown will handle it
                    setQueue(prev => prev.map(i => i.videoId === nextItem.videoId ? { ...i, status: 'ready' } : i));
                    return currentValue;
                });
            } catch (e) {
                console.error("Queue download failed", e);
                setQueue(prev => prev.map(i => i.videoId === nextItem.videoId ? { ...i, status: 'error', error: e.toString() } : i));
            }
        };

        const hasProcessing = queue.some(item => item.status === 'processing');
        if (!hasProcessing) {
            processNext();
        }
    }, [queue, isPartyMode]);



    // Play next from Queue function
    const playFromQueue = useCallback(async (songItem, startPaused = false) => {
        setIsAutoPaused(startPaused);
        setIsProcessing(true);


        try {
            const res = await invoke('process_yt', { videoId: songItem.videoId });
            const result = JSON.parse(res);
            const parsed = result.data.segments;
            setLyricsData(parsed);

            setCurrentSong({
                title: songItem.title,
                artist: songItem.artists,
                thumbnail: songItem.thumbnail || "https://music.youtube.com/img/on_platform_logo_dark.svg",
                videoId: songItem.videoId,
                instrumentalUrl: await convertFileSrc(result.data.instrumentalUrl.replace('asset://localhost/', '')),
                vocalsUrl: result.data.vocalsUrl ? await convertFileSrc(result.data.vocalsUrl.replace('asset://localhost/', '')) : "",
                singer: songItem.singer,
                deviceId: songItem.deviceId
            });


            setQueue(prev => prev.filter(i => i.videoId !== songItem.videoId));
            setKaraokeMode(true);
            setIsProcessing(false);
            if (isTauri) {
                invoke('remove_from_party_queue', { videoId: songItem.videoId, deviceId: songItem.deviceId || "" }).catch(console.error);
            } else {
                fetch('/api/remove_queue', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ videoId: songItem.videoId, deviceId: songItem.deviceId || "" })
                }).catch(console.error);
            }
        } catch (e) {

            console.error("Queue play failed", e);
            setIsProcessing(false);
        }
    }, []);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleEnded = () => {
            setIsPlaying(false);
            if (isPartyMode || isLockedByWeb) {
                const nextReady = queue.find(item => item.status === 'ready');
                if (nextReady) {
                    setNextSingerName(nextReady.singer || "Guest");
                    setNextSingerCount(10);
                    setNextSongItem(nextReady);
                } else {
                    const nextProcessing = queue.find(item => item.status === 'processing' || item.status === 'waiting');
                    if (nextProcessing) {
                        isWaitingRef.current = true;
                        setIsWaitingForNextQueue(true);
                    } else {
                        setKaraokeMode(false);
                    }
                }
            } else {

                setKaraokeMode(false);
            }
        };

        audio.addEventListener('ended', handleEnded);
        return () => audio.removeEventListener('ended', handleEnded);
    }, [queue, isPartyMode, playFromQueue, currentSong]);

    // Next Singer Countdown Effect
    useEffect(() => {
        if (nextSingerCount === null) return;

        if (nextSingerCount <= 0) {
            setNextSingerCount(null);
            if (nextSongItem) {
                setShowControls(true);
                playFromQueue(nextSongItem, true); // startPaused = true
                setNextSongItem(null);
            }
            return;

        }

        if (nextSingerCount !== null) {
            const broadcast = {
                type: 'next_singer_countdown',
                payload: {
                    name: nextSingerName,
                    count: nextSingerCount
                }
            };
            if (isTauri) {
                appInvoke('broadcast_ws', { payload: broadcast }).catch(console.error);
            }
        }

        const timer = setTimeout(() => {
            setNextSingerCount(prev => prev - 1);
        }, 1000);

        return () => clearTimeout(timer);
    }, [nextSingerCount, nextSingerName, nextSongItem, playFromQueue, appConfig.appMode]);







    // Load Recent on Mount
    useEffect(() => {
        try {
            const storedRecent = localStorage.getItem('recent_songs');
            if (storedRecent) setRecentSongs(JSON.parse(storedRecent));

            const storedHistory = localStorage.getItem('search_history');
            if (storedHistory) setSearchHistory(JSON.parse(storedHistory));
        } catch (e) {
            console.error("Failed to load persistence", e);
        }
    }, []);

    const lastSyncRef = useRef(0);
    // Sync Lyrics
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio || !lyricsData.length) return;

        const handleTimeUpdate = () => {
            const currentTime = audio.currentTime;

            let newIndex = -1;
            for (let i = 0; i < lyricsData.length; i++) {
                if (currentTime + 0.3 >= lyricsData[i].time) {
                    newIndex = i;
                } else {
                    break;
                }
            }

            // Eager scroll: If current line is finished, bring the next line in evidence
            if (newIndex >= 0 && newIndex < lyricsData.length - 1) {
                const currentLine = lyricsData[newIndex];
                if (currentLine.words && currentLine.words.length > 0) {
                    const lastWord = currentLine.words[currentLine.words.length - 1];
                    if (currentTime > lastWord.end) {
                        newIndex += 1;
                    }
                }
            } else if (newIndex === -1 && lyricsData.length > 0) {
                // Eager scroll for the very first line
                const firstLine = lyricsData[0];
                const firstStart = firstLine.words && firstLine.words.length > 0 ? firstLine.words[0].start : firstLine.time;
                if (firstStart - currentTime <= 5.0) {
                    newIndex = 0;
                }
            }

            if (newIndex !== activeLineIndex) {
                setActiveLineIndex(newIndex);
            }
        };

        audio.addEventListener('timeupdate', handleTimeUpdate);
        return () => audio.removeEventListener('timeupdate', handleTimeUpdate);
    }, [lyricsData, activeLineIndex, karaokeMode, currentSong]);

    // Handle resume time for takeover
    useEffect(() => {
        if (currentSong && resumeTime > 0 && audioRef.current) {
            const audio = audioRef.current;
            const playFn = () => {
                audio.currentTime = resumeTime;
                setResumeTime(0); // clear
                audio.play().catch(console.error);
            };

            if (audio.readyState >= 2) {
                playFn();
            } else {
                audio.addEventListener('canplay', playFn, { once: true });
            }
        }
    }, [currentSong, resumeTime]);

    // Live Suggestions
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (query && query.length > 2) {
                try {
                    const res = await invoke('suggestions', { query });
                    const data = JSON.parse(res);
                    if (!data.error) setSuggestions(data);
                } catch (e) {
                    console.error("Suggestion error", e);
                }
            } else {
                setSuggestions([]);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [query]);

    // Handle clicking outside to close search dropdown
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (searchInputRef.current && !searchInputRef.current.contains(e.target) && !e.target.closest('.search-dropdown')) {
                setShowSearchDropdown(false);
            }
        };
        if (showSearchDropdown) {
            document.addEventListener('click', handleClickOutside);
        }
        return () => document.removeEventListener('click', handleClickOutside);
    }, [showSearchDropdown]);

    // Handle clicking outside to close context menu
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (contextMenu.isOpen && !e.target.closest('.context-menu')) {
                setContextMenu({ isOpen: false, videoId: null, position: { x: 0, y: 0 } });
            }
        };
        if (contextMenu.isOpen) {
            document.addEventListener('click', handleClickOutside);
        }
        return () => document.removeEventListener('click', handleClickOutside);
    }, [contextMenu.isOpen]);

    const performSearch = async (searchQuery, limit, skip = 0, isAppending = false) => {
        if (!isAppending) {
            setIsSearching(true);
            setSearchResults([]);
            setShowSearchDropdown(false);
        } else {
            setIsLoadingMore(true);
        }

        try {
            const res = await invoke('search', { query: searchQuery });
            const data = JSON.parse(res);
            if (data.error) throw new Error(data.error);

            // Find local matches in cache (only needed for first page)
            let merged = [];
            if (!isAppending) {
                const localMatches = Object.values(songCache)
                    .filter(s =>
                        s.currentSong.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        s.currentSong.artist.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map(s => ({
                        videoId: s.currentSong.videoId,
                        title: s.currentSong.title,
                        artists: s.currentSong.artist,
                        thumbnail: s.currentSong.thumbnail,
                        hasLyrics: true,
                        isCached: true
                    }));

                const videoIds = new Set(localMatches.map(m => m.videoId));
                merged = [
                    ...localMatches,
                    ...data.filter(item => !videoIds.has(item.videoId))
                ];
            } else {
                // Just append new data, filtering out any duplicates against existing results
                const existingIds = new Set(searchResults.map(m => m.videoId));
                merged = [
                    ...searchResults,
                    ...data.filter(item => !existingIds.has(item.videoId))
                ];
            }

            setSearchResults(merged);
            // Push search state for back button support
            if (!isAppending) {
                window.history.pushState({ view: 'search' }, '');
            }
        } catch (e) {
            setStatus("Error: " + e.message);
        } finally {
            setIsSearching(false);
            setIsLoadingMore(false);
        }
    };

    const searchMusic = async () => {
        if (!query) return;

        // AUTO-PROCESS IF LINK
        const ytMatch = query.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
        if (ytMatch) {
            processSong(ytMatch[1]);
            setQuery("");
            setShowSearchDropdown(false);
            return;
        }

        // Save Search History
        setSearchHistory(prev => {
            const filtered = prev.filter(h => h.toLowerCase() !== query.toLowerCase());
            const newHistory = [query, ...filtered].slice(0, 10);
            localStorage.setItem('search_history', JSON.stringify(newHistory));
            return newHistory;
        });

        setSearchLimit(20);
        performSearch(query, 20, 0, false);
    };

    useEffect(() => {
        const container = recentSongsRef.current;
        if (!container) return;

        const handleWheel = (e) => {
            // If user is scrolling over this area, we intercept deltaY and convert to horizontal
            // and explicitly block vertical propagation to the window
            if (Math.abs(e.deltaY) > 0) {
                e.preventDefault();
                const maxScroll = container.scrollWidth - container.clientWidth;

                if (!isScrollingRef.current) {
                    currentScrollRef.current = container.scrollLeft;
                    targetScrollRef.current = container.scrollLeft;
                }

                targetScrollRef.current = Math.max(0, Math.min(maxScroll, targetScrollRef.current + e.deltaY * 1.5));

                if (!isScrollingRef.current) {
                    isScrollingRef.current = true;
                    setScrollingTick(t => t + 1);
                }
            }
        };

        container.addEventListener('wheel', handleWheel, { passive: false });
        return () => container.removeEventListener('wheel', handleWheel);
    }, [recentSongs.length, karaokeMode]);

    // Press and hold handlers for recent songs (mobile only)
    const handlePressStart = (e, song) => {
        // Only for touch events (mobile)
        if (e.type !== 'touchstart') return;

        // Reset flag
        longPressTriggeredRef.current = false;

        // Clear any existing timer
        if (pressTimerRef.current) {
            clearTimeout(pressTimerRef.current);
        }

        // Get position for context menu
        const rect = e.currentTarget.getBoundingClientRect();
        const position = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        };

        // Start timer for long press (500ms)
        pressTimerRef.current = setTimeout(() => {
            longPressTriggeredRef.current = true;
            setContextMenu({
                isOpen: true,
                videoId: song.videoId,
                song: song,
                position: position
            });
            // Vibrate on mobile if supported
            if (navigator.vibrate) {
                navigator.vibrate(50);
            }
        }, 500);
    };

    const handlePressEnd = () => {
        // Don't clear timer if long press was already triggered (context menu is open)
        // This allows the user to release the mouse and click on menu options
        if (pressTimerRef.current && !longPressTriggeredRef.current) {
            clearTimeout(pressTimerRef.current);
            pressTimerRef.current = null;
        }
    };

    const handlePressCancel = () => {
        // Clear timer if touch/mouse moves away
        if (pressTimerRef.current) {
            clearTimeout(pressTimerRef.current);
            pressTimerRef.current = null;
        }
        longPressTriggeredRef.current = false;
    };

    // Right-click handler for desktop
    const handleContextMenu = (e, song) => {
        e.preventDefault(); // Prevent default browser context menu

        // Get mouse position for context menu
        const position = {
            x: e.clientX,
            y: e.clientY
        };

        longPressTriggeredRef.current = true;
        setContextMenu({
            isOpen: true,
            videoId: song.videoId,
            song: song,
            position: position
        });
    };

    const handleRecentSongClick = (e, song) => {
        // Only process if context menu is not open and long press wasn't triggered
        if (!contextMenu.isOpen && !longPressTriggeredRef.current) {
            processSong(song, song.thumbnail, e);
        }
        // Reset flag after click
        longPressTriggeredRef.current = false;
    };

    const cancelProcessing = async (e) => {
        if (e) e.stopPropagation();
        if (!currentSong?.videoId) return;
        try {
            await invoke('cancel_processing', { videoId: currentSong.videoId });
            setStatus("Cancelled processing.");
        } catch (err) {
            console.error(err);
        }
        setIsTransitioning(false);
        setTransitionStage('idle');
        setSelectedRect(null);
        setHeaderRect(null);
        setSelectedSource(null);
        setIsProcessing(false);
    };

    const processSong = async (videoIdInput, thumbnail = null, e = null) => {
        setIsAutoPaused(false);
        // Handle variations (old history or direct pass)

        const videoId = (typeof videoIdInput === 'string' ? videoIdInput : (videoIdInput?.videoId || videoIdInput?.id));
        const songTitle = (typeof videoIdInput === 'object' ? (videoIdInput.title || videoIdInput.name) : null);

        if (!videoId) {
            setStatus("Error: Invalid Video ID");
            return;
        }

        // Immediately set info for transition tracking
        let title = (typeof videoIdInput === 'object' ? (videoIdInput.title || videoIdInput.name || "Loading...") : "Loading...");
        let artist = (typeof videoIdInput === 'object' ? (videoIdInput.artists || videoIdInput.artist || "") : "");
        const foundInSearch = searchResults.find(v => v.videoId === videoId);
        const foundInRecent = recentSongs.find(s => s.videoId === videoId);
        if (foundInSearch) {
            title = foundInSearch.title;
            artist = foundInSearch.artists || foundInSearch.channel || "";
        } else if (foundInRecent) {
            title = foundInRecent.title;
            artist = foundInRecent.artist || "";
        }

        // Notify singer if this song is from the party queue
        const queueItem = queue.find(q => q.videoId === videoId);
        if (queueItem && queueItem.deviceId && isPartyMode) {
            invoke('broadcast_ws', {
                payload: {
                    type: 'notify_singer',
                    deviceId: queueItem.deviceId,
                    payload: { title: title || queueItem.title, videoId }
                }
            }).catch(console.error);
        }

        setCurrentSong({
            videoId,
            thumbnail,
            title,
            artist,
            singer: queueItem?.singer || "Host"
        });
        setActiveLineIndex(-1); // Reset for new song

        if (e) {
            const rect = e.currentTarget.getBoundingClientRect();
            setSelectedRect(rect);
            // Detect source based on class or context
            const isRecent = e.currentTarget.closest('.recent-list-container') || recentSongs.some(s => s.videoId === videoId && !searchResults.some(sv => sv.videoId === videoId));
            const isDropdown = e.currentTarget.closest('.search-dropdown-item');
            setSelectedSource(isDropdown ? 'dropdown' : (isRecent ? 'recent' : 'search'));
        }

        if (headerRef.current) {
            setHeaderRect(headerRef.current.getBoundingClientRect());
        }

        // Batch state updates to ensure they happen in the same cycle
        setIsTransitioning(true);
        setTransitionStage('start');

        const transitionStartTime = Date.now();
        const minDisplayTime = 2000; // 1s flight + 1s clear hold

        // Helper to finalize the transition effect and enter karaoke mode
        const finalizeTransition = () => {
            const elapsed = Date.now() - transitionStartTime;
            const remaining = Math.max(0, minDisplayTime - elapsed);

            setTimeout(() => {
                setTransitionStage('fadeout');
                setTimeout(() => {
                    setKaraokeMode(true);
                    window.history.pushState({ view: 'player' }, '');
                    setIsTransitioning(false);
                    setTransitionStage('idle');
                    setSelectedRect(null);
                    setHeaderRect(null);
                    setSelectedSource(null);
                    setIsProcessing(false);
                    setStatus("");
                }, 600); // Wait for fadeout animation
            }, remaining);
        };

        // Stage 1: Move to Hero (micro-delay to ensure DOM has rendered 'start' position correctly)
        setTimeout(() => setTransitionStage('hero'), 30);

        setStatus("doing our magic...");
        setKaraokeMode(false);
        setIsProcessing(true);
        setSearchResults([]);

        // NOTE: We no longer check songCache here because URLs in cache might be expired (convertFileSrc assets)
        // The backend `process_yt` has its own persistent database cache which is faster and reliable.

        try {
            const res = await invoke('process_yt', { videoId });
            const result = JSON.parse(res);

            const parsed = result.data.segments || parseLRC(result.data.lrc);
            setLyricsData(parsed);

            setCurrentSong({
                title: result.data.title || "Unknown Song",
                artist: result.data.artist || "Unknown Artist",
                thumbnail: thumbnail || "https://music.youtube.com/img/on_platform_logo_dark.svg",
                videoId: videoId,
                instrumentalUrl: await convertFileSrc(result.data.instrumentalUrl.replace('asset://localhost/', '')),
                vocalsUrl: result.data.vocalsUrl ? await convertFileSrc(result.data.vocalsUrl.replace('asset://localhost/', '')) : ""
            });

            addToRecent({
                videoId,
                title: result.data.title || "Unknown",
                artist: result.data.artist || "Unknown",
                thumbnail: thumbnail || "https://music.youtube.com/img/on_platform_logo_dark.svg",
                hasLyrics: true
            });

            // Update session cache (keep it in memory only)
            const cachedInstrumentalUrl = await convertFileSrc(result.data.instrumentalUrl.replace('asset://localhost/', ''));
            setSongCache(prev => ({
                ...prev,
                [videoId]: {
                    lyricsData: parsed,
                    currentSong: {
                        title: result.data.title || "Unknown Song",
                        artist: result.data.artist || "Unknown Artist",
                        thumbnail: thumbnail || "https://music.youtube.com/img/on_platform_logo_dark.svg",
                        videoId: videoId,
                        instrumentalUrl: cachedInstrumentalUrl
                    }
                }
            }));

            finalizeTransition();

        } catch (e) {
            console.error(e);
            if (e === "Processing cancelled by user" || (e.message && e.message.includes("cancelled"))) {
                setStatus("Cancelled execution.");
                setIsTransitioning(false);
                setTransitionStage('idle');
                setIsProcessing(false);
                return;
            }

            // ERROR RECOVERY - Redirect to search
            if (songTitle) {
                setStatus(`Lyrics missing for "${songTitle}". Showing other versions...`);
                setQuery(songTitle);
                performSearch(songTitle, 20, 0, false);
            } else {
                setStatus("Error: " + (e.message || "Failed to load song"));
            }

            setIsTransitioning(false);
            setTransitionStage('idle');
            setIsProcessing(false);
        }
    };

    const addToRecent = (song) => {
        const newRecent = [song, ...recentSongs.filter(s => s.videoId !== song.videoId)].slice(0, 20);
        setRecentSongs(newRecent);
        localStorage.setItem('recent_songs', JSON.stringify(newRecent));
    };

    const removeFromRecent = (videoId) => {
        setConfirmModal({
            isOpen: true,
            title: 'Remove Song?',
            message: 'Are you sure you want to remove this song from your recently sung list?',
            type: 'danger',
            confirmText: 'Remove',
            onConfirm: () => {
                const newRecent = recentSongs.filter(s => s.videoId !== videoId);
                setRecentSongs(newRecent);
                localStorage.setItem('recent_songs', JSON.stringify(newRecent));
            }
        });
    };

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            karaokeContainerRef.current.requestFullscreen().catch(err => {
                alert(`Error converting to fullscreen: ${err.message}`);
            });
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    // Monitor fullscreen and keyboard events
    useEffect(() => {
        const handleFsChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };

        const handlePopState = (e) => {
            // Priority: Exiting Karaoke Player
            if (karaokeMode) {
                setKaraokeMode(false);
                if (audioRef.current) audioRef.current.pause();
                return;
            }

            // Secondary: Exiting Search Results
            if (searchResults.length > 0) {
                setSearchResults([]);
                setQuery("");
                setStatus("");
                return;
            }
        };

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                if (karaokeMode) {
                    setKaraokeMode(false);
                } else if (showSearchDropdown) {
                    setShowSearchDropdown(false);
                }
            } else if (e.code === 'Space' && karaokeMode) {
                e.preventDefault();
                if (audioRef.current) {
                    if (audioRef.current.paused) audioRef.current.play();
                    else audioRef.current.pause();
                    setShowControls(true);
                }
            }
        };

        document.addEventListener('fullscreenchange', handleFsChange);
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('popstate', handlePopState);

        return () => {
            document.removeEventListener('fullscreenchange', handleFsChange);
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('popstate', handlePopState);
        };
    }, [karaokeMode, searchResults.length, showSearchDropdown]);

    // Prevent body scroll when in Karaoke Mode
    useEffect(() => {
        if (karaokeMode) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }
        return () => { document.body.style.overflow = 'auto'; };
    }, [karaokeMode]);

    // Helper Logic for Display

    // Auto-hide controls after 2s of inactivity (only if playing)
    useEffect(() => {
        if (!showControls || !isPlaying) return;
        const timer = setTimeout(() => {
            setShowControls(false);
        }, 2000);
        return () => clearTimeout(timer);
    }, [showControls, isPlaying]);

    // Sync isPlaying with audio element
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        const setPlaying = () => setIsPlaying(true);
        const setPaused = () => setIsPlaying(false);
        audio.addEventListener('play', setPlaying);
        audio.addEventListener('pause', setPaused);
        audio.addEventListener('ended', setPaused);
        return () => {
            audio.removeEventListener('play', setPlaying);
            audio.removeEventListener('pause', setPaused);
            audio.removeEventListener('ended', setPaused);
        };
    }, [currentSong, karaokeMode]);


    if (!isReady && isTauri) {
        const overallProgress = Math.round(
            (setupSteps.reduce((acc, s) => acc + (s.status === 'done' ? 100 : s.progress), 0) / (setupSteps.length * 100)) * 100
        );

        return (
            <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-950 text-white overflow-hidden p-6">
                <div className="absolute inset-0 z-0 opacity-40">
                    <AuroraBackground />
                </div>

                <div className="z-10 bg-slate-900/40 p-10 rounded-[2.5rem] border border-white/10 backdrop-blur-3xl flex flex-col items-center text-center shadow-[0_0_100px_rgba(99,102,241,0.15)] max-w-xl w-full">
                    <div className="relative mb-8">
                        <div className="absolute inset-0 blur-2xl bg-primary/20 animate-pulse rounded-full" />
                        <Loader2 className="w-20 h-20 animate-spin text-primary relative z-10" />
                    </div>

                    <h1 className="text-5xl font-bold mb-2 tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-primary via-accent to-primary">
                        KraoQ
                    </h1>
                    <p className="text-text-muted text-lg mb-10 font-medium">Preparing your personal stage...</p>

                    {/* Step Checklist */}
                    <div className="w-full space-y-4 mb-10">
                        {setupSteps.map((step) => (
                            <div key={step.id} className="flex items-center gap-4 group">
                                <div className={`shrink-0 w-6 h-6 flex items-center justify-center transition-colors duration-500`}>
                                    {step.status === 'done' ? (
                                        <CheckCircle2 className="text-green-400 w-6 h-6" />
                                    ) : step.status === 'loading' ? (
                                        <Loader2 className="text-primary w-5 h-5 animate-spin" />
                                    ) : step.status === 'error' ? (
                                        <AlertCircle className="text-red-400 w-6 h-6" />
                                    ) : (
                                        <Circle className="text-white/10 w-5 h-5" />
                                    )}
                                </div>
                                <div className="flex-1 text-left">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className={`text-sm font-semibold transition-colors duration-300 ${step.status === 'loading' ? 'text-white' : 'text-text-muted'}`}>
                                            {step.label}
                                        </span>
                                        {step.status === 'loading' && (
                                            <span className="text-[10px] tabular-nums text-primary font-bold">{step.progress}%</span>
                                        )}
                                    </div>
                                    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${step.status === 'done' ? 100 : step.progress}%` }}
                                            className={`h-full rounded-full transition-all duration-500 ${step.status === 'done' ? 'bg-green-400/50' : 'bg-primary'}`}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Overall Progress */}
                    <div className="w-full">
                        <div className="flex justify-between text-[11px] font-bold tracking-widest uppercase text-text-muted/50 mb-3 px-1">
                            <span>Initializing Environment</span>
                            <span>{overallProgress}%</span>
                        </div>
                        <div className="h-3 w-full bg-white/5 rounded-full p-1 border border-white/5 relative">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${overallProgress}%` }}
                                className="h-full rounded-full bg-gradient-to-r from-primary via-accent to-primary shadow-[0_0_15px_rgba(99,102,241,0.5)]"
                            />
                        </div>
                    </div>
                </div>

                <div className="mt-8 text-white/20 text-[10px] font-medium tracking-tight animate-pulse select-none">
                    PLEASE DO NOT CLOSE THE APPLICATION DURING SETUP
                </div>
            </div>
        );
    }

    return (
        <div className={`z-10 relative transition-all duration-500 ${((karaokeMode && appConfig.appMode !== 'presentation') || isPresentationView) ? 'w-full min-h-screen' : 'w-full max-w-[1100px] mx-auto p-4 sm:p-8'}`}>
            {/* DYNAMIC ISLAND STATUS */}
            <AnimatePresence>
                {status && (
                    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none">
                        <motion.div
                            initial={{ opacity: 0, y: -50, scale: 0.8 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -50, scale: 0.8 }}
                            transition={{ type: "spring", stiffness: 400, damping: 25 }}
                        >
                            <div className="bg-black/90 backdrop-blur-3xl border border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.8)] rounded-[2rem] px-5 py-2.5 flex items-center justify-center gap-3 overflow-hidden group w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-2xl">
                                <div className="relative flex items-center justify-center shrink-0">
                                    <div className="absolute inset-0 bg-primary/20 blur-md rounded-full" />
                                    <Loader2 size={16} className="text-primary animate-spin relative z-10" />
                                </div>
                                <span className="text-white text-xs sm:text-sm font-bold tracking-wide break-words text-center drop-shadow-md">
                                    {status}
                                </span>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
            {/* HEADER AREA */}
            {(!karaokeMode || appConfig.appMode === 'presentation') && !isPresentationView && (
                <header className={`p-6 mb-8 flex justify-between items-center transition-all duration-1000 ${isTransitioning ? 'blur-2xl opacity-0' : 'opacity-100'}`}>
                    <div className="flex flex-col gap-1">
                        <h1 className="text-4xl font-black tracking-tighter text-white flex items-center gap-2">
                            KraoQ <span className="text-accent text-sm font-bold bg-accent/20 px-2 py-0.5 rounded-full tracking-normal">BETA</span>
                        </h1>
                        <p className="text-text-muted text-[10px] font-black uppercase tracking-[0.2em] opacity-50">Professional AI Karaoke</p>
                    </div>

                    <div className="flex items-center gap-3">
                        {appConfig.appMode === 'presentation' && (
                            <div className="flex flex-col items-end mr-4 animate-in fade-in slide-in-from-right-4 duration-500">
                                <span className="text-[10px] font-black text-primary uppercase tracking-widest mb-1 opacity-80">Presentation View</span>
                                <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl backdrop-blur-md">
                                    <span className="text-[11px] font-mono text-white/90 selection:bg-primary/30">
                                        {presentationUrl || 'Starting...'}
                                    </span>
                                    <button
                                        onClick={() => {
                                            if (presentationUrl) {
                                                navigator.clipboard.writeText(presentationUrl);
                                                setStatus("URL Copied!");
                                                setTimeout(() => setStatus(""), 2000);
                                            }
                                        }}
                                        className="text-white/40 hover:text-white transition-colors"
                                        title="Copy URL"
                                    >
                                        <Download size={12} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* MINI PLAYER CONTROLLER (Visible when song is playing in Presentation Mode) */}
                        {karaokeMode && currentSong && appConfig.appMode === 'presentation' && (
                            <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-4 py-2 rounded-2xl backdrop-blur-md animate-in zoom-in-95 duration-500 mr-2">
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-black text-primary uppercase tracking-[0.2em] mb-0.5">Now Playing</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-white text-[11px] font-bold truncate max-w-[150px]">{currentSong.title}</span>
                                        <span className="text-white/40 text-[9px] font-medium">- {currentSong.singer || "Host"}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 ml-2">
                                    <button
                                        onClick={() => {
                                            if (audioRef.current) {
                                                if (isPlaying) {
                                                    audioRef.current.pause();
                                                } else {
                                                    audioRef.current.play();
                                                }
                                                setIsPlaying(!isPlaying);
                                            }
                                        }}
                                        className="p-2 hover:bg-white/10 text-white transition-colors rounded-lg"
                                        title={isPlaying ? "Pause" : "Play"}
                                    >
                                        {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                                    </button>
                                    <button
                                        onClick={() => setKaraokeMode(false)}
                                        className="p-2 hover:bg-red-500/20 text-red-400 transition-colors rounded-lg"
                                        title="Stop Session"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            </div>
                        )}

                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handlePartyToggle}
                            className={`p-3 rounded-full border border-white/10 ${isPartyMode ? 'bg-accent/20 text-accent border-accent/30' : 'bg-white/5 text-white/50'} hover:text-white hover:bg-white/10 transition-all flex items-center justify-center shadow-lg backdrop-blur-md`}
                            title={isPartyMode ? "Disable Party Mode" : "Enable Party Mode"}
                        >
                            <Zap size={20} fill={isPartyMode ? 'currentColor' : 'none'} />
                        </motion.button>

                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setShowSettings(true)}
                            className="p-3 rounded-full bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center shadow-lg backdrop-blur-md"
                            title="Settings"
                        >
                            <Settings size={20} />
                        </motion.button>

                    </div>

                </header>
            )}

            {/* Aurora Colors during Transition or Presentation Standby */}
            {(isTransitioning || (isPresentationView && !karaokeMode)) && (
                <div className="fixed inset-0 z-0 opacity-40 transition-opacity duration-1000">
                    <AuroraBackground audioRef={audioRef} />
                </div>
            )}

            {/* Global Transition Overlay Backdrop */}
            {isTransitioning && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-2xl z-[150] animate-in fade-in duration-700" />
            )}

            {/* HERO TRANSITION ELEMENT */}
            {isTransitioning && currentSong && (
                <div
                    style={transitionStage === 'hero' || transitionStage === 'fadeout' ? {
                        top: '50%',
                        left: '50%',
                        transform: `translate(-50%, -50%) scale(${transitionStage === 'fadeout' ? 1.0 : 0.9})`
                    } : {
                        top: selectedRect?.top,
                        left: selectedRect?.left,
                        width: selectedRect?.width,
                        height: selectedRect?.height,
                        transform: 'none'
                    }}
                    className={`
                        fixed z-[1000] transition-[transform,opacity,filter,top,left,width,height] duration-1000 ease-[cubic-bezier(0.23,1,0.32,1)] flex items-center flex-nowrap will-change-[transform,top,left,width,height,opacity]
                        ${transitionStage === 'hero' || transitionStage === 'fadeout'
                            ? 'p-8 gap-8 rounded-full w-max max-w-[95vw] min-w-[450px] pr-12 bg-slate-900/90 backdrop-blur-md border border-primary/50 shadow-[0_0_80px_rgba(99,102,241,0.4)] ring-2 ring-primary/30'
                            : `gap-4 bg-card-bg border border-white/10 shadow-xl overflow-hidden ${selectedSource === 'recent' ? 'p-3 rounded-full' : (selectedSource === 'dropdown' ? 'p-3 rounded-xl' : 'p-4 rounded-2xl')}`}
                        ${transitionStage === 'fadeout' ? 'opacity-0 blur-2xl scale-110' : 'opacity-100'}
                    `}
                >
                    <img
                        src={currentSong.thumbnail}
                        className={`
                            shrink-0 transition-[transform,width,height,border-radius] duration-1000 ease-[cubic-bezier(0.23,1,0.32,1)] will-change-[transform,width,height]
                            ${transitionStage === 'hero' || transitionStage === 'fadeout'
                                ? 'w-28 h-28 rounded-full shadow-lg'
                                : (selectedSource === 'recent' ? 'w-10 h-10 rounded-full' : (selectedSource === 'dropdown' ? 'w-12 h-12 rounded' : 'w-24 h-24 rounded-xl'))}
                            object-cover
                        `}
                    />
                    <div className="flex-1">
                        <h2 className={`
                            font-black text-white transition-[font-size,opacity] duration-1000 ease-[cubic-bezier(0.23,1,0.32,1)]
                            ${transitionStage === 'hero' || transitionStage === 'fadeout'
                                ? 'text-4xl whitespace-nowrap'
                                : (selectedSource === 'recent' || selectedSource === 'dropdown' ? 'text-sm font-medium truncat' : 'text-lg font-bold truncate')}
                        `}>
                            {currentSong.title}
                        </h2>
                        {currentSong.artist && (
                            <p className={`
                                text-text-muted transition-[font-size,opacity] duration-1000 ease-[cubic-bezier(0.23,1,0.32,1)] truncate
                                ${transitionStage === 'hero' || transitionStage === 'fadeout'
                                    ? 'text-xl font-bold tracking-tight mt-1'
                                    : 'text-xs'}
                            `}>
                                {currentSong.artist}
                            </p>
                        )}
                        {/* Preparing Status */}
                        {(transitionStage === 'hero' || transitionStage === 'fadeout') && (
                            <div className="flex flex-col items-start gap-1.5 mt-4">
                                <p className={`text-primary-hover text-base font-bold animate-pulse shrink-0 flex items-center gap-2 transition-opacity duration-300 ${transitionStage === 'fadeout' ? 'opacity-0' : 'opacity-100'}`}>
                                    <Mic2 size={18} /> Preparing Your Stage...
                                </p>
                            </div>
                        )}
                    </div>
                    {/* Progress Circle for API calls */}
                    {isProcessing && (transitionStage === 'hero' || transitionStage === 'fadeout') && (
                        <div className="ml-4 shrink-0 flex items-center gap-4 animate-in fade-in zoom-in duration-500">
                            <button
                                onClick={cancelProcessing}
                                className={`px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-full text-xs font-bold uppercase tracking-wider transition-colors pointer-events-auto ${transitionStage === 'fadeout' ? 'opacity-0 scale-90' : 'opacity-100'}`}
                            >
                                Cancel
                            </button>
                            <div className="w-10 h-10 rounded-full border-4 border-white/5 border-t-primary animate-spin shadow-[0_0_15px_rgba(99,102,241,0.5)]"></div>
                        </div>
                    )}
                </div>
            )}

            {/* AUTH HEADER removed for local single-user */}

            {/* HEADER */}
            {(!karaokeMode || appConfig.appMode === 'presentation') && !isPresentationView && (
                <div
                    ref={headerRef}
                    style={transitionStage === 'hero' || transitionStage === 'fadeout' ? {
                        top: '15vh',
                        left: '50%',
                        transform: `translateX(-50%) scale(${transitionStage === 'fadeout' ? 1.6 : 1.4})`
                    } : transitionStage === 'start' ? {
                        top: headerRect?.top,
                        left: headerRect?.left,
                        width: headerRect?.width,
                        transform: 'none'
                    } : {}}
                    className={`
                        text-center mb-12 transition-[top,left,transform,opacity,filter] duration-1000 ease-[cubic-bezier(0.23,1,0.32,1)] will-change-[transform,top,opacity]
                        ${isTransitioning
                            ? 'fixed z-[800] blur-none pointer-events-none'
                            : 'animate-in fade-in'}
                        ${transitionStage === 'fadeout' ? 'opacity-0 blur-3xl' : 'opacity-100'}
                    `}
                >
                    <h1 className="text-6xl font-bold mb-4 tracking-tight drop-shadow-lg bg-clip-text text-transparent bg-gradient-to-r from-primary via-accent to-primary animate-pulse">
                        KraoQ
                    </h1>
                    <p className={`text-xl text-text-muted font-light tracking-wide transition-opacity duration-300 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
                        Your favorite songs with a <span className="text-white font-medium">Professional Karaoke Experience</span>
                    </p>
                </div>
            )}

            {/* SEARCH SECTION */}
            {(!karaokeMode || appConfig.appMode === 'presentation') && !isPresentationView && (
                <div className={`relative z-50 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150`}>
                    <div className={`bg-card-bg/50 backdrop-blur-xl p-4 sm:p-8 rounded-[2rem] border border-white/10 shadow-2xl relative transition-colors duration-300 ${isTransitioning ? 'pointer-events-none' : ''}`}>
                        {/* Search Input */}
                        <div className={`relative z-50 transition-[transform,opacity,filter] duration-300 ${isTransitioning ? 'blur-2xl opacity-0 scale-95' : ''}`}>
                            <div className="relative flex items-center">
                                <Search className="absolute left-4 sm:left-6 text-text-muted w-5 h-5 sm:w-6 sm:h-6 transition-colors pointer-events-none" />
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    className="w-full bg-black/40 border border-white/5 text-white pl-12 sm:pl-16 pr-16 sm:pr-20 py-4 sm:py-5 rounded-2xl text-base sm:text-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent transition-all placeholder:text-text-muted/50 select-text"
                                    placeholder="Paste YouTube link or search song..."
                                    value={query}
                                    onPointerDown={(e) => {
                                        e.target.focus();
                                    }}
                                    onFocus={() => setShowSearchDropdown(true)}
                                    onChange={(e) => setQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && searchMusic()}
                                />

                                {/* SEARCH DROPDOWN */}
                                {showSearchDropdown && (query || searchHistory.length > 0) && (
                                    <div className="absolute top-[calc(100%+0.5rem)] left-0 w-full bg-card-bg/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 search-dropdown">
                                        {/* Cache Matches Section - Displayed First */}
                                        {query && Object.values(songCache).filter(s =>
                                            s.currentSong.title.toLowerCase().includes(query.toLowerCase()) ||
                                            s.currentSong.artist.toLowerCase().includes(query.toLowerCase())
                                        ).length > 0 && (
                                                <div className="p-2 border-b border-white/5">
                                                    <p className="text-[10px] font-bold text-accent uppercase tracking-widest px-3 mb-2">In Your Library</p>
                                                    {Object.values(songCache)
                                                        .filter(s => s.currentSong.title.toLowerCase().includes(query.toLowerCase()) || s.currentSong.artist.toLowerCase().includes(query.toLowerCase()))
                                                        .slice(0, 3)
                                                        .map(s => (
                                                            <div
                                                                key={s.currentSong.videoId}
                                                                className="flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl cursor-pointer group search-dropdown-item"
                                                                onClick={(e) => {
                                                                    processSong(s.currentSong, s.currentSong.thumbnail, e);
                                                                    setShowSearchDropdown(false);
                                                                }}
                                                            >
                                                                <img
                                                                    src={s.currentSong.thumbnail}
                                                                    className="w-12 h-12 rounded object-cover"
                                                                    onError={(e) => { e.target.src = DEFAULT_THUMBNAIL; }}
                                                                />
                                                                <div className="flex-1 truncate">
                                                                    <p className="text-sm font-medium text-white group-hover:text-primary transition-colors truncate">{s.currentSong.title}</p>
                                                                    <p className="text-xs text-text-muted truncate">{s.currentSong.artist}</p>
                                                                </div>
                                                                <Mic2 size={14} className="text-accent" />
                                                            </div>
                                                        ))
                                                    }
                                                </div>
                                            )}

                                        {/* Suggestions Section */}
                                        {query && suggestions.length > 0 && (
                                            <div className="p-2 border-b border-white/5">
                                                <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest px-3 mb-2">Suggestions</p>
                                                {suggestions.map((s, i) => (
                                                    <div
                                                        key={`${s.videoId}-${i}`}
                                                        className="flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl cursor-pointer group search-dropdown-item"
                                                        onClick={(e) => {
                                                            processSong(s, s.thumbnail, e);
                                                            setShowSearchDropdown(false);
                                                        }}
                                                    >
                                                        <img
                                                            src={s.thumbnail}
                                                            className="w-12 h-12 rounded object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                                            onError={(e) => { e.target.src = DEFAULT_THUMBNAIL; }}
                                                        />
                                                        <div className="flex-1 truncate">
                                                            <div className="flex items-center gap-2">
                                                                <p className="text-sm font-medium text-white group-hover:text-primary transition-colors truncate">{s.title}</p>
                                                                {s.recommended && (
                                                                    <span className="bg-accent/20 text-accent text-[8px] font-black px-1.5 py-0.5 rounded-md border border-accent/20 uppercase tracking-tighter shrink-0">
                                                                        Recommended
                                                                    </span>
                                                                )}
                                                                {s.isCached && !s.recommended && (
                                                                    <span className="bg-primary/20 text-primary-hover text-[8px] font-black px-1.5 py-0.5 rounded-md border border-primary/20 uppercase tracking-tighter shrink-0">
                                                                        In Library
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-xs text-text-muted truncate">{s.artists}</p>
                                                        </div>
                                                        {(s.isCached || s.recommended) && <Mic2 size={12} className="text-primary-hover/50 group-hover:text-primary transition-colors" />}
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Recent Searches */}
                                        {!query && searchHistory.length > 0 && (
                                            <div className="p-2">
                                                <div className="flex justify-between items-center px-3 mb-1">
                                                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Recent Searches</p>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSearchHistory([]);
                                                            localStorage.removeItem('search_history');
                                                        }}
                                                        className="text-[10px] text-text-muted hover:text-white transition-colors"
                                                    >
                                                        Clear
                                                    </button>
                                                </div>
                                                {searchHistory
                                                    .filter(h => !query || h.toLowerCase().includes(query.toLowerCase()))
                                                    .map((term, i) => (
                                                        <div
                                                            key={i}
                                                            className="flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl cursor-pointer text-sm text-white/70 hover:text-white group"
                                                            onClick={() => {
                                                                setQuery(term);
                                                                setTimeout(() => searchMusic(), 0);
                                                            }}
                                                        >
                                                            <Search size={14} className="text-text-muted group-hover:text-primary" />
                                                            {term}
                                                        </div>
                                                    ))
                                                }
                                            </div>
                                        )}
                                    </div>
                                )}


                                <button
                                    onClick={searchMusic}
                                    disabled={isSearching}
                                    className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-white/5 hover:bg-primary text-white rounded-xl transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed border border-white/10 hover:border-primary/50 hover:shadow-[0_0_15px_rgba(99,102,241,0.5)] group/btn"
                                >
                                    {isSearching ? <Loader2 className="animate-spin w-5 h-5 sm:w-6 sm:h-6" /> : <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6 transition-transform group-hover/btn:translate-x-0.5" />}
                                </button>
                            </div>
                        </div>

                        {/* Status Message */}
                        {status && (
                            <div className={`mt-6 text-center transition-all duration-1000 ${isTransitioning ? 'blur-2xl opacity-0 scale-95' : 'animate-pulse'}`}>
                                <p className="text-accent font-medium bg-accent/10 inline-block px-4 py-1 rounded-full text-sm border border-accent/20">
                                    {status}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* SEARCH RESULTS */}
                    {searchResults.length > 0 && (
                        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                            {searchResults.map((video) => (
                                <div
                                    key={video.videoId}
                                    onClick={(e) => processSong(video, video.thumbnail, e)}
                                    className={`
                                        bg-card-bg border p-4 rounded-2xl flex items-center gap-4 cursor-pointer transition-all duration-1000 w-full
                                        ${isTransitioning ? 'blur-2xl opacity-5 scale-90 grayscale pointer-events-none' : 'hover:bg-white/5 hover:scale-[1.02] border-white/5 group'}
                                        ${video.isCached && !isTransitioning ? 'border-primary/40 shadow-[0_0_15px_rgba(99,102,241,0.1)]' : ''}
                                    `}
                                >
                                    <img
                                        src={video.thumbnail}
                                        alt={video.title}
                                        className="w-24 h-24 object-cover rounded-xl shadow-lg group-hover:shadow-primary/20 transition-all"
                                        onError={(e) => { e.target.src = DEFAULT_THUMBNAIL; }}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-lg truncate text-white group-hover:text-primary transition-colors">{video.title}</h3>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="text-sm text-text-muted truncate">{video.artists || video.channel}</p>
                                            <div className="flex gap-1">
                                                {video.isCached && (
                                                    <span className="bg-primary/20 text-primary-hover text-[10px] font-bold px-2 py-0.5 rounded-full border border-primary/30 uppercase tracking-tighter">
                                                        In Library
                                                    </span>
                                                )}
                                                {video.hasLyrics && (
                                                    <span className="bg-green-500/20 text-green-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-green-500/30 uppercase tracking-tighter">
                                                        Lyrics
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-white/10 p-3 rounded-full group-hover:bg-primary group-hover:text-white transition-colors">
                                        <Mic2 size={20} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* RECENT SONGS */}
            {(!karaokeMode || appConfig.appMode === 'presentation') && !isPresentationView && recentSongs.length > 0 && searchResults.length === 0 && (
                <div className={`mt-16 w-screen max-w-[1100px] relative left-1/2 -translate-x-1/2 recent-list-container transition-[transform,opacity] duration-1000 ${isTransitioning ? 'animate-none' : 'opacity-100 scale-100 animate-in fade-in duration-700 delay-300'}`}>
                    <h3 className={`text-text-muted text-sm font-bold uppercase tracking-widest mb-6 px-4 transition-opacity duration-1000 ${isTransitioning ? 'blur-2xl opacity-0' : ''}`}>Recently Sung</h3>

                    <div
                        ref={recentSongsRef}
                        className={`flex overflow-x-auto gap-4 py-8 px-4 stylized-scrollbar transition-opacity duration-700 ${isTransitioning ? 'overflow-visible' : ''}`}
                        style={{
                            maskImage: 'linear-gradient(to right, transparent, black 20px, black calc(100% - 20px), transparent)',
                            WebkitMaskImage: 'linear-gradient(to right, transparent, black 20px, black calc(100% - 20px), transparent)'
                        }}
                    >
                        {recentSongs.map((song, i) => {
                            const isContextMenuOpen = contextMenu.isOpen && contextMenu.videoId === song.videoId;
                            return (
                                <div
                                    key={`${song.videoId}-${i}`}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        handleRecentSongClick(e, song);
                                    }}
                                    onContextMenu={(e) => handleContextMenu(e, song)}
                                    onTouchStart={(e) => handlePressStart(e, song)}
                                    onTouchEnd={handlePressEnd}
                                    onTouchCancel={handlePressCancel}
                                    className={`
                                    inline-flex p-3 pr-6 rounded-full items-center gap-3 cursor-pointer transition-[transform,opacity,border-color,background-color] duration-700 shrink-0
                                    ${isTransitioning ? 'blur-2xl opacity-0 grayscale scale-50 pointer-events-none' : `bg-card-bg/50 border ${isContextMenuOpen ? 'border-white/20 bg-white/10' : 'border-white/5 hover:border-white/20 hover:bg-white/10'} active:scale-95 group`}
                                `}
                                >
                                    <img
                                        src={song.thumbnail}
                                        alt={song.title}
                                        className="w-10 h-10 rounded-full object-cover border border-white/10"
                                        onError={(e) => { e.target.src = DEFAULT_THUMBNAIL; }}
                                    />
                                    <div className="flex flex-col">
                                        <span className={`text-sm font-medium max-w-[150px] truncate ${isContextMenuOpen ? 'text-white' : 'text-white/80 group-hover:text-white'}`}>{song.title}</span>
                                        {song.artist && <span className={`text-[10px] max-w-[150px] truncate ${isContextMenuOpen ? 'text-white/70' : 'text-white/50 group-hover:text-white/70'}`}>{song.artist}</span>}
                                        {song.hasLyrics && <span className="text-[9px] text-green-400 font-bold uppercase tracking-tighter mt-0.5">Lyrics</span>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* CONTEXT MENU */}
            <AnimatePresence>
                {contextMenu.isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.2 }}
                        className="context-menu fixed z-[100]"
                        style={{
                            left: `${contextMenu.position.x}px`,
                            top: `${contextMenu.position.y}px`,
                            transform: 'translate(-50%, -50%)'
                        }}
                    >
                        <div className="bg-slate-900/95 backdrop-blur-xl border border-white/20 rounded-xl shadow-2xl overflow-hidden min-w-[140px]">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setContextMenu({ isOpen: false, videoId: null, position: { x: 0, y: 0 } });
                                    // Small delay to ensure context menu closes before processing
                                    setTimeout(() => {
                                        processSong(contextMenu.song, contextMenu.song.thumbnail);
                                    }, 100);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-white hover:bg-primary/20 transition-colors border-b border-white/10"
                            >
                                <Mic2 size={14} className="text-primary" />
                                <span className="font-medium text-sm">Sing</span>
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const videoId = contextMenu.videoId;
                                    const song = contextMenu.song;
                                    setContextMenu({ isOpen: false, videoId: null, position: { x: 0, y: 0 } });
                                    openLyricsSearch(videoId, `${song.artist} ${song.title}`);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-white hover:bg-primary/20 transition-colors border-b border-white/10"
                            >
                                <Music size={14} className="text-primary" />
                                <span className="font-medium text-sm">Alt Lyrics</span>
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setContextMenu({ isOpen: false, videoId: null, position: { x: 0, y: 0 } });
                                    removeFromRecent(contextMenu.videoId);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-white hover:bg-red-500/20 transition-colors"
                            >
                                <Trash2 size={14} className="text-red-400" />
                                <span className="font-medium text-sm">Remove</span>
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* CONFIRMATION MODAL is now handled by the ConfirmModal component call at the bottom of the App return */}

            {/* KARAOKE PLAYER VIEW */}
            {(karaokeMode && currentSong) && (
                <KaraokePlayer
                    currentSong={currentSong}
                    lyricsData={lyricsData}
                    activeLineIndex={activeLineIndex}
                    isPlaying={isPlaying}
                    showControls={showControls}
                    setShowControls={setShowControls}
                    nextSingerName={nextSingerName}
                    nextSingerCount={nextSingerCount}
                    isWaitingForNextQueue={isWaitingForNextQueue}
                    isPresentationView={false}
                    headless={appConfig.appMode === 'presentation'}
                    karaokeContainerRef={karaokeContainerRef}
                    audioRef={audioRef}
                    toggleFullscreen={toggleFullscreen}
                    isFullscreen={isFullscreen}
                    setKaraokeMode={setKaraokeMode}
                    appConfig={appConfig}
                    isPartyMode={isPartyMode}
                    audioMode={audioMode}
                    setAudioMode={setAudioMode}
                    isAutoPaused={isAutoPaused}
                    isMobile={isMobile}
                    onOpenLyricsSearch={() => openLyricsSearch(currentSong.video_id || currentSong.videoId, `${currentSong.artist} ${currentSong.title}`)}
                />
            )}

            {/* SETTINGS OVERLAY */}
            <AnimatePresence>
                {showSettings && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[1000] flex items-center justify-end p-4 sm:p-8 pointer-events-none"
                    >
                        <motion.div
                            initial={{ x: 400, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: 400, opacity: 0 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="w-full max-w-md h-full bg-slate-900/90 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl flex flex-col pointer-events-auto overflow-hidden"
                        >
                            <div className="p-8 border-b border-white/5 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Settings className="text-primary" size={24} />
                                    <h2 className="text-2xl font-black text-white tracking-tight">Settings</h2>
                                </div>
                                <button
                                    onClick={() => setShowSettings(false)}
                                    className="p-2 rounded-full hover:bg-white/5 text-white/40 hover:text-white transition-all"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto stylized-scrollbar p-8 space-y-10">
                                {/* PERFORMANCE SECTION */}
                                <section className="space-y-4">
                                    {/* APP MODE SECTION */}
                                    <h3 className="text-text-muted text-[10px] font-black uppercase tracking-[0.2em] mt-6">Application Mode</h3>
                                    <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className={`p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400`}>
                                                <Monitor size={20} />
                                            </div>
                                            <div>
                                                <p className="text-white font-bold text-sm">App mode</p>
                                                <p className="text-white/40 text-[10px] leading-tight max-w-[180px]">Standalone includes the player screen. Presentation offloads it to a remote display.</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-1 bg-black/40 p-0.5 rounded-lg border border-white/5 h-8">
                                            <button
                                                onClick={() => updateConfig({ ...appConfig, appMode: 'standalone' })}
                                                className={`px-2 rounded-md text-[10px] font-bold transition-all ${appConfig.appMode !== 'presentation' ? 'bg-indigo-500 text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
                                            >
                                                Standalone
                                            </button>
                                            <button
                                                onClick={() => updateConfig({ ...appConfig, appMode: 'presentation' })}
                                                className={`px-2 rounded-md text-[10px] font-bold transition-all ${appConfig.appMode === 'presentation' ? 'bg-indigo-500 text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
                                            >
                                                Presentation
                                            </button>
                                        </div>
                                    </div>

                                    {/* ENVIRONMENT SECTION */}
                                    <h3 className="text-text-muted text-[10px] font-black uppercase tracking-[0.2em] mt-6">Environment</h3>
                                    <div className="space-y-3">
                                        {isTauri && (
                                            <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className={`p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400`}>
                                                        <Cpu size={20} />
                                                    </div>
                                                    <div>
                                                        <p className="text-white font-bold text-sm">GPU Acceleration</p>
                                                        <p className="text-white/40 text-[10px] leading-tight max-w-[180px]">Uses NVIDIA CUDA to speed up vocal separation significantly.</p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => updateConfig({ ...appConfig, gpuEnabled: !appConfig.gpuEnabled })}
                                                    className={`w-12 h-6 rounded-full transition-all relative ${appConfig.gpuEnabled ? 'bg-primary' : 'bg-white/10'}`}
                                                >
                                                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${appConfig.gpuEnabled ? 'left-7' : 'left-1'}`} />
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* KARAOKE SECTION */}
                                    <h3 className="text-text-muted text-[10px] font-black uppercase tracking-[0.2em] mt-6">Karaoke</h3>

                                    <div className="bg-white/5 border border-white/5 rounded-2xl p-4 space-y-3">
                                        <div className="flex flex-col gap-1.5">
                                            <p className="text-[9px] font-black text-text-muted uppercase tracking-wider">Instrumental Preset</p>
                                            <select
                                                value={appConfig.instrumentalPreset || "karaoke"}
                                                onChange={(e) => updateConfig({ ...appConfig, instrumentalPreset: e.target.value })}
                                                className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-white/80 focus:outline-none focus:border-primary/50 transition-all appearance-none"
                                            >
                                                <option value="instrumental_clean" className="bg-slate-900">Instrumental Clean (Best, minimal bleed)</option>
                                                <option value="instrumental_full" className="bg-slate-900">Instrumental Full (Max preservation)</option>
                                                <option value="instrumental_balanced" className="bg-slate-900">Instrumental Balanced</option>
                                                <option value="instrumental_low_resource" className="bg-slate-900">Instrumental Low Resource</option>
                                                <option value="karaoke" className="bg-slate-900">Karaoke (Standard)</option>
                                                <option value="none" className="bg-slate-900">UVR-MDX-NET Model Only (Force)</option>
                                            </select>
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <p className="text-[9px] font-black text-text-muted uppercase tracking-wider">Vocal Preset</p>
                                            <select
                                                value={appConfig.vocalPreset || "vocal_clean"}
                                                onChange={(e) => updateConfig({ ...appConfig, vocalPreset: e.target.value })}
                                                className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-white/80 focus:outline-none focus:border-primary/50 transition-all appearance-none"
                                            >
                                                <option value="vocal_clean" className="bg-slate-900">Vocal Clean (Minimal bleed)</option>
                                                <option value="vocal_balanced" className="bg-slate-900">Vocal Balanced (Best quality)</option>
                                                <option value="vocal_full" className="bg-slate-900">Vocal Full (Max capture)</option>
                                                <option value="vocal_rvc" className="bg-slate-900">Vocal RVC (Optimize Training)</option>
                                                <option value="none" className="bg-slate-900">UVR-MDX-NET Model Only (Force)</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className={`p-2.5 rounded-xl bg-primary/10 text-primary`}>
                                                <RefreshCw size={20} />
                                            </div>
                                            <div>
                                                <p className="text-white font-bold text-sm">Prepare Bar</p>
                                                <p className="text-white/40 text-[10px] leading-tight max-w-[180px]">When to display the reducing countdown bar before lines.</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-1 bg-black/40 p-0.5 rounded-lg border border-white/5 h-8">
                                            <button
                                                onClick={() => typeof updateConfig !== 'undefined' && updateConfig({ ...appConfig, prepareIndicatorMode: 'all' })}
                                                className={`px-2 rounded-md text-[10px] font-bold transition-all ${appConfig.prepareIndicatorMode === 'all' ? 'bg-primary text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
                                            >
                                                Always
                                            </button>
                                            <button
                                                onClick={() => typeof updateConfig !== 'undefined' && updateConfig({ ...appConfig, prepareIndicatorMode: 'long' })}
                                                className={`px-2 rounded-md text-[10px] font-bold transition-all ${appConfig.prepareIndicatorMode !== 'all' ? 'bg-primary text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
                                            >
                                                Long Gaps
                                            </button>
                                        </div>
                                    </div>

                                    {/* PLUGIN SECTION */}
                                    <h3 className="text-text-muted text-[10px] font-black uppercase tracking-[0.2em] mt-6">Library Source Plugins</h3>

                                    <div className="bg-white/5 border border-white/5 rounded-2xl p-4 space-y-3">
                                        <div className="flex flex-col gap-1.5">
                                            <p className="text-[9px] font-black text-text-muted uppercase tracking-wider">Active Plugin Path</p>
                                            <input
                                                type="text"
                                                value={appConfig.activePluginPath || ""}
                                                onChange={(e) => typeof updateConfig !== 'undefined' && updateConfig({ ...appConfig, activePluginPath: e.target.value })}
                                                placeholder="Leave blank for built-in default plugin..."
                                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[11px] text-white/80 focus:outline-none focus:border-primary/50 transition-all font-mono"
                                            />
                                            <p className="text-[9px] text-white/30">An executable or script that obeys the KraoQ JSON CLI contract.</p>
                                        </div>
                                        <div className="flex flex-col gap-1.5 mt-2">
                                            <p className="text-[9px] font-black text-text-muted uppercase tracking-wider">Raw Library Folder</p>
                                            <input
                                                type="text"
                                                value={appConfig.rawLibraryFolder || ""}
                                                onChange={(e) => typeof updateConfig !== 'undefined' && updateConfig({ ...appConfig, rawLibraryFolder: e.target.value })}
                                                placeholder="e.g. C:/KraoQ/RawAudio..."
                                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[11px] text-white/80 focus:outline-none focus:border-primary/50 transition-all font-mono"
                                            />
                                            <p className="text-[9px] text-white/30">Target directory where the plugin downloads audio/lyrics. Blank defaults to internal app data.</p>
                                        </div>
                                        <div className="flex flex-col gap-1.5 mt-2">
                                            <p className="text-[9px] font-black text-text-muted uppercase tracking-wider">Cloud Relay URL</p>
                                            <input
                                                type="text"
                                                value={appConfig.relayUrl || ""}
                                                onChange={(e) => typeof updateConfig !== 'undefined' && updateConfig({ ...appConfig, relayUrl: e.target.value })}
                                                placeholder="e.g. http://192.168.1.5:3000 or mykraorelay.com"
                                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[11px] text-white/80 focus:outline-none focus:border-primary/50 transition-all font-mono"
                                            />
                                            <p className="text-[9px] text-white/30">The address of the KraoQ Relay server. Leave blank to auto-detect local IP.</p>
                                        </div>
                                    </div>

                                    {/* GPU STATUS CARD */}
                                    {isTauri && (
                                        <div className={`mt-4 rounded-2xl border p-4 transition-all ${isCheckingGpu ? 'bg-white/5 border-white/5' :
                                            gpuStatus?.status === 'ok' ? 'bg-emerald-500/10 border-emerald-500/20' :
                                                gpuStatus?.status === 'degraded' ? 'bg-amber-500/10 border-amber-500/20' :
                                                    'bg-red-500/10 border-red-500/20'
                                            }`}>
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex items-start gap-3 min-w-0">
                                                    <div className={`p-2 rounded-xl shrink-0 ${isCheckingGpu ? 'bg-white/10 text-white/40' :
                                                        gpuStatus?.status === 'ok' ? 'bg-emerald-500/20 text-emerald-400' :
                                                            gpuStatus?.status === 'degraded' ? 'bg-amber-500/20 text-amber-400' :
                                                                'bg-red-500/20 text-red-400'
                                                        }`}>
                                                        {isCheckingGpu ? <Loader2 size={18} className="animate-spin" /> : <Monitor size={18} />}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <p className="text-white font-bold text-xs">GPU Status</p>
                                                            {!isCheckingGpu && gpuStatus && (
                                                                <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md ${gpuStatus.status === 'ok' ? 'bg-emerald-500/20 text-emerald-400' :
                                                                    gpuStatus.status === 'degraded' ? 'bg-amber-500/20 text-amber-400' :
                                                                        'bg-red-500/20 text-red-400'
                                                                    }`}>
                                                                    {gpuStatus.status === 'ok' ? 'Active' : gpuStatus.status === 'degraded' ? 'Degraded' : 'CPU Only'}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {isCheckingGpu ? (
                                                            <p className="text-white/30 text-[10px]">Checking GPU environment...</p>
                                                        ) : gpuStatus ? (
                                                            <div className="space-y-1.5">
                                                                <p className="text-white/50 text-[10px] leading-relaxed">{gpuStatus.message}</p>
                                                                <div className="flex flex-wrap gap-x-4 gap-y-1">
                                                                    <span className="text-[9px] text-white/30">
                                                                        <span className="text-white/50 font-semibold">Torch:</span> {gpuStatus.torchVersion}
                                                                    </span>
                                                                    {gpuStatus.torchCudaVersion && (
                                                                        <span className="text-[9px] text-white/30">
                                                                            <span className="text-white/50 font-semibold">CUDA:</span> {gpuStatus.torchCudaVersion}
                                                                        </span>
                                                                    )}
                                                                    {gpuStatus.cudaDeviceName && (
                                                                        <span className="text-[9px] text-white/30">
                                                                            <span className="text-white/50 font-semibold">GPU:</span> {gpuStatus.cudaDeviceName}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {gpuStatus.onnxProviders?.length > 0 && (
                                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                                        {gpuStatus.onnxProviders.map(p => (
                                                                            <span key={p} className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${p.includes('CUDA') ? 'bg-emerald-500/15 text-emerald-400/80' :
                                                                                p.includes('Tensorrt') ? 'bg-blue-500/15 text-blue-400/80' :
                                                                                    p.includes('Dml') ? 'bg-purple-500/15 text-purple-400/80' :
                                                                                        'bg-white/5 text-white/30'
                                                                                }`}>{p.replace('ExecutionProvider', '')}</span>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                </div>
                                                {!isCheckingGpu && (
                                                    <button
                                                        onClick={checkGpuStatus}
                                                        className="p-1.5 rounded-lg hover:bg-white/10 text-white/30 hover:text-white/60 transition-all shrink-0"
                                                        title="Re-check GPU status"
                                                    >
                                                        <RefreshCw size={12} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </section>

                                {/* DEPENDENCIES SECTION */}
                                {isTauri && (
                                    <section className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-text-muted text-[10px] font-black uppercase tracking-[0.2em]">Manage Dependencies</h3>
                                        </div>

                                        <div className="space-y-2">
                                            {[
                                                { id: 'python', key: 'pythonVersion', label: 'Python Engine', desc: 'Core runtime for AI processing' },
                                                { id: 'ffmpeg', key: 'ffmpegVersion', label: 'FFmpeg Core', desc: 'Audio conversion and encoding' },
                                                { id: 'models', key: null, label: 'AI Vocal Model', desc: 'Neural network weight files' },
                                                { id: 'pip', key: null, label: 'Pip Modules', desc: 'Required Python libraries' },
                                                { id: 'gpu', key: 'torchVersion', label: 'GPU Toolkit', desc: 'NVIDIA CUDA & cuDNN drivers' }
                                            ].map((dep) => (
                                                <div key={dep.id} className="group bg-white/5 border border-white/5 rounded-2xl p-4 space-y-4 hover:bg-white/[0.07] transition-all">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex flex-col">
                                                            <p className="text-white font-bold text-sm">{dep.label}</p>
                                                            <p className="text-white/30 text-[10px]">{dep.desc}</p>
                                                        </div>
                                                        <button
                                                            disabled={isReinstalling !== null}
                                                            onClick={() => handleReinstall(dep.id)}
                                                            className={`
                                                                flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all
                                                                ${isReinstalling === dep.id
                                                                    ? 'bg-primary text-white cursor-wait'
                                                                    : 'bg-white/5 text-white/40 hover:bg-white/20 hover:text-white'
                                                                }
                                                                ${isReinstalling !== null && isReinstalling !== dep.id ? 'opacity-30' : ''}
                                                            `}
                                                            Lark
                                                        >
                                                            {isReinstalling === dep.id ? (
                                                                <Loader2 size={12} className="animate-spin" />
                                                            ) : (
                                                                <RefreshCw size={12} />
                                                            )}
                                                            {isReinstalling === dep.id ? 'Installing...' : 'Re-install'}
                                                        </button>
                                                    </div>

                                                    {dep.key && (
                                                        <div className="flex items-center gap-4 pt-2 border-t border-white/5">
                                                            <div className="flex-1 flex flex-col gap-1.5">
                                                                <p className="text-[9px] font-black text-text-muted uppercase tracking-wider">Version</p>
                                                                <select
                                                                    value={appConfig[dep.key]}
                                                                    onChange={(e) => updateConfig({ ...appConfig, [dep.key]: e.target.value })}
                                                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-white/80 focus:outline-none focus:border-primary/50 transition-all appearance-none"
                                                                >
                                                                    {AVAILABLE_VERSIONS[dep.key].map(v => (
                                                                        <option key={v} value={v} className="bg-slate-900">{v}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                            {dep.id === 'gpu' && (
                                                                <div className="flex-1 flex flex-col gap-1.5">
                                                                    <p className="text-[9px] font-black text-text-muted uppercase tracking-wider">CUDA</p>
                                                                    <select
                                                                        value={appConfig.cudaVersion}
                                                                        onChange={(e) => updateConfig({ ...appConfig, cudaVersion: e.target.value })}
                                                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-white/80 focus:outline-none focus:border-primary/50 transition-all appearance-none"
                                                                    >
                                                                        {AVAILABLE_VERSIONS.cudaVersion.map(v => (
                                                                            <option key={v} value={v} className="bg-slate-900">{v}</option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                )}
                            </div>

                            <div className="p-8 border-t border-white/5 bg-white/[0.02]">
                                <p className="text-center text-white/20 text-[9px] font-bold uppercase tracking-[0.3em]">KraoQ v1.0.0-beta</p>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
            {/* PARTY MODE QR CODE */}
            {isPartyMode && partyUrl && (
                <div className="fixed top-4 left-4 z-[9999] bg-slate-900/90 backdrop-blur-xl p-3 rounded-3xl border border-white/10 shadow-2xl flex flex-col items-center gap-2 max-w-[160px] animate-in slide-in-from-left-4 duration-300">

                    <div className="p-2 bg-white rounded-2xl">
                        <QRCodeSVG value={partyUrl} size={120} bgColor="#ffffff" fgColor="#000000" level="H" />
                    </div>
                    <p className="text-[10px] font-bold text-white/90 text-center tracking-tight">Scan to Add Songs</p>
                    <p className="text-[8px] text-white/40 truncate w-full text-center hover:text-white transition-colors cursor-pointer" onClick={() => navigator.clipboard.writeText(partyUrl)}>{partyUrl.replace('http://', '')}</p>
                </div>
            )}

            {/* Full Screen Lock Overlay */}
            {isLockedByWeb && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 1 }}
                    className="fixed inset-0 z-[10000] bg-slate-950/95 backdrop-blur-3xl flex flex-col items-center justify-center gap-4 text-center p-8"
                >
                    <motion.div
                        animate={{ scale: [1, 1.05, 1] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="p-4 rounded-full bg-indigo-500/20 text-indigo-400"
                    >
                        <Monitor size={48} />
                    </motion.div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Display Forwarded</h1>
                    <p className="text-sm text-white/60 max-w-[320px]">This workspace is currently being controlled and viewed strictly from another remote screen.</p>

                    {status && (
                        <div className="mt-2 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-[11px] text-slate-400">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            {status}
                        </div>
                    )}

                    <div className="mt-4 flex flex-col items-center gap-3">
                        <div className="flex items-center gap-2 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 max-w-[280px]">
                            <AlertCircle className="text-amber-400 shrink-0" size={16} />
                            <p className="text-[10px] text-amber-300 text-left leading-snug">Disconnection risk! Taking over will boot other viewers and might desynchronize backends state.</p>
                        </div>
                        <button
                            onClick={isTauri ? handleTauriTakeover : () => {
                                if (wsRef.current) wsRef.current.close();
                                forceReconnectRef.current = true;
                                setReconnectTrigger(prev => prev + 1);
                                setIsLockedByWeb(false);
                            }}
                            className="px-5 py-2.5 rounded-2xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-black uppercase tracking-widest shadow-lg transform active:scale-95 transition-all flex items-center gap-2"
                        >
                            <RefreshCw size={14} className={forceReconnectRef.current ? "animate-spin" : ""} /> Force take over
                        </button>
                    </div>

                    <p className="text-[11px] text-white/30 uppercase tracking-[0.2em] mt-2">Connection updates live...</p>
                </motion.div>
            )}

            {/* LYRICS SEARCH MODAL */}
            <AnimatePresence>
                {showLyricsSearch && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl"
                        onClick={() => setShowLyricsSearch(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="bg-slate-900 border border-white/10 rounded-[2.5rem] shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/5">
                                <div>
                                    <h3 className="text-2xl font-black text-white tracking-tight">Alternative Lyrics</h3>
                                    <p className="text-white/40 text-sm mt-1">Sourcing from lrclib.net</p>
                                </div>
                                <button
                                    onClick={() => setShowLyricsSearch(false)}
                                    className="p-3 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-all"
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="p-6 border-b border-white/5 bg-black/20">
                                <div className="relative group">
                                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-primary transition-colors" size={20} />
                                    <input
                                        type="text"
                                        value={lyricsSearchQuery}
                                        onChange={(e) => setLyricsSearchQuery(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleLyricsSearch(lyricsSearchQuery)}
                                        placeholder="Search artist or song title..."
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-14 pr-6 text-white text-lg focus:outline-none focus:border-primary/50 transition-all font-medium"
                                    />
                                    <button 
                                        onClick={() => handleLyricsSearch(lyricsSearchQuery)}
                                        disabled={isSearchingLyrics}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white px-5 py-2 rounded-xl text-sm font-black transition-all"
                                    >
                                        {isSearchingLyrics ? <Loader2 size={16} className="animate-spin" /> : "Search"}
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto stylized-scrollbar p-6 space-y-3">
                                {isSearchingLyrics && (
                                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                                        <div className="relative">
                                            <div className="w-16 h-16 rounded-full border-4 border-primary/20" />
                                            <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                                        </div>
                                        <p className="text-white/60 font-bold animate-pulse">Scanning Global Databases...</p>
                                    </div>
                                )}

                                {!isSearchingLyrics && lyricsSearchResults.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-20 text-white/20">
                                        <Music size={64} strokeWidth={1} className="mb-4" />
                                        <p className="text-lg font-bold italic">No alternative lyrics found.</p>
                                        <p className="text-sm mt-1">Try a different search term.</p>
                                    </div>
                                )}

                                {!isSearchingLyrics && [
                                    ...lyricsSearchResults.filter(r => lyricsStatus.activeId === r.id),
                                    ...lyricsSearchResults.filter(r => lyricsStatus.activeId !== r.id)
                                ].map((result, idx) => (
                                    <motion.div
                                        key={idx}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                        className="group bg-white/5 hover:bg-white/10 border border-white/5 hover:border-primary/30 rounded-2xl p-5 flex items-center justify-between transition-all cursor-pointer"
                                        onClick={() => confirmApplyLyrics(result)}
                                    >
                                        <div className="flex-1 min-w-0 pr-4">
                                            <h4 className="text-white font-black text-lg truncate group-hover:text-primary transition-colors">{result.lrcName}</h4>
                                            <div className="flex items-center gap-3 mt-1.5">
                                                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 text-[10px] font-black uppercase text-white/40 tracking-wider">
                                                    <Maximize2 size={10} />
                                                    {Math.floor(result.songLength / 60)}:{(result.songLength % 60).toString().padStart(2, '0')}
                                                </div>
                                                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-[10px] font-black uppercase text-emerald-400 tracking-wider">
                                                    <Zap size={10} fill="currentColor" />
                                                    Start: {result.firstWordTime ? `${result.firstWordTime.toFixed(1)}s` : "Unknown"}
                                                </div>
                                                {result.syncedLyrics && (
                                                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 text-[10px] font-black uppercase text-primary-hover tracking-wider">
                                                        Synced
                                                    </div>
                                                )}
                                                {lyricsStatus.activeId === result.id && (
                                                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/20 text-[10px] font-black uppercase text-blue-500 tracking-wider">
                                                        <Check size={10} strokeWidth={3} />
                                                        In Use
                                                    </div>
                                                )}
                                                {lyricsStatus.downloadedIds.includes(result.id) && lyricsStatus.activeId !== result.id && (
                                                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-500/20 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                                        <Download size={10} strokeWidth={3} />
                                                        Downloaded
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <button className="p-3 rounded-xl bg-primary text-white opacity-0 group-hover:opacity-100 transition-all transform translate-x-4 group-hover:translate-x-0 shadow-lg shadow-primary/20">
                                            <ArrowRight size={20} strokeWidth={3} />
                                        </button>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* AUTH OVERLAY */}
            <AnimatePresence>
                {showLoginOverlay && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xl p-8"
                    >
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            className="w-full max-w-sm bg-zinc-900/50 border border-white/10 p-8 rounded-3xl shadow-2xl relative overflow-hidden"
                        >
                             {/* Decorative glow */}
                            <div className="absolute -top-24 -left-24 w-48 h-48 bg-purple-500/20 rounded-full blur-[80px]" />
                            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-blue-500/20 rounded-full blur-[80px]" />

                            <button 
                                onClick={() => setShowLoginOverlay(false)}
                                className="absolute top-4 right-4 p-2 text-white/30 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                            >
                                <X size={20} />
                            </button>

                            <div className="text-center space-y-2 mb-8 relative">
                                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-500/20">
                                    <Zap className="text-white" size={32} />
                                </div>
                                <h2 className="text-2xl font-bold text-white tracking-tight">
                                    {authMode === 'login' ? 'Welcome Back' : 'Create Account'}
                                </h2>
                                <p className="text-white/50 text-sm">
                                    {authMode === 'login' 
                                        ? 'Sign in to your KraoQ account to host parties' 
                                        : 'Join the party and start hosting your own events'}
                                </p>
                            </div>

                            <form className="space-y-4 relative" onSubmit={(e) => {
                                e.preventDefault();
                                handleAuth(e.target.username.value, e.target.password.value);
                            }}>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-white/40 uppercase tracking-widest ml-1">Username</label>
                                    <input 
                                        name="username"
                                        type="text"
                                        required
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-purple-500/40 transition-all font-medium"
                                        placeholder="Enter your username"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-white/40 uppercase tracking-widest ml-1">Password</label>
                                    <input 
                                        name="password"
                                        type="password"
                                        required
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-purple-500/40 transition-all font-medium"
                                        placeholder="••••••••"
                                    />
                                </div>

                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    type="submit"
                                    disabled={authLoading}
                                    className="w-full bg-white text-black font-bold py-3.5 rounded-xl mt-4 flex items-center justify-center space-x-2 disabled:opacity-50 shadow-xl shadow-white/5"
                                >
                                    {authLoading ? (
                                        <Loader2 className="animate-spin" size={20} />
                                    ) : (
                                        <>
                                            <span>{authMode === 'login' ? 'Sign In' : 'Create Account'}</span>
                                            <ArrowRight size={18} />
                                        </>
                                    )}
                                </motion.button>

                                <div className="pt-4 text-center">
                                    <button 
                                        type="button"
                                        onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                                        className="text-sm text-white/40 hover:text-white transition-colors"
                                    >
                                        {authMode === 'login' 
                                            ? "Don't have an account? Create one" 
                                            : "Already have an account? Sign in"}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <ConfirmModal modal={confirmModal} setModal={setConfirmModal} />
        </div>

    );
}

function ConfirmModal({ modal, setModal }) {
    return (
        <AnimatePresence>
            {modal.isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
                    onClick={() => setModal({ ...modal, isOpen: false })}
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="bg-slate-900 border border-white/10 rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4 overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-xl ${modal.type === 'danger' ? 'bg-red-500/20 text-red-400' : 'bg-primary/20 text-primary'}`}>
                                {modal.type === 'danger' ? <AlertCircle size={24} /> : <CheckCircle2 size={24} />}
                            </div>
                            <h3 className="text-xl font-black text-white">{modal.title || 'Confirm Action'}</h3>
                        </div>
                        <p className="text-white/60 text-sm">{modal.message}</p>
                        <div className="flex justify-end gap-3 mt-4">
                            <button
                                onClick={() => setModal({ ...modal, isOpen: false })}
                                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-sm font-medium transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    if (modal.onConfirm) modal.onConfirm();
                                    setModal({ ...modal, isOpen: false });
                                }}
                                className={`px-4 py-2 rounded-xl text-sm font-black transition-all ${modal.type === 'danger'
                                    ? 'bg-red-500 hover:bg-red-600 text-white shadow-[0_0_15px_rgba(239,68,68,0.3)]'
                                    : 'bg-primary hover:bg-primary-hover text-white shadow-[0_0_15px_rgba(99,102,241,0.3)]'
                                    }`}
                            >
                                {modal.confirmText || 'Confirm'}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

function parseLRC(lrcText) {
    const lyricsData = [];
    const lines = lrcText.split('\n');
    const timeReg = /\[(\d+):(\d+\.\d+)\]/;

    lines.forEach(line => {
        const match = timeReg.exec(line);
        if (match) {
            const minutes = parseInt(match[1]);
            const seconds = parseFloat(match[2]);
            const time = minutes * 60 + seconds;
            const text = line.replace(timeReg, '').trim();
            if (text) lyricsData.push({ time, text });
        }
    });
    lyricsData.sort((a, b) => a.time - b.time);
    return lyricsData;
}


export default App;
