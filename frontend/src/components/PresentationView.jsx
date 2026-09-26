import React, { useState, useEffect, useRef } from 'react';
import KaraokePlayer from './KaraokePlayer';
import { Play, Music2, Mic2, Music, Check, Settings, Fullscreen, Minimize2, Trash2, Search, Link2, ExternalLink } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { listen, emit } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

const isTauri = !!window.__TAURI_INTERNALS__;

const appInvoke = async (cmd, args = {}) => {
    if (!isTauri) return null;
    try { return await invoke(cmd, args); } catch (e) {
        console.warn(`[Tauri] Invoke ${cmd} failed:`, e);
        return null;
    }
};

const appListen = async (event, callback) => {
    if (!isTauri) return () => { };
    try { return await listen(event, callback); } catch (e) {
        console.warn(`[Tauri] Listen ${event} failed:`, e);
        return () => { };
    }
};

const isMobile = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

const PresentationView = () => {
    const [currentSong, setCurrentSong] = useState(null);
    const [lyricsData, setLyricsData] = useState([]);
    const [activeLineIndex, setActiveLineIndex] = useState(-1);
    const [isPlaying, setIsPlaying] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [isWaitingForNextQueue, setIsWaitingForNextQueue] = useState(false);
    const [nextSingerName, setNextSingerName] = useState("");
    const [nextSingerCount, setNextSingerCount] = useState(null);
    const [appConfig, setAppConfig] = useState({ prepareIndicatorMode: 'all' });
    const [audioMode, setAudioMode] = useState('instrumental');
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [needsUserStart, setNeedsUserStart] = useState(true);
    const [partyUrl, setPartyUrl] = useState("");

    const audioRef = useRef(null);
    const karaokeContainerRef = useRef(null);
    const wsRef = useRef(null);
    const syncStateRef = useRef({ currentSong, isPlaying, lyricsData, audioMode });

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable full-screen mode: ${err.message}`);
            });
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    // Send sync updates as the sync master
    const broadcastSync = (isFull = true) => {
        const cs = syncStateRef.current.currentSong;
        const ip = syncStateRef.current.isPlaying;
        const ld = syncStateRef.current.lyricsData;
        const am = syncStateRef.current.audioMode;

        if (!cs) return;

        const payload = {
            currentSong: isFull ? cs : { videoId: cs?.videoId, title: cs?.title, artist: cs?.artist, thumbnail: cs?.thumbnail },
            isPlaying: ip,
            isKaraokeMode: false,
            currentTime: (audioRef.current && isFinite(audioRef.current.currentTime)) ? audioRef.current.currentTime : 0,
            duration: (audioRef.current && isFinite(audioRef.current.duration)) ? audioRef.current.duration : 0,
            lyricsData: isFull ? ld : undefined,
            audioMode: am,
            singer: cs?.singer || "Presentation"
        };

        const msgState = {
            type: 'sync_state',
            payload: payload
        };

        const msgParty = {
            type: 'party_sync',
            payload: payload
        };

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(msgState));
            wsRef.current.send(JSON.stringify(msgParty));
        }

        // Also emit locally for the Tauri Host app to monitor/bridge
        if (isTauri) {
            emit('presentation_sync_state', { payload });
        }
    };

    // Handler for "Tap to Start" — starts local audio and broadcasts sync
    const handleStartPlayback = async () => {
        if (!audioRef.current || !currentSong) return;

        const src = audioMode === 'vocals' && currentSong.vocalsUrl
            ? currentSong.vocalsUrl
            : currentSong.instrumentalUrl;

        if (!src || src.length < 5) return;

        try {
            audioRef.current.src = src;
            await audioRef.current.play();
            setIsPlaying(true);
            setNeedsUserStart(false);
            broadcastSync(true);
            console.log("[Presentation] Playback started, broadcasting sync");
        } catch (err) {
            console.error("[Presentation] Start playback failed:", err);
        }
    };

    // WebSocket Synchronization Logic
    const currentSongIdRef = useRef(null);
    const resolvedUrlsRef = useRef({ instrumental: '', vocals: '' });

    useEffect(() => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.hostname;
        const port = 1425;
        const url = `${protocol}//${host}:${port}/api/ws`;

        const resolveUrl = (path) => {
            if (!path) return "";
            if (path.startsWith('http') && !path.includes('asset.localhost') && !path.includes('localhost:1425')) return path;
            const decodedPath = decodeURIComponent(path);
            const filename = decodedPath.split(/[\\/]/).pop();
            const isLibrary = !decodedPath.includes('uploads') && !decodedPath.includes('separate');
            const folder = isLibrary ? 'library' : (decodedPath.includes('separate') ? 'separate' : 'uploads');
            return `${window.location.protocol}//${window.location.hostname}:1425/${folder}/${encodeURIComponent(filename)}`;
        };

        let ws;
        const connect = () => {
            ws = new WebSocket(url);
            wsRef.current = ws;

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);

                    if (data.type === 'sync_state' || data.type === 'party_sync') {
                        // Presentation screen is the MASTER. It only broadcasts, it NEVER listens to sync updates
                        return;
                    }

                    if (data.type === 'sync_state') {
                        const payload = data.payload;

                        // 1. Prevent redundant re-renders from partyUrl
                        if (payload.partyUrl && payload.partyUrl !== partyUrl) {
                            setPartyUrl(payload.partyUrl);
                        }

                        if (!payload.currentSong) {
                            // DEFENSIVE: If we are CURRENTLY playing a song, ignore a "null" sync from the relay.
                            if (isPlaying && currentSong) {
                                console.log("[Presentation] Ignoring null sync while playing (protected master mode).");
                                return;
                            }

                            if (currentSongIdRef.current !== null) {
                                console.log("[Presentation] Song cleared via sync.");
                                currentSongIdRef.current = null;
                                resolvedUrlsRef.current = { instrumental: '', vocals: '' };
                                setCurrentSong(null);
                                setLyricsData([]);
                                setIsPlaying(false);
                                if (audioRef.current) audioRef.current.src = "";
                            }
                            return;
                        }

                        const incomingId = payload.currentSong.videoId || payload.currentSong.id;
                        const hasUrls = !!payload.currentSong.instrumentalUrl;

                        // Check against both the ref and the current state to be super safe
                        const isCurrentlyActive = (incomingId === currentSongIdRef.current) || (currentSong && (currentSong.videoId === incomingId || currentSong.id === incomingId));

                        console.log(`[Presentation] Sync received for ${incomingId}. isCurrentlyActive: ${isCurrentlyActive}`);

                        // NEW SONG arrived — prepare it but DON'T autoplay
                        if (!isCurrentlyActive && hasUrls) {
                            console.log("[Presentation] New track detected. Switching source...", incomingId);

                            resolvedUrlsRef.current = {
                                instrumental: resolveUrl(payload.currentSong.instrumentalUrl),
                                vocals: resolveUrl(payload.currentSong.vocalsUrl)
                            };

                            currentSongIdRef.current = incomingId;

                            const processedSong = {
                                ...payload.currentSong,
                                instrumentalUrl: resolvedUrlsRef.current.instrumental,
                                vocalsUrl: resolvedUrlsRef.current.vocals,
                            };

                            // Reset visuals immediately
                            setCurrentSong(processedSong);
                            setIsPlaying(false);
                            setNeedsUserStart(true); // Force tap-to-start overlay

                            // Prepare audio
                            if (audioRef.current) {
                                audioRef.current.pause();
                                audioRef.current.src = "";
                            }

                            if (payload.lyricsData) {
                                setLyricsData(payload.lyricsData);
                            }
                            if (payload.audioMode) {
                                setAudioMode(payload.audioMode);
                            }
                            return;
                        }

                        // EXISTING SONG — presentation is the sync master, ignore incoming state to avoid flicker.
                        return;
                    } else if (data.type === 'next_singer_countdown') {
                        setNextSingerName(data.payload.name);
                        setNextSingerCount(data.payload.count);
                    } else if (data.type === 'waiting_for_queue') {
                        setIsWaitingForNextQueue(data.payload);
                    }
                } catch (e) {
                    console.error("Presentation Sync Error:", e);
                }
            };

            ws.onclose = () => {
                setTimeout(connect, 2000);
            };
        };

        connect();

        // Listen for internal sync requests (e.g. from Host app when a client joins)
        const unlistenSync = appListen('request_presentation_sync', () => {
            console.log("[Presentation] Internal sync request received. Broadcasting...");
            broadcastSync(true);
        });

        return () => {
            if (ws) ws.close();
            unlistenSync.then(f => f());
        };
    }, []);

    // Keep syncStateRef up to date
    useEffect(() => {
        syncStateRef.current = { currentSong, isPlaying, lyricsData, audioMode };
    }, [currentSong, isPlaying, lyricsData, audioMode]);

    // Periodic sync broadcast (every 2 seconds)
    useEffect(() => {
        if (!currentSong) return;

        const interval = setInterval(() => broadcastSync(false), 2000);
        return () => clearInterval(interval);
    }, [currentSong?.videoId]);

    // Broadcast full sync on state changes
    useEffect(() => {
        if (!currentSong || needsUserStart) return;
        broadcastSync(true);
    }, [currentSong?.videoId, isPlaying, audioMode, lyricsData]);

    // Lyrics Sync Loop (Local for smooth UI)
    useEffect(() => {
        if (!audioRef.current) return;

        let rafId;
        const updateLyrics = () => {
            if (audioRef.current && lyricsData.length > 0) {
                const currentTime = audioRef.current.currentTime;
                let index = -1;
                for (let i = 0; i < lyricsData.length; i++) {
                    if (currentTime >= lyricsData[i].time) {
                        index = i;
                    } else {
                        break;
                    }
                }
                setActiveLineIndex(index);
            }
            rafId = requestAnimationFrame(updateLyrics);
        };
        rafId = requestAnimationFrame(updateLyrics);
        return () => cancelAnimationFrame(rafId);
    }, [lyricsData]);

    return (
        <div className="relative w-full h-full">
            {/* PARTY QR CODE */}
            {partyUrl && (
                <div className="absolute top-4 left-4 z-[9999] bg-slate-900/90 backdrop-blur-xl p-3 rounded-3xl border border-white/10 shadow-2xl flex flex-col items-center gap-2 max-w-[160px]">
                    <div className="p-2 bg-white rounded-2xl">
                        <QRCodeSVG value={partyUrl} size={120} bgColor="#ffffff" fgColor="#000000" level="H" />
                    </div>
                    <p className="text-[10px] font-bold text-white/90 text-center tracking-tight">Scan to Add Songs</p>
                </div>
            )}

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
                isPresentationView={true}
                karaokeContainerRef={karaokeContainerRef}
                audioRef={audioRef}
                toggleFullscreen={toggleFullscreen}
                isFullscreen={isFullscreen}
                setKaraokeMode={() => { }}
                appConfig={appConfig}
                isPartyMode={true}
                audioMode={audioMode}
                setAudioMode={setAudioMode}
                isAutoPaused={false}
                isMobile={isMobile}
            />

            {/* TAP TO START OVERLAY — shown when a new song arrives */}
            {needsUserStart && currentSong && (
                <div
                    className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm cursor-pointer"
                    onClick={handleStartPlayback}
                >
                    <div className="p-10 rounded-3xl bg-primary/20 border border-primary/30 backdrop-blur-xl flex flex-col items-center gap-5 animate-bounce">
                        <div className="w-24 h-24 rounded-full bg-primary flex items-center justify-center text-white shadow-[0_0_40px_rgba(99,102,241,0.8)]">
                            <Play size={48} fill="currentColor" />
                        </div>
                        <p className="text-white font-black text-2xl tracking-tight">Tap to Start</p>
                        <p className="text-white/60 text-sm max-w-[300px] text-center">{currentSong.title} - {currentSong.artist}</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PresentationView;
