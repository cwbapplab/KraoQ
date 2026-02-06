import React, { useState, useEffect, useRef } from 'react';
import { Search, Music, Mic2, Maximize2, Minimize2, Play, Pause, X, ArrowRight, Loader2, User, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AuroraBackground from './components/AuroraBackground';
import AuthModal from './components/AuthModal';
import ConfirmationModal from './components/ConfirmationModal';
import { useAuth } from './hooks/useAuth';

const API_URL = "http://localhost:3001";
const DEFAULT_THUMBNAIL = `data:image/svg+xml;base64,PCFET0NUWVBFIHN2ZyBQVUJMSUMgIi0vL1czQy8vRFREIFNWRyAxLjEvL0VOIiAiaHR0cDovL3d3dy53My5vcmcvR3JhcGhpY3MvU1ZHLzEuMS9EVEQvc3ZnMTEuZHRkIj4KDTwhLS0gVXBsb2FkZWQgdG86IFNWRyBSZXBvLCB3d3cuc3ZncmVwby5jb20sIFRyYW5zZm9ybWVkIGJ5OiBTVkcgUmVwbyBNaXhlciBUb29scyAtLT4KPHN2ZyB3aWR0aD0iMTkzcHgiIGhlaWdodD0iMTkzcHgiIHZpZXdCb3g9Ii02LjQ4IC02LjQ4IDM2Ljk2IDM2Ljk2IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgoNPGcgaWQ9IlNWR1JlcG9fYmdDYXJyaWVyIiBzdHJva2Utd2lkdGg9IjAiPgoNPHJlY3QgeD0iLTYuNDgiIHk9Ii02LjQ4IiB3aWR0aD0iMzYuOTYiIGhlaWdodD0iMzYuOTYiIHJ4PSIyLjk1NjgiIGZpbGw9IiMyOTI5MjkiIHN0cm9rZXdpZHRoPSIwIi8+Cg08L2c+Cg08ZyBpZD0iU1ZHUmVwb190cmFjZXJDYXJyaWVyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KDTxnIGlkPSJTVkdSZXBvX2ljb25DYXJyaWVyIj4gPHBhdGggZD0iTTEyLjc1IDEyLjUwOEwyMS4yNSA5LjEwOFYxNC43NjA5QzIwLjc0NDkgMTQuNDM3NSAyMC4xNDQzIDE0LjI1IDE5LjUgMTQuMjVDMTcuNzA1MSAxNC4yNSAxNi4yNSAxNS43MDUxIDE2LjI1IDE3LjVDMTYuMjUgMTkuMjk0OSAxNy43MDUxIDIwLjc1IDE5LjUgMjAuNzVDMjEuMjk0OSAyMC43NSAyMi43NSAxOS4yOTQ5IDIyLjc1IDE3LjVDMjIuNzUgMTcuNSAyMi43NSAxNy41IDIyLjc1IDE3LjVMMjIuNzUgNy45NDYyNUMyMi43NSA2LjgwMzQyIDIyLjc1IDUuODQ0OTYgMjIuNjY5NiA1LjA4MTMxQzIyLjY1ODIgNC45NzMzOSAyMi42NDQ4IDQuODY2MDkgMjIuNjMgNC43NjU5N0MyMi41NTI1IDQuMjQ0MjYgMjIuNDE1NiAzLjc1NzU3IDIyLjE1MTQgMy4zNTExNUMyMi4wMTkzIDMuMTQ3OTQgMjEuODU1MyAyLjk2NDgxIDIxLjY1MTEgMi44MDczOUMyMS42MTI4IDIuNzc3ODggMjEuNTczIDIuNzQ5MjcgMjEuNTMxOSAyLjcyMTZMMjEuNTIzNiAyLjcxNjA4QzIwLjgxNjQgMi4yNDU0IDIwLjAyMTMgMi4yNzkwNiAxOS4yMDIzIDIuNDg3NzdDMTguNDEwMiAyLjY4OTYxIDE3LjQyODIgMy4xMDA2NSAxNi4yMjQgMy42MDQ2OUwxNC4xMyA0LjQ4MTE1QzEzLjU2NTUgNC43MTczNyAxMy4wODczIDQuOTE3NTEgMTIuNzEyIDUuMTI0OEMxMi4zMTI2IDUuMzQ1MzUgMTEuOTY4NiA1LjYwNTQ4IDExLjcxMDYgNS45OTMxMUMxMS40NTI3IDYuMzgwNzUgMTEuMzQ1NSA2Ljc5ODUgMTEuMjk2MyA3LjI1MjA0QzExLjI1IDcuNjc4MzEgMTEuMjUgOC4xOTY3MSAxMS4yNSA4LjgwODU4VjE2Ljc2MDlDMTAuNzQ0OCAxNi40Mzc1IDEwLjE0NDMgMTYuMjUgOS41IDE2LjI1QzcuNzA1MDcgMTYuMjUgNi4yNSAxNy43MDUxIDYuMjUgMTkuNUM2LjI1IDIxLjI5NDkgNy43MDUwNyAyMi43NSA5LjUgMjIuNzVDMTEuMjk0OSAyMi43NSAxMi43NSAyMS4yOTQ5IDEyLjc1IDE5LjVDMTIuNzUgMTkuNSAxMi43NSAxOS41IDEyLjc1IDE5LjVMMTIuNzUgMTIuNTA4WiIgZmlsbD0iI2ZmZmZmZiIvPiA8cGF0aCBvcGFjaXR5PSIwLjUiIGQ9Ik03Ljc1IDJDNy43NSAxLjU4NTc5IDcuNDE0MjEgMS4yNSA3IDEuMjVDNi41ODU3OSAxLjI1IDYuMjUgMS41ODU3OSA2LjI1IDJWNy43NjA5MUM1Ljc0NDg1IDcuNDM3NSA1LjE0NDMyIDcuMjUgNC41IDcuMjVDMi43MDUwNyA3LjI1IDEuMjUgOC43MDUwNyAxLjI1IDEwLjVDMS4yNSAxMi4yOTQ5IDIuNzA1MDcgMTMuNzUgNC41IDEzLjc1QzYuMjk0OTMgMTMuNzUgNy43NSAxMi4yOTQ5IDcuNzUgMTAuNVY1LjAwNDVDOC40NDg1MiA1LjUwOTEzIDkuMjc5NTUgNS43NSAxMCA1Ljc1QzEwLjQxNDIgNS43NSAxMC43NSA1LjQxNDIxIDEwLjc1IDVDMTAuNzUgNC41ODU3OSAxMC40MTQyIDQuMjUgMTAgNC4yNUM5LjU0NTY1IDQuMjUgOC45NjYzIDQuMDczODkgOC41MTE1OSAzLjY5ODM3QzguMDc4NCAzLjM0MDYxIDcuNzUgMi43OTc4NSA3Ljc1IDJaIiBmaWxsPSIjZmZmZmZmIi8+IDwvZz4KDTwvc3ZnPg==`;
function App() {
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
    const { user, setUser, login, register, logout, error: authError, setError: setAuthError } = useAuth();
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: () => { }, type: 'danger' });
    const headerRef = useRef(null);
    const audioRef = useRef(null);
    const karaokeContainerRef = useRef(null);
    const recentSongsRef = useRef(null);
    const targetScrollRef = useRef(0);
    const currentScrollRef = useRef(0);
    const isScrollingRef = useRef(false);
    const [scrollingTick, setScrollingTick] = useState(0);

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

    // Global 401 Interceptor
    useEffect(() => {
        const { fetch: originalFetch } = window;
        window.fetch = async (...args) => {
            const response = await originalFetch(...args);
            if (response.status === 401) {
                // If unauthorized, show login modal and ensure user state is cleared
                setShowLoginModal(true);
                setUser(null);
            }
            return response;
        };
        return () => {
            window.fetch = originalFetch;
        };
    }, [setUser]);

    // ... existing refs and effects ...





    // Load Recent on Mount
    useEffect(() => {
        try {
            const storedRecent = localStorage.getItem('recent_songs');
            if (storedRecent) setRecentSongs(JSON.parse(storedRecent));

            const storedCache = localStorage.getItem('song_cache');
            if (storedCache) setSongCache(JSON.parse(storedCache));

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
                    const res = await fetch(`${API_URL}/api/suggestions?q=${encodeURIComponent(query)}`, { credentials: 'include' });
                    const data = await res.json();
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

    const performSearch = async (searchQuery, limit, skip = 0, isAppending = false) => {
        if (!isAppending) {
            setIsSearching(true);
            setSearchResults([]);
            setShowSearchDropdown(false);
        } else {
            setIsLoadingMore(true);
        }

        try {
            const res = await fetch(`${API_URL}/api/search?q=${encodeURIComponent(searchQuery)}&limit=${limit}&skip=${skip}`, { credentials: 'include' });
            const data = await res.json();
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

        // CHECK FRONTEND CACHE
        if (songCache[videoId]) {
            const cached = songCache[videoId];
            console.log("[FRONTEND CACHE HIT]", videoId);
            setLyricsData(cached.lyricsData);
            setCurrentSong(cached.currentSong);
            setStatus("Loaded from cache.");

            // Move to top of recent
            addToRecent({
                videoId,
                title: cached.currentSong.title,
                artist: cached.currentSong.artist,
                thumbnail: cached.currentSong.thumbnail,
                hasLyrics: true
            });
            finalizeTransition();
            return;
        }

        setStatus("doing our magic...");
        setKaraokeMode(false);
        setIsProcessing(true);
        setSearchResults([]);

        try {
            const res = await fetch(`${API_URL}/api/process-yt`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ videoId }),
                credentials: 'include'
            });

            if (res.status === 401) {
                setShowLoginModal(true);
                return;
            }

            const result = await res.json();
            if (!res.ok) throw new Error(result.error);

            const parsed = parseLRC(result.data.lrc);
            setLyricsData(parsed);

            setCurrentSong({
                title: result.data.title || "Unknown Song",
                artist: result.data.artist || "Unknown Artist",
                thumbnail: thumbnail || "https://music.youtube.com/img/on_platform_logo_dark.svg",
                videoId: videoId,
                instrumentalUrl: result.data.instrumentalUrl.startsWith('http')
                    ? result.data.instrumentalUrl
                    : `${API_URL}${result.data.instrumentalUrl}`
            });

            addToRecent({
                videoId,
                title: result.data.title || "Unknown",
                artist: result.data.artist || "Unknown",
                thumbnail: thumbnail || "https://music.youtube.com/img/on_platform_logo_dark.svg",
                hasLyrics: true // Since it successfully processed
            });

            // Transition is already started in processSong for new fetches

            // UPDATE FRONTEND CACHE (Limit 100)
            setSongCache(prev => {
                const newCache = { ...prev };
                newCache[videoId] = {
                    lyricsData: parsed,
                    currentSong: {
                        title: result.data.title || "Unknown Song",
                        artist: result.data.artist || "Unknown Artist",
                        thumbnail: thumbnail || "https://music.youtube.com/img/on_platform_logo_dark.svg",
                        videoId: videoId,
                        instrumentalUrl: result.data.instrumentalUrl.startsWith('http')
                            ? result.data.instrumentalUrl
                            : `${API_URL}${result.data.instrumentalUrl}`
                    },
                    timestamp: Date.now()
                };

                // Evict oldest if > 100
                const keys = Object.keys(newCache);
                if (keys.length > 100) {
                    const sorted = keys.sort((a, b) => newCache[a].timestamp - newCache[b].timestamp);
                    delete newCache[sorted[0]];
                }

                localStorage.setItem('song_cache', JSON.stringify(newCache));
                return newCache;
            });

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
        return () => {
            document.removeEventListener('fullscreenchange', handleFsChange);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [karaokeMode, showSearchDropdown]);

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

    return (
        <div className={`z-10 relative transition-all duration-500 ${karaokeMode ? 'w-full min-h-screen' : 'w-full max-w-[900px] p-4 sm:p-8'}`}>
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

            {/* AUTH HEADER */}
            {!karaokeMode && !isTransitioning && (
                <div className="fixed top-2 right-2 sm:top-4 sm:right-4 z-[60] animate-in fade-in duration-700">
                    {user ? (
                        <div className="flex items-center gap-2 sm:gap-3 bg-black/40 backdrop-blur-xl p-1.5 sm:p-2 pl-3 sm:pl-4 rounded-full border border-white/10 hover:border-primary/50 transition-colors shadow-lg">
                            <span className="text-xs sm:text-sm font-medium text-white">{user.displayName || "User"}</span>
                            {user.profilePicture ? (
                                <img src={user.profilePicture} alt="Profile" className="w-6 h-6 sm:w-8 sm:h-8 rounded-full border border-white/20" />
                            ) : (
                                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
                                    <User className="text-primary w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                </div>
                            )}
                            <button
                                onClick={() => setConfirmModal({
                                    isOpen: true,
                                    title: 'Sign Out?',
                                    message: 'Are you sure you want to sign out of your account?',
                                    type: 'danger',
                                    confirmText: 'Sign Out',
                                    onConfirm: logout
                                })}
                                className="p-1.5 sm:p-2 hover:bg-white/10 rounded-full text-text-muted hover:text-red-400 transition-colors"
                            >
                                <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setShowLoginModal(true)}
                            className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-full font-bold text-sm hover:bg-slate-200 transition-colors shadow-lg hover:shadow-cyan-500/20"
                        >
                            <User size={16} />
                            Sign In
                        </button>
                    )}
                </div>
            )}

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
                <div className={`transition-all duration-1000 ${showSearchDropdown ? 'z-[60]' : 'z-20'} relative animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150`}>
                    <div className={`bg-card-bg/50 backdrop-blur-xl p-4 sm:p-8 rounded-[2rem] border border-white/10 shadow-2xl relative group hover:border-primary/30 transition-all ${isTransitioning ? 'pointer-events-none' : ''}`}>
                        {/* Search Input */}
                        <div className={`relative z-10 transition-all duration-1000 ${isTransitioning ? 'blur-2xl opacity-0 scale-95' : ''}`}>
                            <div className="relative flex items-center">
                                <Search className="absolute left-4 sm:left-6 text-text-muted w-5 h-5 sm:w-6 sm:h-6 group-focus-within:text-primary transition-colors" />
                                <input
                                    type="text"
                                    className="w-full bg-black/40 border border-white/5 text-white pl-12 sm:pl-16 pr-16 sm:pr-20 py-4 sm:py-5 rounded-2xl text-base sm:text-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent transition-all placeholder:text-text-muted/50 select-text"
                                    placeholder="Paste YouTube link or search song..."
                                    value={query}
                                    onFocus={() => setShowSearchDropdown(true)}
                                    onChange={(e) => setQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && searchMusic()}
                                />

                                {/* SEARCH DROPDOWN */}
                                {showSearchDropdown && (query || searchHistory.length > 0) && (
                                    <div className="absolute top-[calc(100%+0.5rem)] left-0 w-full bg-card-bg/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
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

                                {showSearchDropdown && (
                                    <div
                                        className="fixed inset-0 z-40"
                                        onClick={() => setShowSearchDropdown(false)}
                                    />
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
                        {recentSongs.map((song, i) => (
                            <div
                                key={`${song.videoId}-${i}`}
                                onClick={(e) => processSong(song, song.thumbnail, e)}
                                className={`
                                    inline-flex p-3 pr-6 rounded-full items-center gap-3 cursor-pointer transition-[transform,opacity,border-color,background-color] duration-700 shrink-0
                                    ${isTransitioning ? 'blur-2xl opacity-0 grayscale scale-50 pointer-events-none' : 'bg-card-bg/50 border border-white/5 hover:border-white/20 hover:bg-white/10 active:scale-95 group'}
                                `}
                            >
                                <img
                                    src={song.thumbnail}
                                    alt={song.title}
                                    className="w-10 h-10 rounded-full object-cover border border-white/10"
                                    onError={(e) => { e.target.src = DEFAULT_THUMBNAIL; }}
                                />
                                <div className="flex flex-col">
                                    <span className="text-sm font-medium text-white/80 group-hover:text-white max-w-[150px] truncate">{song.title}</span>
                                    {song.artist && <span className="text-[10px] text-white/50 group-hover:text-white/70 max-w-[150px] truncate">{song.artist}</span>}
                                    {song.hasLyrics && <span className="text-[9px] text-green-400 font-bold uppercase tracking-tighter mt-0.5">Lyrics</span>}
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeFromRecent(song.videoId);
                                    }}
                                    className="ml-2 p-1.5 rounded-full hover:bg-white/20 text-text-muted hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* KARAOKE PLAYER VIEW */}
            {karaokeMode && currentSong && (
                <div
                    ref={karaokeContainerRef}
                    className={`
                        animate-in fade-in duration-500
                        bg-black overflow-hidden fixed inset-0 z-50 flex flex-col items-center justify-center
                    `}
                    onClick={() => setShowControls(prev => !prev)}
                    onDoubleClick={toggleFullscreen}
                >
                    <div className={`
                         relative bg-black overflow-hidden flex-1 w-full h-full flex flex-col items-center justify-center transition-[margin,opacity] duration-300
                         py-8
                         ${showControls ? 'mb-4' : 'mb-0'}
                     `}>
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
                            className={`text-center w-full z-10 relative overflow-hidden transition-all duration-300 ${showControls ? 'blur-sm opacity-50 scale-95' : 'blur-0 opacity-100 scale-100'}`}
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

                    {/* Controls Container - Transition opacity/height */}
                    <div
                        className={`w-full transition-all duration-300 px-4 sm:px-20 py-3 grid grid-cols-[1fr,auto] gap-x-0 items-center ${(!isFullscreen || showControls) ? 'max-h-32 opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}
                        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking controls
                    >
                        <audio
                            ref={audioRef}
                            src={currentSong.instrumentalUrl}
                            crossOrigin="anonymous"
                            controls
                            controlsList="nodownload noplaybackrate"
                            autoPlay
                            className="w-full h-10 rounded-xl invert hue-rotate-180 brightness-150 custom-audio-controls"
                        />
                        <button
                            onClick={toggleFullscreen}
                            className="h-10 flex items-center pr-6 text-white/50 hover:text-white transform active:scale-90 transition-all cursor-pointer"
                            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                        >
                            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                        </button>
                        <div className="mt-1 text-text-muted text-[10px] uppercase tracking-widest font-bold px-2 col-span-2 opacity-50">
                            Mode: <span className="text-accent">Instrumental</span>
                        </div>
                    </div>

                    {/* Back Button */}
                    {!isFullscreen && (
                        <button
                            className="absolute top-4 right-4 text-text-muted hover:text-white"
                            onClick={(e) => { e.stopPropagation(); setKaraokeMode(false); }}
                        >
                            ✕
                        </button>
                    )}
                </div>
            )}
            {/* AUTH MODAL */}
            <AuthModal
                isOpen={showLoginModal}
                onClose={() => setShowLoginModal(false)}
                onAuthSuccess={() => setShowLoginModal(false)}
                login={login}
                register={register}
                error={authError}
                setError={setAuthError}
            />
            {/* CONFIRMATION MODAL */}
            <ConfirmationModal
                {...confirmModal}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
            />
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
