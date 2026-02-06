import React, { useState, useEffect, useRef } from 'react';
import { Search, Music, Mic2, Maximize2, Minimize2, Play, Pause } from 'lucide-react';

const API_URL = "http://localhost:3001";

function App() {
    const [query, setQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [karaokeMode, setKaraokeMode] = useState(false);
    const [currentSong, setCurrentSong] = useState(null);
    const [status, setStatus] = useState("");
    const [lyricsData, setLyricsData] = useState([]);
    const [recentSongs, setRecentSongs] = useState([]);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [activeLineIndex, setActiveLineIndex] = useState(-1);
    const [nextLinesPreview, setNextLinesPreview] = useState("");

    const audioRef = useRef(null);
    const karaokeContainerRef = useRef(null);

    // Load Recent on Mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem('recent_songs');
            if (stored) setRecentSongs(JSON.parse(stored));
        } catch (e) {
            console.error("Failed to load history", e);
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
                if (currentTime >= lyricsData[i].time) newIndex = i;
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
            return;
        }

        setIsSearching(true);
        setSearchResults([]);
        try {
            const res = await fetch(`${API_URL}/api/search?q=${encodeURIComponent(query)}`);
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setSearchResults(data);
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

        setStatus("downloading, fetching lyrics & separating instrumental...");
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

        } catch (e) {
            setStatus("Error: " + e.message);
        }
    };

    const addToRecent = (song) => {
        const newRecent = [song, ...recentSongs.filter(s => s.videoId !== song.videoId)].slice(0, 5);
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

    // Helper Logic for Display
    const [showControls, setShowControls] = useState(false);

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
        <div className="w-full max-w-[900px] p-8 z-10 relative">
            {/* HEADER */}
            <div className={`text-center mb-12 transition-all duration-500 transform ${karaokeMode ? '-translate-y-full opacity-0 absolute' : 'translate-y-0 opacity-100'}`}>
                <h1 className="text-6xl font-bold mb-4 tracking-tight drop-shadow-lg bg-clip-text text-transparent bg-gradient-to-r from-primary via-accent to-primary animate-pulse">
                    KraoQ
                </h1>
                <p className="text-xl text-text-muted font-light tracking-wide">
                    Transform any YouTube song into a <span className="text-white font-medium">Professional Karaoke Experience</span>
                </p>
            </div>

            {/* SEARCH SECTION */}
            <div className={`transition-all duration-500 delay-100 ${karaokeMode ? 'opacity-0 translate-y-10 pointer-events-none absolute' : 'opacity-100 translate-y-0'}`}>
                <div className="bg-card-bg/50 backdrop-blur-xl p-8 rounded-[2rem] border border-white/10 shadow-2xl relative overflow-hidden group hover:border-primary/30 transition-all">
                    {/* Search Input */}
                    <div className="relative z-10">
                        <div className="relative flex items-center">
                            <Search className="absolute left-6 text-text-muted w-6 h-6 group-focus-within:text-primary transition-colors" />
                            <input
                                type="text"
                                className="w-full bg-black/40 border border-white/5 text-white pl-16 pr-6 py-5 rounded-2xl text-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent transition-all placeholder:text-text-muted/50"
                                placeholder="Paste YouTube link or search song..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && searchMusic()}
                            />
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
                                ✨ {status}
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
                                onClick={() => processSong(video.videoId, video.thumbnail)}
                                className="bg-card-bg border border-white/5 p-4 rounded-2xl flex items-center gap-4 cursor-pointer hover:bg-white/5 hover:scale-[1.02] hover:border-primary/30 transition-all group"
                            >
                                <img src={video.thumbnail} alt={video.title} className="w-24 h-24 object-cover rounded-xl shadow-lg group-hover:shadow-primary/20 transition-all" />
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-lg truncate text-white group-hover:text-primary transition-colors">{video.title}</h3>
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm text-text-muted truncate">{video.artists || video.channel}</p>
                                        {video.hasLyrics && (
                                            <span className="bg-green-500/20 text-green-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-green-500/30">
                                                Lyrics
                                            </span>
                                        )}
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

            {/* RECENT SONGS */}
            {!karaokeMode && recentSongs.length > 0 && searchResults.length === 0 && (
                <div className="mt-16">
                    <h3 className="text-text-muted text-sm font-bold uppercase tracking-widest mb-6 px-2">Recently Sung</h3>
                    <div className="flex flex-wrap gap-4">
                        {recentSongs.map((song) => (
                            <div
                                key={song.videoId}
                                onClick={() => processSong(song.videoId, song.thumbnail)}
                                className="bg-card-bg/50 border border-white/5 hover:border-white/20 p-3 pr-6 rounded-full flex items-center gap-3 cursor-pointer hover:bg-white/10 transition-all active:scale-95 group"
                            >
                                <img src={song.thumbnail} alt={song.title} className="w-10 h-10 rounded-full object-cover border border-white/10" />
                                <div className="flex flex-col">
                                    <span className="text-sm font-medium text-white/80 group-hover:text-white max-w-[150px] truncate">{song.title}</span>
                                    {song.hasLyrics && <span className="text-[9px] text-green-400 font-bold uppercase tracking-tighter">Lyrics</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {karaokeMode && currentSong && (
                <div
                    ref={karaokeContainerRef}
                    className={`
                mt-16 bg-card-bg/90 rounded-3xl border border-white/10 shadow-2xl overflow-hidden relative
                ${isFullscreen ? 'fixed inset-0 w-screen h-screen z-50 rounded-none m-0 p-8 flex flex-col justify-center bg-black' : 'p-12'}
            `}
                    onClick={() => isFullscreen && setShowControls(prev => !prev)} // Toggle controls only in FS
                >
                    <div className={`
                 relative bg-black rounded-3xl overflow-hidden flex flex-col items-center justify-center transition-all duration-300
                 ${isFullscreen ? 'flex-1 w-full h-full px-24 py-12' : 'h-[400px] p-8'}
                 before:content-[''] before:absolute before:inset-0 before:bg-[radial-gradient(circle,var(--primary)_0%,transparent_60%)] before:opacity-10 before:animate-pulse
                 ${(!isFullscreen || showControls) ? 'mb-8' : 'mb-0'} 
             `}>
                        <div className={`text-center w-full z-10 flex flex-col justify-evenly h-full transition-all duration-300`}>
                            <div className={`font-bold text-white/30 transition-all ${isFullscreen ? 'text-5xl' : 'text-2xl'}`}>
                                {prevLine ? prevLine.text : ""}
                            </div>
                            <div className={`font-bold text-white transition-all scale-110 drop-shadow-[0_0_20px_rgba(99,102,241,0.8)] ${isFullscreen ? 'text-7xl leading-tight' : 'text-4xl'}`}>
                                {displayCurrText}
                            </div>
                            <div className={`font-bold text-white/60 transition-all ${isFullscreen ? 'text-6xl' : 'text-3xl'}`}>
                                {displayNextText}
                            </div>
                        </div>
                    </div>

                    {/* Controls Container - Transition opacity/height */}
                    <div
                        className={`w-full transition-all duration-300 overflow-hidden ${(!isFullscreen || showControls) ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}
                        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking controls
                    >
                        <audio
                            ref={audioRef}
                            src={currentSong.instrumentalUrl}
                            controls
                            autoPlay
                            className="w-full h-12 rounded-xl invert hue-rotate-180 brightness-150"
                        />
                        <div className="mt-4 flex justify-between items-center px-2">
                            <div className="text-text-muted text-sm">Mode: <span className="text-accent font-bold">Instrumental</span></div>
                            <button
                                onClick={toggleFullscreen}
                                className="flex items-center gap-2 bg-white/10 border border-white/20 text-white px-4 py-2 rounded-lg text-sm hover:bg-white/20 transition-all"
                            >
                                {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                                {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                            </button>
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
