import React, { useEffect, useState, useRef } from 'react';
import { Mic2, Loader2, Play, Pause, Maximize2, Minimize2, X, Music, Download, Check, ArrowRight, Zap, AlertCircle, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AuroraBackground from './AuroraBackground';

// Helper component for word-by-word highlighted lyrics
function LyricLine({ line, isActive, audioRef, displayNextText, isNext, gap, config, isFirst, isPassed, wordRefs }) {
    const containerRef = useRef(null);
    const progressBarRef = useRef(null);

    useEffect(() => {
        if (!isActive && !isNext) return;

        let rafId;
        const tick = () => {
            const currentTime = audioRef.current ? audioRef.current.currentTime : 0;

            const isFutureActive = isActive && line.words && line.words.length > 0 && currentTime < line.words[0].start;

            const showForThisGap = config?.prepareIndicatorMode === 'all' ? gap > 1.0 : gap > 5.0;
            const forceFirst = isFirst && gap > 1.0;

            if ((isNext || isFutureActive) && (showForThisGap || forceFirst)) {
                const start = line.words && line.words.length > 0 ? line.words[0].start : (line.time || 0);
                const timeUntilNext = start - currentTime;
                if (timeUntilNext > 0 && timeUntilNext < gap) {
                    if (containerRef.current) containerRef.current.style.display = 'block';
                    if (progressBarRef.current) {
                        const pct = Math.max(0, Math.min(100, (timeUntilNext / gap) * 100));
                        progressBarRef.current.style.width = `${pct}%`;
                    }
                } else {
                    if (containerRef.current) containerRef.current.style.display = 'none';
                }
            }

            if (isActive && line.words) {
                line.words.forEach((w, i) => {
                    const el = wordRefs.current[`${line.time}-${i}`];
                    if (!el) return;

                    if (currentTime >= w.start && currentTime <= w.end) {
                        // Active word (progressive filling)
                        const duration = w.end - w.start;
                        const elapsed = currentTime - w.start;
                        const progress = Math.max(0, Math.min(100, (elapsed / duration) * 100));

                        el.style.backgroundImage = `linear-gradient(to right, #ffffff ${progress}%, rgba(255, 255, 255, 0.4) ${progress}%)`;
                        el.style.webkitBackgroundClip = 'text';
                        el.style.webkitTextFillColor = 'transparent';
                        el.style.transform = 'scale(1.05)';
                        el.style.textShadow = '0 0 10px rgba(99, 102, 241, 0.4)';
                    } else if (currentTime > w.end) {
                        // Passed word
                        el.style.backgroundImage = 'none';
                        el.style.webkitBackgroundClip = 'unset';
                        el.style.webkitTextFillColor = '#a5b4fc';
                        el.style.color = '#a5b4fc';
                        el.style.transform = 'scale(1.0)';
                        el.style.textShadow = 'none';
                    } else {
                        // Future word
                        el.style.backgroundImage = 'none';
                        el.style.webkitBackgroundClip = 'unset';
                        el.style.webkitTextFillColor = 'rgba(255, 255, 255, 0.4)';
                        el.style.color = 'rgba(255, 255, 255, 0.4)';
                        el.style.transform = 'scale(1.0)';
                        el.style.textShadow = 'none';
                    }
                });
            }

            rafId = requestAnimationFrame(tick);
        };

        rafId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafId);
    }, [isActive, isNext, gap, line.words, config, isFirst, audioRef.current]);

    if (!line.words || line.words.length === 0) {
        return <span>{line.text}</span>;
    }

    return (
        <div className="flex flex-col items-center justify-center">
            {(isNext || isActive) && typeof gap !== 'undefined' && ((config?.prepareIndicatorMode === 'all' ? gap > 1 : gap > 5) || (isFirst && gap > 1)) && (
                <div
                    ref={containerRef}
                    className="w-44 h-1 bg-white/10 rounded-full mb-4 overflow-hidden"
                    style={{ display: 'none' }}
                >
                    <div
                        ref={progressBarRef}
                        className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 rounded-full transition-all duration-100 ease-linear shadow-[0_0_10px_rgba(99,102,241,0.6)]"
                        style={{ width: '100%' }}
                    />
                </div>
            )}
            <span className="flex flex-wrap items-center justify-center">
                {line.words.map((w, i) => (
                    <span
                        key={i}
                        ref={el => wordRefs.current[`${line.time}-${i}`] = el}
                        className="transition-all duration-100 ease-out"
                        style={{
                            margin: '0 5px',
                            display: 'inline-block',
                            color: isPassed ? '#a5b4fc' : 'rgba(255,255,255,0.4)',
                            backgroundImage: !isActive ? 'none' : undefined,
                            webkitBackgroundClip: !isActive ? 'unset' : undefined,
                            webkitTextFillColor: !isActive ? (isPassed ? '#a5b4fc' : 'rgba(255,255,255,0.4)') : undefined,
                            transform: !isActive ? 'scale(1.0)' : undefined,
                            textShadow: !isActive ? 'none' : undefined
                        }}
                    >
                        {w.word}
                    </span>
                ))}
            </span>
        </div>
    );
}

const KaraokePlayer = ({
    currentSong,
    lyricsData = [],
    activeLineIndex = -1,
    isPlaying,
    showControls,
    setShowControls,
    nextSingerName,
    nextSingerCount,
    isWaitingForNextQueue,
    isPresentationView,
    karaokeContainerRef,
    audioRef,
    toggleFullscreen,
    isFullscreen,
    setKaraokeMode,
    appConfig,
    isPartyMode,
    audioMode,
    setAudioMode,
    isAutoPaused,
    isMobile,
    onOpenLyricsSearch,
    headless = false
}) => {
    const wordRefs = useRef({});

    // Aggressive play/pause sync
    useEffect(() => {
        if (!audioRef.current || headless) return;

        const syncPlayback = async () => {
            // Optimization: if we're already in the desired state, don't do anything
            if (isPlaying && !audioRef.current.paused) return;
            if (!isPlaying && audioRef.current.paused) return;

            try {
                if (isPlaying && audioRef.current.paused) {
                    await audioRef.current.play();
                } else if (!isPlaying && !audioRef.current.paused) {
                    audioRef.current.pause();
                }
            } catch (err) {
                console.error("[KaraokePlayer] Playback failed:", err);
                if (isPlaying && audioRef.current.src) {
                }
            }
        };

        syncPlayback();
    }, [isPlaying, currentSong, headless, audioMode]);

    // Helper Logic for Lyrics Display
    const currentLine = activeLineIndex !== -1 ? lyricsData[activeLineIndex] : null;
    const nextLine = activeLineIndex < lyricsData.length - 1 ? lyricsData[activeLineIndex + 1] : null;

    // Countdown Dot Logic
    let displayNextText = nextLine ? nextLine.text : (lyricsData.length > 0 && activeLineIndex === -1 ? lyricsData[0].text : "");
    let displayCurrText = currentLine ? currentLine.text : (activeLineIndex === -1 ? `${currentSong ? currentSong.title + ' - ' + currentSong.artist : 'Loading...'}` : "");

    if (audioRef.current && lyricsData.length > 0) {
        const currentTime = audioRef.current.currentTime;
        // Check Interlude
        if (activeLineIndex !== -1 && activeLineIndex < lyricsData.length - 1) {
            const gap = lyricsData[activeLineIndex + 1].time - lyricsData[activeLineIndex].time;
            const timeUntilNext = lyricsData[activeLineIndex + 1].time - currentTime;
            if (gap > 8 && timeUntilNext > 0 && timeUntilNext < 4) {
                const dots = ". ".repeat(Math.ceil(timeUntilNext));
                displayNextText = dots + displayNextText;
            }
        }
        // Check Intro
        if (activeLineIndex === -1) {
            const firstTime = lyricsData[0].time;
            const timeUntilStart = firstTime - currentTime;
            if (timeUntilStart > 0 && timeUntilStart < 5) {
                displayCurrText = "Get Ready...";
                const dots = ". ".repeat(Math.ceil(timeUntilStart));
                displayNextText = dots + displayNextText;
            }
        }
    }

    if (headless) {
        return (
            <audio
                ref={audioRef}
                src={currentSong ? (audioMode === 'vocals' && currentSong.vocalsUrl ? currentSong.vocalsUrl : currentSong.instrumentalUrl) : ""}
                crossOrigin="anonymous"
                autoPlay={!isAutoPaused}
                muted={true}
                className="hidden"
            />
        );
    }

    return (
        <div
            ref={karaokeContainerRef}
            className="bg-black overflow-hidden fixed inset-0 z-50 flex flex-col items-center justify-center"
            style={{ touchAction: 'none' }}
            onClick={() => setShowControls(prev => !prev)}
        >
            <div
                className="relative bg-black overflow-hidden flex-1 w-full h-full flex flex-col items-center justify-center transition-opacity duration-300"
                style={{ touchAction: 'none' }}
            >
                <AuroraBackground audioRef={audioRef} />

                {(!currentSong && isPresentationView) ? (
                    <div className="flex flex-col items-center text-center px-6 animate-in fade-in zoom-in duration-1000">
                        <div className="relative mb-12">
                            <div className="absolute -inset-12 bg-primary/20 blur-[80px] animate-pulse rounded-full" />
                            <h1 className="text-[120px] font-black tracking-tighter text-white drop-shadow-[0_0_50px_rgba(99,102,241,0.5)] leading-none select-none">
                                KraoQ
                            </h1>
                        </div>
                        <div className="h-[2px] w-32 bg-gradient-to-r from-transparent via-primary/50 to-transparent mb-8" />
                        <h2 className="text-4xl font-black text-white/90 mb-4 tracking-tight text-center">Ready to Sing?</h2>
                        <p className="text-xl text-white/40 font-medium tracking-wide">
                            Queue your first song from your phone!
                        </p>
                    </div>
                ) : (
                    <>
                        {/* NEXT SINGER COUNTDOWN OVERLAY */}
                        {nextSingerCount !== null && (
                            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/95 backdrop-blur-3xl animate-in fade-in duration-300">
                                <p className="text-primary text-sm font-black tracking-[0.2em] uppercase mb-2">Next Singer</p>
                                <h2 className="text-5xl font-black text-white mb-8 drop-shadow-[0_0_15px_rgba(99,102,241,0.5)]">{nextSingerName}</h2>

                                <div className="flex items-center justify-center w-24 h-24 rounded-full border-4 border-white/10 text-4xl font-black text-white relative bg-white/5">
                                    <div className="absolute -inset-1 rounded-full border-4 border-primary border-t-transparent border-r-transparent animate-spin" />
                                    {nextSingerCount}
                                </div>
                            </div>
                        )}

                        {/* WAITING FOR NEXT QUEUE OVERLAY */}
                        {isWaitingForNextQueue && (
                            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/95 backdrop-blur-3xl animate-in fade-in duration-300">
                                <div className="p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl flex flex-col items-center justify-center shadow-2xl">
                                    <div className="p-4 rounded-2xl bg-primary/20 text-primary mb-4">
                                        <Loader2 size={36} className="animate-spin" />
                                    </div>
                                    <h3 className="text-2xl font-black text-white mb-2">Setting Up Your Stage</h3>
                                    <p className="text-white/60 text-sm max-w-[280px] text-center mb-6">Hang tight while the next track finishes downloading…</p>
                                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/5 text-[11px] font-bold text-emerald-400">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                        Processing Background Queue
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Play/Pause Overlay */}
                        <div className={`
                            absolute inset-0 z-20 flex items-center justify-center transition-opacity duration-300
                            ${showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
                        `}>
                            {currentSong?.singer && !isPlaying && (
                                <div className="absolute top-[18%] left-1/2 -translate-x-1/2 text-center animate-in slide-in-from-top-4 duration-500 w-full max-w-[90vw]">
                                    <p className="text-primary-hover text-sm sm:text-lg font-black tracking-[0.3em] uppercase mb-4 drop-shadow-sm opacity-80">Time to Shine</p>
                                    <h2 className="text-5xl sm:text-8xl font-black text-white drop-shadow-[0_0_25px_rgba(99,102,241,0.6)] tracking-tight truncate px-4">
                                        {currentSong.singer}
                                    </h2>
                                    <div className="mt-8 flex flex-col items-center gap-2 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-300">
                                        <div className="h-[1px] w-24 bg-gradient-to-r from-transparent via-white/20 to-transparent mb-4" />
                                        <p className="text-white/80 text-xl sm:text-4xl font-extrabold tracking-wide drop-shadow-xl max-w-4xl px-6 leading-tight">
                                            {currentSong.title}
                                        </p>
                                        {currentSong.artist && (
                                            <p className="text-white/40 text-sm sm:text-xl font-medium tracking-widest uppercase mt-2">
                                                {currentSong.artist}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (audioRef.current) {
                                        if (audioRef.current.paused) {
                                            audioRef.current.play();
                                            setShowControls(false);
                                        } else {
                                            audioRef.current.pause();
                                        }
                                    }
                                }}
                                className="w-24 h-24 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center cursor-pointer hover:bg-white/20 transition-colors shadow-2xl active:scale-90"
                            >
                                {isPlaying ? <Pause size={48} className="text-white fill-white" /> : <Play size={48} className="text-white fill-white ml-2" />}
                            </div>
                        </div>

                        {/* Lyrics Scrolling Container */}
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

                                {lyricsData.map((line, idx) => {
                                    const prevLine = idx > 0 ? lyricsData[idx - 1] : null;
                                    let wordGap = 0;
                                    const currStart = line.words && line.words.length > 0 ? line.words[0].start : (line.time || 0);
                                    const prevEnd = prevLine && prevLine.words && prevLine.words.length > 0 ? prevLine.words[prevLine.words.length - 1].end : (prevLine ? prevLine.time : 0);
                                    if (prevLine) {
                                        wordGap = currStart - prevEnd;
                                    } else {
                                        wordGap = currStart;
                                    }

                                    return (
                                        <div
                                            key={idx}
                                            className={`flex items-center justify-center transition-all duration-500 h-[220px] px-6 ${idx === activeLineIndex ? 'scale-105 opacity-100' : 'scale-95 opacity-30'}`}
                                        >
                                            <span
                                                className={`font-black transition-all text-center leading-[1.1] ${idx === activeLineIndex ? '' : 'text-white'}`}
                                                style={{
                                                    fontSize: 'clamp(1.2rem, 6vw, 3.5rem)',
                                                    textShadow: idx === activeLineIndex ? '0 0 15px rgba(99,102,241,0.5)' : 'none',
                                                }}
                                            >
                                                <LyricLine
                                                    line={line}
                                                    isActive={idx === activeLineIndex}
                                                    isPassed={idx < activeLineIndex}
                                                    audioRef={audioRef}
                                                    displayNextText={displayNextText}
                                                    gap={wordGap}
                                                    config={appConfig}
                                                    isFirst={idx === 0}
                                                    isNext={idx === activeLineIndex + 1}
                                                    wordRefs={wordRefs}
                                                />
                                            </span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Top Info Bar */}
                        <div className={`
                            absolute top-0 left-0 right-0 z-30 p-8 flex justify-between items-start transition-opacity duration-500
                            ${showControls ? 'opacity-100' : 'opacity-0'}
                        `}>
                            <div className="flex items-center gap-6 bg-black/40 backdrop-blur-xl p-4 pr-8 rounded-full border border-white/10 shadow-2xl">
                                {currentSong && (
                                    <img
                                        src={currentSong.thumbnail}
                                        alt="Thumbnail"
                                        className="w-16 h-16 rounded-full border-2 border-primary/50 object-cover shadow-2xl"
                                        onError={(e) => { e.target.src = "https://music.youtube.com/img/on_platform_logo_dark.svg"; }}
                                    />
                                )}
                                <div className="flex flex-col">
                                    <span className="text-primary text-[10px] font-black uppercase tracking-[0.2em] mb-1">Now Playing</span>
                                    <h3 className="text-white text-xl font-black tracking-tight leading-none drop-shadow-sm">{currentSong?.title || "Loading..."}</h3>
                                    <p className="text-white/50 text-xs font-bold mt-1 tracking-wide">{currentSong?.artist || "Standby"}</p>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                {onOpenLyricsSearch && !isPresentationView && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onOpenLyricsSearch(); }}
                                        className="p-4 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-white hover:bg-white/20 transition-all shadow-xl active:scale-95"
                                        title="Alternative Lyrics"
                                    >
                                        <Music size={24} />
                                    </button>
                                )}
                                <button
                                    onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
                                    className="p-4 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-white hover:bg-white/20 transition-all shadow-xl active:scale-95"
                                >
                                    {isFullscreen ? <Minimize2 size={24} /> : <Maximize2 size={24} />}
                                </button>
                                {!isPresentationView && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setKaraokeMode(false); if (audioRef.current) audioRef.current.pause(); }}
                                        className="p-4 rounded-full bg-red-500/20 backdrop-blur-md border border-red-500/30 text-red-400 hover:bg-red-500/30 transition-all shadow-xl active:scale-95"
                                    >
                                        <X size={24} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Controls Bottom Bar (Legacy style audio player) */}
                        <div
                            className={`w-full absolute bottom-0 left-0 right-0 z-40 transition-all duration-300 px-4 sm:px-20 py-3 bg-black border-t border-white/5 ${showControls ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}
                            style={{ paddingBottom: isMobile() ? 'calc(1.5rem + env(safe-area-inset-bottom))' : '1.5rem' }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className={`grid ${!isMobile() ? 'grid-cols-[1fr,auto]' : 'grid-cols-1'} gap-x-0 items-center`}>
                                <audio
                                    ref={audioRef}
                                    src={currentSong ? (audioMode === 'vocals' && currentSong.vocalsUrl ? currentSong.vocalsUrl : currentSong.instrumentalUrl) : ""}
                                    crossOrigin="anonymous"
                                    controls
                                    controlsList="nodownload noplaybackrate"
                                    autoPlay={!isAutoPaused}
                                    muted={appConfig.appMode === 'presentation' && !isPresentationView}
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

                                <div
                                    className="mt-1 text-text-muted text-[10px] uppercase tracking-widest font-bold px-2 col-span-2 hover:opacity-100 opacity-60 cursor-pointer flex items-center gap-1 transition-all"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (currentSong && currentSong.vocalsUrl) {
                                            const currentPos = audioRef.current ? audioRef.current.currentTime : 0;
                                            setAudioMode(prev => prev === 'instrumental' ? 'vocals' : 'instrumental');
                                            setTimeout(() => {
                                                if (audioRef.current) {
                                                    audioRef.current.currentTime = currentPos;
                                                    audioRef.current.play();
                                                }
                                            }, 50);
                                        }
                                    }}
                                >
                                    <div className={`w-1.5 h-1.5 rounded-full ${audioMode === 'vocals' ? 'bg-primary animate-pulse' : 'bg-white/20'}`} />
                                    {audioMode === 'vocals' ? 'Original Vocals Enabled' : 'AI Instrumental Mode'}
                                    {currentSong && !currentSong.vocalsUrl && <span className="ml-2 text-[8px] opacity-40">(Vocals unavailable for this track)</span>}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default KaraokePlayer;
