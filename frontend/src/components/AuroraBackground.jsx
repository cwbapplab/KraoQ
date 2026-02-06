import React, { useEffect, useRef, useState } from 'react';

// Keep track of audio sources to avoid multiple connections to the same element
const audioSourceMap = new WeakMap();

const AuroraBackground = ({ audioRef }) => {
    const containerRef = useRef(null);
    const analyzerRef = useRef(null);
    const animationRef = useRef(null);
    const rotationRef = useRef([0, 0, 0, 0]);
    const [colors, setColors] = useState(['#00f2ff', '#00ff88', '#a855f7', '#6366f1']);

    useEffect(() => {
        const palettes = [
            ['#00f2ff', '#00ff88', '#a855f7', '#6366f1'], // Cyan/Green/Purple
            ['#00e1ff', '#0072ff', '#7000ff', '#00c3ff'], // Deep Blues/Purples
            ['#00ffa2', '#6366f1', '#a855f7', '#00f2ff'], // Aurora Borealis (Green/Blue/Indigo)
            ['#7000ff', '#a855f7', '#ff00cc', '#3333ff']  // Vibrant Neon (Purple/Blue/Pink)
        ];
        setColors(palettes[Math.floor(Math.random() * palettes.length)]);
    }, []);

    useEffect(() => {
        if (!audioRef.current) return;

        const audio = audioRef.current;
        let audioCtx;
        let analyzer;

        const setupAudio = () => {
            try {
                if (audioSourceMap.has(audio)) {
                    const existing = audioSourceMap.get(audio);
                    analyzer = existing.analyzer;
                    analyzerRef.current = analyzer;
                    return;
                }

                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                const source = audioCtx.createMediaElementSource(audio);
                analyzer = audioCtx.createAnalyser();
                analyzer.fftSize = 256;
                source.connect(analyzer);
                analyzer.connect(audioCtx.destination);

                audioSourceMap.set(audio, { source, analyzer, ctx: audioCtx });
                analyzerRef.current = analyzer;
            } catch (err) {
                console.warn("Audio Analysis setup failed:", err);
            }
        };

        setupAudio();

        const animate = () => {
            if (analyzerRef.current && containerRef.current) {
                const bufferLength = analyzerRef.current.frequencyBinCount;
                const dataArray = new Uint8Array(bufferLength);
                analyzerRef.current.getByteFrequencyData(dataArray);

                const average = dataArray.reduce((a, b) => a + b, 0) / bufferLength;
                const bass = dataArray.slice(0, 10).reduce((a, b) => a + b, 0) / 10;

                const intensity = average / 255;
                const speedMult = 0.1 + (bass / 255) * 3; // Speed based on bass/rhythm

                // Update rotation/movement of each blob
                rotationRef.current = rotationRef.current.map((r, i) => r + (0.3 + i * 0.1) * speedMult);

                const blobs = containerRef.current.children;
                for (let i = 0; i < blobs.length; i++) {
                    const blob = blobs[i];
                    const angle = rotationRef.current[i];

                    // Moving in a circle/wavy pattern
                    const x = Math.cos(angle * 0.02) * 15;
                    const y = Math.sin(angle * 0.02) * 15;
                    const scale = 1 + intensity * 0.4;

                    blob.style.transform = `translate(${x}%, ${y}%) scale(${scale}) rotate(${angle * 0.1}deg)`;
                }

                const opacity = 0.2 + intensity * 0.3;
                containerRef.current.style.opacity = opacity;
            }
            animationRef.current = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [audioRef]);

    return (
        <div
            ref={containerRef}
            className="absolute inset-0 overflow-hidden pointer-events-none transition-opacity duration-700 mix-blend-normal"
            style={{ zIndex: 0, filter: 'blur(80px)', opacity: 0.3 }}
        >
            {colors.map((color, i) => (
                <div
                    key={i}
                    className="absolute w-[140%] h-[140%] rounded-[40%] mix-blend-screen"
                    style={{
                        background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
                        top: i < 2 ? '-30%' : '30%',
                        left: i % 2 === 0 ? '-30%' : '30%',
                        opacity: 0.7,
                        willChange: 'transform'
                    }}
                />
            ))}
        </div>
    );
};

export default AuroraBackground;
