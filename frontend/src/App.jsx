import React, { useState, useEffect, useRef } from 'react';
import { Search, Music, Mic2, Maximize2, Minimize2, Play, Pause, X } from 'lucide-react';
import AuroraBackground from './components/AuroraBackground';

const API_URL = "http://localhost:3001";

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

    const audioRef = useRef(null);
    const karaokeContainerRef = useRef(null);

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
    }, [lyricsData, activeLineIndex]);

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

        setIsSearching(true);
        setSearchResults([]);
        setShowSearchDropdown(false);
        try {
            const res = await fetch(`${API_URL}/api/search?q=${encodeURIComponent(query)}`);
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            // Find local matches in cache
            const localMatches = Object.values(songCache)
                .filter(s =>
                    s.currentSong.title.toLowerCase().includes(query.toLowerCase()) ||
                    s.currentSong.artist.toLowerCase().includes(query.toLowerCase())
                )
                .map(s => ({
                    videoId: s.currentSong.videoId,
                    title: s.currentSong.title,
                    artists: s.currentSong.artist,
                    thumbnail: s.currentSong.thumbnail,
                    hasLyrics: true,
                    isCached: true // Extra flag for highlighting
                }));

            // Merge and remove duplicates (prefer local)
            const videoIds = new Set(localMatches.map(m => m.videoId));
            const merged = [
                ...localMatches,
                ...data.filter(item => !videoIds.has(item.videoId))
            ];

            setSearchResults(merged);
        } catch (e) {
            setStatus("Error: " + e.message);
        } finally {
            setIsSearching(false);
        }
    };

    const processSong = async (videoIdInput, thumbnail = null) => {
        // Handle variations (old history or direct pass)
        const videoId = (typeof videoIdInput === 'string' ? videoIdInput : (videoIdInput?.videoId || videoIdInput?.id));

        if (!videoId) {
            setStatus("Error: Invalid Video ID");
            return;
        }

        // CHECK FRONTEND CACHE
        if (songCache[videoId]) {
            const cached = songCache[videoId];
            console.log("[FRONTEND CACHE HIT]", videoId);
            setLyricsData(cached.lyricsData);
            setCurrentSong(cached.currentSong);
            setKaraokeMode(true);
            setStatus("Loaded from cache.");

            // Move to top of recent
            addToRecent({
                videoId,
                title: cached.currentSong.title,
                artist: cached.currentSong.artist,
                thumbnail: cached.currentSong.thumbnail,
                hasLyrics: true
            });
            return;
        }

        setStatus("doing our magic...");
        setKaraokeMode(false);
        setSearchResults([]);

        try {
            const res = await fetch(`${API_URL}/api/process-yt`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ videoId })
            });

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

            setKaraokeMode(true);
            setStatus("Done! Enjoy.");

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

        } catch (e) {
            setStatus("Error: " + e.message);
        }
    };

    const addToRecent = (song) => {
        const newRecent = [song, ...recentSongs.filter(s => s.videoId !== song.videoId)].slice(0, 20);
        setRecentSongs(newRecent);
        localStorage.setItem('recent_songs', JSON.stringify(newRecent));
    };

    const removeFromRecent = (videoId) => {
        const newRecent = recentSongs.filter(s => s.videoId !== videoId);
        setRecentSongs(newRecent);
        localStorage.setItem('recent_songs', JSON.stringify(newRecent));
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

    // Monitor fullscreen changes (e.g. ESC key)
    useEffect(() => {
        const handleFsChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFsChange);
        return () => document.removeEventListener('fullscreenchange', handleFsChange);
    }, []);

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

    // Auto-hide controls after 2s of inactivity
    useEffect(() => {
        if (!showControls) return;
        const timer = setTimeout(() => {
            setShowControls(false);
        }, 2000);
        return () => clearTimeout(timer);
    }, [showControls]);

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
        <div className={`z-10 relative transition-all duration-500 ${karaokeMode ? 'w-full min-h-screen' : 'w-full max-w-[900px] p-8'}`}>
            {/* HEADER */}
            {!karaokeMode && (
                <div className="text-center mb-12 animate-in fade-in duration-500">
                    <h1 className="text-6xl font-bold mb-4 tracking-tight drop-shadow-lg bg-clip-text text-transparent bg-gradient-to-r from-primary via-accent to-primary animate-pulse">
                        KraoQ
                    </h1>
                    <p className="text-xl text-text-muted font-light tracking-wide">
                        Your favorite songs with a <span className="text-white font-medium">Professional Karaoke Experience</span>
                    </p>
                </div>
            )}

            {/* SEARCH SECTION */}
            {!karaokeMode && (
                <div className={`transition-all duration-300 ${showSearchDropdown ? 'z-[60]' : 'z-20'} relative animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150`}>
                    <div className="bg-card-bg/50 backdrop-blur-xl p-8 rounded-[2rem] border border-white/10 shadow-2xl relative group hover:border-primary/30 transition-all">
                        {/* Search Input */}
                        <div className="relative z-10">
                            <div className="relative flex items-center">
                                <Search className="absolute left-6 text-text-muted w-6 h-6 group-focus-within:text-primary transition-colors" />
                                <input
                                    type="text"
                                    className="w-full bg-black/40 border border-white/5 text-white pl-16 pr-6 py-5 rounded-2xl text-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent transition-all placeholder:text-text-muted/50"
                                    placeholder="Paste YouTube link or search song..."
                                    value={query}
                                    onFocus={() => setShowSearchDropdown(true)}
                                    onChange={(e) => setQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && searchMusic()}
                                />

                                {/* SEARCH DROPDOWN */}
                                {showSearchDropdown && (query || searchHistory.length > 0) && (
                                    <div className="absolute top-[calc(100%+0.5rem)] left-0 w-full bg-card-bg/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                        {/* Cache Matches Section */}
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
                                                                className="flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl cursor-pointer group"
                                                                onClick={() => {
                                                                    processSong(s.currentSong.videoId, s.currentSong.thumbnail);
                                                                    setShowSearchDropdown(false);
                                                                }}
                                                            >
                                                                <img src={s.currentSong.thumbnail} className="w-8 h-8 rounded object-cover" />
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

                                        {/* Recent Searches */}
                                        {searchHistory.length > 0 && (
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
                                    className="absolute right-3 bg-primary hover:bg-primary-hover text-white px-8 py-3 rounded-xl font-medium transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
                                >
                                    {isSearching ? <span className="loader scale-50"></span> : "Go"}
                                </button>
                            </div>
                        </div>

                        {/* Status Message */}
                        {status && (
                            <div className="mt-6 text-center animate-pulse">
                                <p className="text-accent font-medium bg-accent/10 inline-block px-4 py-1 rounded-full text-sm border border-accent/20">
                                    {status}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* SEARCH RESULTS */}
                    {searchResults.length > 0 && (
                        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {searchResults.map((video) => (
                                <div
                                    key={video.videoId}
                                    onClick={() => processSong(video.videoId, video.thumbnail)}
                                    className={`bg-card-bg border p-4 rounded-2xl flex items-center gap-4 cursor-pointer hover:bg-white/5 hover:scale-[1.02] hover:border-primary/30 transition-all group ${video.isCached ? 'border-primary/40 shadow-[0_0_15px_rgba(99,102,241,0.1)]' : 'border-white/5'}`}
                                >
                                    <img src={video.thumbnail} alt={video.title} className="w-24 h-24 object-cover rounded-xl shadow-lg group-hover:shadow-primary/20 transition-all" />
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
                                    <div className="bg-white/10 p-3 rounded-full group-hover:bg-primary group-hover:text-white transition-all">
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
                <div className="mt-16 w-full overflow-hidden relative animate-in fade-in duration-700 delay-300">
                    <h3 className="text-text-muted text-sm font-bold uppercase tracking-widest mb-6 px-2">Recently Sung</h3>

                    {/* Shadow Gradients for Fade effect */}
                    <div className="absolute left-0 top-12 bottom-0 w-20 bg-gradient-to-r from-bg to-transparent z-10 pointer-events-none" />
                    <div className="absolute right-0 top-12 bottom-0 w-20 bg-gradient-to-l from-bg to-transparent z-10 pointer-events-none" />

                    <div className="flex overflow-x-auto gap-4 py-4 px-2 stylized-scrollbar scroll-smooth">
                        {recentSongs.map((song, i) => (
                            <div
                                key={`${song.videoId}-${i}`}
                                onClick={() => processSong(song.videoId, song.thumbnail)}
                                className="inline-flex bg-card-bg/50 border border-white/5 hover:border-white/20 p-3 pr-6 rounded-full items-center gap-3 cursor-pointer hover:bg-white/10 transition-all active:scale-95 group shrink-0"
                            >
                                <img src={song.thumbnail} alt={song.title} className="w-10 h-10 rounded-full object-cover border border-white/10" />
                                <div className="flex flex-col">
                                    <span className="text-sm font-medium text-white/80 group-hover:text-white max-w-[150px] truncate">{song.title}</span>
                                    {song.hasLyrics && <span className="text-[9px] text-green-400 font-bold uppercase tracking-tighter">Lyrics</span>}
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeFromRecent(song.videoId);
                                    }}
                                    className="ml-2 p-1.5 rounded-full hover:bg-white/20 text-text-muted hover:text-white opacity-0 group-hover:opacity-100 transition-all"
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
                         relative bg-black overflow-hidden flex-1 w-full h-full flex flex-col items-center justify-center transition-all duration-300
                         px-12 py-8
                         ${showControls ? 'mb-4' : 'mb-0'} 
                     `}>
                        <AuroraBackground audioRef={audioRef} />
                        {/* Play/Pause Overlay */}
                        <div className={`
                            absolute inset-0 z-20 flex items-center justify-center transition-all duration-300
                            ${showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
                        `}>
                            <div
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (audioRef.current.paused) audioRef.current.play();
                                    else audioRef.current.pause();
                                    // Auto-hide after 200ms as requested
                                    setTimeout(() => setShowControls(false), 200);
                                }}
                                className="w-24 h-24 flex items-center justify-center bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-white shadow-2xl transform active:scale-90 transition-all cursor-pointer hover:bg-white/20"
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
                                className="absolute left-0 w-full transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)]"
                                style={{
                                    transform: `translateY(${- (activeLineIndex + 1) * 150}px)`,
                                    top: '50%',
                                    marginTop: '-75px'
                                }}
                            >
                                {/* Initial / Intro Line */}
                                <div className={`flex items-center justify-center transition-all duration-500 h-[150px] ${activeLineIndex === -1 ? 'scale-110 opacity-100' : 'scale-90 opacity-40'}`}>
                                    <span className={`${activeLineIndex === -1 ? 'bg-clip-text text-transparent bg-gradient-to-r from-red-500 via-yellow-400 via-green-400 via-cyan-400 via-blue-500 to-purple-500 drop-shadow-[0_0_20px_rgba(99,102,241,0.4)]' : 'text-white'} font-bold text-6xl leading-tight`}>
                                        {activeLineIndex === -1 ? displayCurrText : ""}
                                    </span>
                                </div>

                                {lyricsData.map((line, idx) => (
                                    <div
                                        key={idx}
                                        className={`flex items-center justify-center transition-all duration-500 h-[150px] px-6 ${idx === activeLineIndex ? 'scale-105 opacity-100' : 'scale-95 opacity-30'}`}
                                    >
                                        <span
                                            className={`font-black transition-all text-center leading-[1.1] ${idx === activeLineIndex ? 'bg-clip-text text-transparent bg-gradient-to-r from-red-500 via-yellow-400 via-green-400 via-cyan-400 via-blue-500 to-purple-500' : 'text-white'}`}
                                            style={{
                                                fontSize: 'clamp(2rem, 8vw, 4rem)',
                                                textShadow: idx === activeLineIndex ? '0 0 30px rgba(99,102,241,0.5)' : 'none',
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
                        className={`w-full transition-all duration-300 px-8 py-3 grid grid-cols-[1fr,auto] gap-x-0 items-center ${(!isFullscreen || showControls) ? 'max-h-32 opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}
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
                            ✕ Close
                        </button>
                    )}
                </div>
            )}
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
