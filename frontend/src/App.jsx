import React, { useState, useEffect, useRef } from 'react';
import { Search, Music, Mic2, Maximize2, Minimize2, Play, Pause, X, ArrowRight, Loader2, Trash2, CheckCircle2, Circle, AlertCircle, Settings, Zap, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AuroraBackground from './components/AuroraBackground';
import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
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

function App() {
    const [setupStatus, setSetupStatus] = useState("Checking dependencies...");
    const [setupSteps, setSetupSteps] = useState([
        { id: 'python', label: 'Python Runtime', status: 'pending', progress: 0 },
        { id: 'ffmpeg', label: 'FFmpeg Engine', status: 'pending', progress: 0 },
        { id: 'models', label: 'AI Vocal Models', status: 'pending', progress: 0 },
        { id: 'pip', label: 'Neural Modules', status: 'pending', progress: 0 },
        { id: 'gpu', label: 'GPU Acceleration', status: 'pending', progress: 0 },
    ]);
    const [isReady, setIsReady] = useState(false);
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
    const [suggestions, setSuggestions] = useState([]);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [searchLimit, setSearchLimit] = useState(20);
    const [headerRect, setHeaderRect] = useState(null);
    // const [showLoginModal, setShowLoginModal] = useState(false); // Removed for local single-user
    const [contextMenu, setContextMenu] = useState({ isOpen: false, videoId: null, position: { x: 0, y: 0 } });
    const [showSettings, setShowSettings] = useState(false);
    const [appConfig, setAppConfig] = useState({ gpuEnabled: true });
    const [isReinstalling, setIsReinstalling] = useState(null); // id of dependency being reinstalled
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
            try {
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

    const loadConfig = async () => {
        try {
            const config = await invoke('get_app_config');
            setAppConfig(config);
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

    const handleReinstall = async (id) => {
        setIsReinstalling(id);
        try {
            await invoke('reinstall_dependency', { id });
            setSetupSteps(prev => prev.map(step =>
                step.id === id ? { ...step, status: 'done', progress: 100 } : step
            ));
        } catch (e) {
            console.error(`Failed to reinstall ${id}`, e);
            alert(`Failed to reinstall ${id}: ${e}`);
        } finally {
            setIsReinstalling(null);
        }
    };

    // ... existing refs and effects ...





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

    // Sync Lyrics
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio || !lyricsData.length) return;

        const handleTimeUpdate = () => {
            const currentTime = audio.currentTime;
            let newIndex = -1;
            for (let i = 0; i < lyricsData.length; i++) {
                // Add 300ms offset to trigger transition slightly earlier for the singer
                if (currentTime + 0.3 >= lyricsData[i].time) newIndex = i;
                else break;
            }
            if (newIndex !== activeLineIndex) {
                setActiveLineIndex(newIndex);
            }
        };

        audio.addEventListener('timeupdate', handleTimeUpdate);
        return () => audio.removeEventListener('timeupdate', handleTimeUpdate);
    }, [lyricsData, activeLineIndex, karaokeMode, currentSong]);

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


    const processSong = async (videoIdInput, thumbnail = null, e = null) => {
        // Handle variations (old history or direct pass)
        const videoId = (typeof videoIdInput === 'string' ? videoIdInput : (videoIdInput?.videoId || videoIdInput?.id));
        const songTitle = (typeof videoIdInput === 'object' ? (videoIdInput.title || videoIdInput.name) : null);

        if (!videoId) {
            setStatus("Error: Invalid Video ID");
            return;
        }

        // Immediately set info for transition tracking
        let title = "Loading...";
        let artist = "";
        const foundInSearch = searchResults.find(v => v.videoId === videoId);
        const foundInRecent = recentSongs.find(s => s.videoId === videoId);
        if (foundInSearch) {
            title = foundInSearch.title;
            artist = foundInSearch.artists || foundInSearch.channel || "";
        } else if (foundInRecent) {
            title = foundInRecent.title;
            artist = foundInRecent.artist || "";
        }

        setCurrentSong({ videoId, thumbnail, title, artist });
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

            const parsed = parseLRC(result.data.lrc);
            setLyricsData(parsed);

            setCurrentSong({
                title: result.data.title || "Unknown Song",
                artist: result.data.artist || "Unknown Artist",
                thumbnail: thumbnail || "https://music.youtube.com/img/on_platform_logo_dark.svg",
                videoId: videoId,
                instrumentalUrl: convertFileSrc(result.data.instrumentalUrl.replace('asset://localhost/', ''))
            });

            addToRecent({
                videoId,
                title: result.data.title || "Unknown",
                artist: result.data.artist || "Unknown",
                thumbnail: thumbnail || "https://music.youtube.com/img/on_platform_logo_dark.svg",
                hasLyrics: true
            });

            // Update session cache (keep it in memory only)
            setSongCache(prev => ({
                ...prev,
                [videoId]: {
                    lyricsData: parsed,
                    currentSong: {
                        title: result.data.title || "Unknown Song",
                        artist: result.data.artist || "Unknown Artist",
                        thumbnail: thumbnail || "https://music.youtube.com/img/on_platform_logo_dark.svg",
                        videoId: videoId,
                        instrumentalUrl: convertFileSrc(result.data.instrumentalUrl.replace('asset://localhost/', ''))
                    }
                }
            }));

            finalizeTransition();

        } catch (e) {
            console.error(e);

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
    const [showControls, setShowControls] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);

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
        return () => {
            audio.removeEventListener('play', setPlaying);
            audio.removeEventListener('pause', setPaused);
        };
    }, [currentSong, karaokeMode]);

    // Helper Logic for Lyrics Display
    const currentLine = activeLineIndex !== -1 ? lyricsData[activeLineIndex] : null;
    const prevLine = activeLineIndex > 0 ? lyricsData[activeLineIndex - 1] : null;
    const nextLine = activeLineIndex < lyricsData.length - 1 ? lyricsData[activeLineIndex + 1] : null;

    // Countdown Dot Logic
    let displayNextText = nextLine ? nextLine.text : (lyricsData.length > 0 && activeLineIndex === -1 ? lyricsData[0].text : "");
    let displayCurrText = currentLine ? currentLine.text : (activeLineIndex === -1 ? `Now Singing: ${currentSong ? currentSong.title + ' - ' + currentSong.artist : 'Loading...'}` : "");

    if (audioRef.current && lyricsData.length > 0) {
        const currentTime = audioRef.current.currentTime;
        // Check Interlude
        if (activeLineIndex !== -1 && activeLineIndex < lyricsData.length - 1) {
            const gap = lyricsData[activeLineIndex + 1].time - lyricsData[activeLineIndex].time;
            const timeUntilNext = lyricsData[activeLineIndex + 1].time - currentTime;
            if (gap > 8 && timeUntilNext > 0 && timeUntilNext < 4) {
                const dots = "• ".repeat(Math.ceil(timeUntilNext));
                displayNextText = dots + displayNextText;
            }
        }
        // Check Intro
        if (activeLineIndex === -1) {
            const firstTime = lyricsData[0].time;
            const timeUntilStart = firstTime - currentTime;
            if (timeUntilStart > 0 && timeUntilStart < 5) {
                displayCurrText = "Get Ready...";
                const dots = "• ".repeat(Math.ceil(timeUntilStart));
                displayNextText = dots + displayNextText;
            }
        }
    }

    if (!isReady) {
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
        <div className={`z-10 relative transition-all duration-500 ${karaokeMode ? 'w-full min-h-screen' : 'w-full max-w-[1100px] mx-auto p-4 sm:p-8'}`}>
            {/* HEADER AREA */}
            {!karaokeMode && (
                <header className={`p-6 mb-8 flex justify-between items-center transition-all duration-1000 ${isTransitioning ? 'blur-2xl opacity-0' : 'opacity-100'}`}>
                    <div className="flex flex-col gap-1">
                        <h1 className="text-4xl font-black tracking-tighter text-white flex items-center gap-2">
                            KraoQ <span className="text-accent text-sm font-bold bg-accent/20 px-2 py-0.5 rounded-full tracking-normal">BETA</span>
                        </h1>
                        <p className="text-text-muted text-[10px] font-black uppercase tracking-[0.2em] opacity-50">Professional AI Karaoke</p>
                    </div>

                    <div className="flex items-center gap-3">
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

            {/* Aurora Colors during Transition only */}
            {isTransitioning && !karaokeMode && (
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
                        transform: `translate(-50%, -50%) scale(${transitionStage === 'fadeout' ? 0.7 : 0.6})`
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
                            ? 'p-6 gap-6 rounded-full w-auto max-w-[600px] min-w-[350px] pr-12 bg-slate-900/90 backdrop-blur-md border border-primary/50 shadow-[0_0_80px_rgba(99,102,241,0.4)] ring-2 ring-primary/30'
                            : `gap-4 bg-card-bg border border-white/10 shadow-xl overflow-hidden ${selectedSource === 'recent' ? 'p-3 rounded-full' : (selectedSource === 'dropdown' ? 'p-3 rounded-xl' : 'p-4 rounded-2xl')}`}
                        ${transitionStage === 'fadeout' ? 'opacity-0 blur-2xl scale-110' : 'opacity-100'}
                    `}
                >
                    <img
                        src={currentSong.thumbnail}
                        className={`
                            shrink-0 transition-[transform,width,height,border-radius] duration-1000 ease-[cubic-bezier(0.23,1,0.32,1)] will-change-[transform,width,height]
                            ${transitionStage === 'hero' || transitionStage === 'fadeout'
                                ? 'w-20 h-20 rounded-full shadow-lg'
                                : (selectedSource === 'recent' ? 'w-10 h-10 rounded-full' : (selectedSource === 'dropdown' ? 'w-12 h-12 rounded' : 'w-24 h-24 rounded-xl'))}
                            object-cover
                        `}
                    />
                    <div className="flex-1 min-w-0">
                        <h2 className={`
                            font-black text-white transition-[font-size,opacity] duration-1000 ease-[cubic-bezier(0.23,1,0.32,1)]
                            ${transitionStage === 'hero' || transitionStage === 'fadeout'
                                ? 'text-2xl whitespace-nowrap truncate'
                                : (selectedSource === 'recent' || selectedSource === 'dropdown' ? 'text-sm font-medium truncat' : 'text-lg font-bold truncate')}
                        `}>
                            {currentSong.title}
                        </h2>
                        {currentSong.artist && (
                            <p className={`
                                text-text-muted transition-[font-size,opacity] duration-1000 ease-[cubic-bezier(0.23,1,0.32,1)]
                                ${transitionStage === 'hero' || transitionStage === 'fadeout'
                                    ? 'text-lg mt-0.5'
                                    : 'text-xs truncate'}
                            `}>
                                {currentSong.artist}
                            </p>
                        )}
                        {/* Preparing Status */}
                        {(transitionStage === 'hero' || transitionStage === 'fadeout') && (
                            <p className={`text-primary-hover font-bold animate-pulse mt-1 flex items-center gap-2 transition-opacity duration-300 ${transitionStage === 'fadeout' ? 'opacity-0' : 'opacity-100'}`}>
                                <Mic2 size={18} /> Preparing Your Stage...
                            </p>
                        )}
                    </div>
                    {/* Progress Circle for API calls */}
                    {isProcessing && (transitionStage === 'hero' || transitionStage === 'fadeout') && (
                        <div className="ml-auto shrink-0 animate-in fade-in zoom-in duration-500">
                            <div className="w-10 h-10 rounded-full border-4 border-white/5 border-t-primary animate-spin shadow-[0_0_15px_rgba(99,102,241,0.5)]"></div>
                        </div>
                    )}
                </div>
            )}

            {/* AUTH HEADER removed for local single-user */}

            {/* HEADER */}
            {!karaokeMode && (
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
            {!karaokeMode && (
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
            {!karaokeMode && recentSongs.length > 0 && searchResults.length === 0 && (
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

            {/* KARAOKE PLAYER VIEW */}
            {karaokeMode && currentSong && (
                <div
                    ref={karaokeContainerRef}
                    className={`
                        animate-in fade-in duration-500
                        bg-black overflow-hidden fixed inset-0 z-50 flex flex-col items-center justify-center
                    `}
                    style={{ touchAction: 'none' }}
                    onClick={() => setShowControls(prev => !prev)}
                    onDoubleClick={!isMobile() ? toggleFullscreen : undefined}
                >
                    <div
                        className={`
                         relative bg-black overflow-hidden flex-1 w-full h-full flex flex-col items-center justify-center transition-opacity duration-300
                     `}
                        style={{ touchAction: 'none' }}
                    >
                        <AuroraBackground audioRef={audioRef} />
                        {/* Play/Pause Overlay */}
                        <div className={`
                            absolute inset-0 z-20 flex items-center justify-center transition-opacity duration-300
                            ${showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
                        `}>
                            <div
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (audioRef.current.paused) {
                                        audioRef.current.play();
                                    } else {
                                        audioRef.current.pause();
                                    }
                                }}
                                className="w-24 h-24 flex items-center justify-center bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-white shadow-2xl transform active:scale-90 transition-[background-color,transform] cursor-pointer hover:bg-white/20"
                            >
                                {isPlaying ? <Pause size={48} fill="currentColor" /> : <Play size={48} fill="currentColor" className="ml-2" />}
                            </div>
                        </div>

                        <div
                            className={`text-center w-full z-10 relative overflow-hidden transition-all duration-300 will-change-[transform,opacity] ${showControls ? (!isMobile() ? 'blur-sm opacity-50 scale-95' : 'opacity-40') : 'blur-0 opacity-100 scale-100'}`}
                            style={{
                                height: '80vh',
                                maskImage: 'linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)',
                                WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)'
                            }}
                        >
                            <div
                                className="absolute inset-x-12 transition-transform duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] will-change-transform"
                                style={{
                                    transform: `translateY(${- (activeLineIndex + 1) * 220}px)`,
                                    top: '50%',
                                    marginTop: '-110px'
                                }}
                            >
                                {/* Initial / Intro Line */}
                                <div className={`flex items-center justify-center transition-all duration-500 h-[220px] ${activeLineIndex === -1 ? 'scale-110 opacity-100' : 'scale-90 opacity-40'}`}>
                                    <span
                                        className={`${activeLineIndex === -1 ? 'bg-clip-text text-transparent bg-gradient-to-r from-red-500 via-yellow-400 via-green-400 via-cyan-400 via-blue-500 to-purple-500 drop-shadow-[0_0_20px_rgba(99,102,241,0.4)]' : 'text-white'} font-bold leading-tight`}
                                        style={{ fontSize: 'clamp(1.2rem, 6vw, 3.5rem)' }}
                                    >
                                        {activeLineIndex === -1 ? displayCurrText : ""}
                                    </span>
                                </div>

                                {lyricsData.map((line, idx) => (
                                    <div
                                        key={idx}
                                        className={`flex items-center justify-center transition-all duration-500 h-[220px] px-6 ${idx === activeLineIndex ? 'scale-105 opacity-100' : 'scale-95 opacity-30'}`}
                                    >
                                        <span
                                            className={`font-black transition-all text-center leading-[1.1] ${idx === activeLineIndex ? 'bg-clip-text text-transparent bg-gradient-to-r from-red-500 via-yellow-400 via-green-400 via-cyan-400 via-blue-500 to-purple-500' : 'text-white'}`}
                                            style={{
                                                fontSize: 'clamp(1.2rem, 6vw, 3.5rem)',
                                                textShadow: idx === activeLineIndex ? '0 0 15px rgba(99,102,241,0.5)' : 'none',
                                                WebkitTextFillColor: idx === activeLineIndex ? 'transparent' : 'white'
                                            }}
                                        >
                                            {idx === activeLineIndex + 1 && displayNextText.includes('•') ? displayNextText : line.text}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Controls Container - Optimized with Transform */}
                    <div
                        className={`w-full absolute bottom-0 left-0 right-0 z-40 transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] px-4 sm:px-20 py-3 bg-black border-t border-white/5 will-change-transform ${showControls ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}
                        style={{ paddingBottom: isMobile() ? 'calc(1.5rem + env(safe-area-inset-bottom))' : '1.5rem' }}
                        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking controls
                    >
                        <div className={`grid ${!isMobile() ? 'grid-cols-[1fr,auto]' : 'grid-cols-1'} gap-x-0 items-center`}>
                            <audio
                                ref={audioRef}
                                src={currentSong.instrumentalUrl}
                                crossOrigin="anonymous"
                                controls
                                controlsList="nodownload noplaybackrate"
                                autoPlay
                                className="w-full h-10 rounded-xl invert hue-rotate-180 brightness-150 custom-audio-controls"
                            />
                            {!isMobile() && (
                                <button
                                    onClick={toggleFullscreen}
                                    className="h-10 flex items-center pr-6 text-white/50 hover:text-white transform active:scale-90 transition-all cursor-pointer"
                                    title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                                >
                                    {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                                </button>
                            )}

                            <div className="mt-1 text-text-muted text-[10px] uppercase tracking-widest font-bold px-2 col-span-2 opacity-50">
                                Mode: <span className="text-accent">Instrumental</span>
                            </div>
                        </div>
                    </div>

                    {/* Back Button */}
                    {showControls && (
                        <button
                            className="absolute top-10 right-6 z-[100] bg-black/50 backdrop-blur-md p-3 rounded-full text-white/80 hover:text-white transition-all active:scale-90 border border-white/10 shadow-2xl"
                            onClick={(e) => {
                                e.stopPropagation();
                                audioRef.current?.pause();
                                setKaraokeMode(false);
                            }}
                            title="Close Player"
                        >
                            <X size={24} strokeWidth={3} />
                        </button>
                    )}
                </div>
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
                                    <h3 className="text-text-muted text-[10px] font-black uppercase tracking-[0.2em]">Performance</h3>
                                    <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className={`p-2.5 rounded-xl ${appConfig.gpuEnabled ? 'bg-primary/20 text-primary' : 'bg-white/5 text-white/20'}`}>
                                                <Zap size={20} fill={appConfig.gpuEnabled ? 'currentColor' : 'none'} />
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
                                </section>

                                {/* DEPENDENCIES SECTION */}
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
                            </div>

                            <div className="p-8 border-t border-white/5 bg-white/[0.02]">
                                <p className="text-center text-white/20 text-[9px] font-bold uppercase tracking-[0.3em]">KraoQ v1.0.0-beta</p>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
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
