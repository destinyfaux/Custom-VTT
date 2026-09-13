// client/src/components/AudioPlayer.jsx
import { useEffect, useRef, useState } from 'react';
import { socket } from '../socket';
import { SERVER_URL } from '../config';
import soundSynthesizer from '../utils/SoundSynthesizer';

export default function AudioPlayer() {
    const musicRef = useRef(new Audio());
    const sfxRefs = useRef([]);
    const weatherAudioRef = useRef(null);
    const weatherVolumeRef = useRef(0.5); // Tracks target ambient volume from the DM
    const [audioUnlocked, setAudioUnlocked] = useState(false);
    const [localVolume, setLocalVolume] = useState(0.5);
    const localVolumeRef = useRef(localVolume);
    const currentTrackRef = useRef(null);
    const unlockAttemptedRef = useRef(false);
    const [showManualButton, setShowManualButton] = useState(false);

    // Sync volume slider modifications to music, weather, and the tracking ref
    useEffect(() => {
        localVolumeRef.current = localVolume;
        musicRef.current.volume = localVolume;
        if (weatherAudioRef.current) {
            weatherAudioRef.current.volume = weatherVolumeRef.current * localVolume;
        }
    }, [localVolume]);

    // Helper to log explicit playback/decode errors to the console
    const attachDiagnosticListeners = (audioElement, typeLabel) => {
        audioElement.onerror = () => {
            const err = audioElement.error;
            let errorMsg = "Unknown Error";
            if (err) {
                switch (err.code) {
                    case 1: errorMsg = "Aborted (playback stopped by user/system)"; break;
                    case 2: errorMsg = "Network Error (failed to download/reach file)"; break;
                    case 3: errorMsg = "Decode Error (corrupted file, low-bitrate mismatch, or bad compression)"; break;
                    case 4: errorMsg = "Source Not Supported (unsupported format/codec)"; break;
                }
            }
            console.error(`[AudioPlayer Error] ${typeLabel} failed to load or play. URL: ${audioElement.src} | Code: ${err?.code} - ${errorMsg}`);
        };
    };

    // Core unlock function – returns true if successful
    const unlockAudioSystem = async () => {
        if (unlockAttemptedRef.current) return audioUnlocked;
        unlockAttemptedRef.current = true;

        try {
            // 1. Unlock SoundSynthesizer (creates AudioContext, plays silent buffer)
            soundSynthesizer.unlock();

            // 2. Mark as unlocked immediately – synthesizer is ready
            setAudioUnlocked(true);
            
            // 3. Attempt to enable music element in the background (doesn't block)
            musicRef.current.volume = 0;
            try {
                await musicRef.current.play();
                musicRef.current.pause();
                musicRef.current.currentTime = 0;
                musicRef.current.volume = localVolume;
                console.log("[AudioPlayer] Music element also unlocked");
            } catch (musicErr) {
                console.warn("[AudioPlayer] Music element autoplay failed, but synthesizer ready");
            }

            return true;
        } catch (err) {
            console.warn("[AudioPlayer] Unlock failed:", err);
            // Show manual button after 3 seconds
            setTimeout(() => setShowManualButton(true), 3000);
            return false;
        }
    };

    // Auto‑unlock on any user gesture
    useEffect(() => {
        const handleGesture = () => {
            if (!audioUnlocked) {
                unlockAudioSystem();
            }
        };
        window.addEventListener('click', handleGesture);
        window.addEventListener('keydown', handleGesture);
        window.addEventListener('touchstart', handleGesture);
        return () => {
            window.removeEventListener('click', handleGesture);
            window.removeEventListener('keydown', handleGesture);
            window.removeEventListener('touchstart', handleGesture);
        };
    }, [audioUnlocked]);

    // Manual unlock button handler
    const handleManualUnlock = async () => {
        await unlockAudioSystem();
        setShowManualButton(false);
    };

    // Music, SFX, and Weather sync (only when unlocked)
    useEffect(() => {
        if (!audioUnlocked) return;

        // Initialize error handling diagnostic listener on music element
        attachDiagnosticListeners(musicRef.current, "Music Track");

        socket.on('state_update', (state) => {
            if (!state) return;

            // MUSIC SYNC
            if (state.audio?.music) {
                const { track, isPlaying } = state.audio.music;
                const music = musicRef.current;

                // Only change source if track URL is new
                const url = track ? `${SERVER_URL}/assets/music/${encodeURIComponent(track)}` : null;
                if (url !== currentTrackRef.current) {
                    currentTrackRef.current = url;
                    if (url) {
                        music.src = url;
                        music.load();
                    } else {
                        // CLEANUP: Explicitly unload current track if nulled
                        music.src = '';
                    }
                }
                if (isPlaying) {
                    music.play().catch(e => console.warn("[AudioPlayer] Music play deferred/failed:", e));
                } else {
                    music.pause();
                }
            }

            // WEATHER SYNC
            if (state.weather) {
                const { type, volume, isPlaying } = state.weather;
                weatherVolumeRef.current = typeof volume === 'number' ? volume : 0.5;
                const audio = weatherAudioRef.current;

                if (type) {
                    // Check if file includes its extension or defaults to sound.mp3
                    const hasExtension = type.includes('.') || type.includes('/');
                    const url = hasExtension 
                        ? `${SERVER_URL}/assets/weather/${type}` 
                        : `${SERVER_URL}/assets/weather/${type}/sound.mp3`;
                    
                    // If weather type changed or hasn't been initialized yet
                    if (!audio || audio.src !== url) {
                        if (audio) {
                            try {
                                audio.pause();
                            } catch (err) {
                                console.warn("[AudioPlayer] Error pausing previous weather loop:", err);
                            }
                        }
                        const newAudio = new Audio(url);
                        newAudio.loop = true;
                        newAudio.volume = weatherVolumeRef.current * localVolumeRef.current;
                        attachDiagnosticListeners(newAudio, "Weather Loop");

                        if (isPlaying) {
                            newAudio.play().catch(e => console.warn("[AudioPlayer] Weather loop play failed:", e));
                        }
                        weatherAudioRef.current = newAudio;
                    } else {
                        // Otherwise, scale properties on the current active instance
                        audio.volume = weatherVolumeRef.current * localVolumeRef.current;
                        if (isPlaying && audio.paused) {
                            audio.play().catch(e => console.warn("[AudioPlayer] Weather loop play failed:", e));
                        } else if (!isPlaying && !audio.paused) {
                            audio.pause();
                        }
                    }
                } else {
                    // No active weather, clean up current audio if it exists
                    if (audio) {
                        try {
                            audio.pause();
                        } catch (err) {
                            console.warn("[AudioPlayer] Error stopping weather loop:", err);
                        }
                        weatherAudioRef.current = null;
                    }
                }
            } else {
                // If state.weather is missing entirely, ensure no weather sound plays
                if (weatherAudioRef.current) {
                    try {
                        weatherAudioRef.current.pause();
                    } catch (err) {
                        console.warn("[AudioPlayer] Error pausing weather loop:", err);
                    }
                    weatherAudioRef.current = null;
                }
            }
        });

        // SFX SYNC
        socket.on('trigger_sfx', ({ track, volume, loop }) => {
            if (!audioUnlocked) return;
            const sfx = new Audio(`${SERVER_URL}/assets/sfx/${encodeURIComponent(track)}`);
            sfx.volume = volume;
            sfx.loop = loop;
            attachDiagnosticListeners(sfx, "SFX Track");

            sfx.play().catch(e => console.warn("[AudioPlayer] SFX play failed:", e));
            sfxRefs.current.push(sfx);
            sfx.onended = () => { sfxRefs.current = sfxRefs.current.filter(a => a !== sfx); };
        });

        // STOP ALL SFX SYNC
        socket.on('stop_all_sfx', () => {
            sfxRefs.current.forEach(sfx => {
                try {
                    sfx.pause();
                    sfx.currentTime = 0;
                } catch (err) {
                    console.warn("Error stopping sfx instance:", err);
                }
            });
            sfxRefs.current = [];
            console.log("[VTT-Audio] Terminated all active sound effects.");
        });

        return () => {
            socket.off('state_update');
            socket.off('trigger_sfx');
            socket.off('stop_all_sfx');
        };
    }, [audioUnlocked]);

    // Cleanup all media assets on component unmount
    useEffect(() => {
        return () => {
            if (weatherAudioRef.current) {
                try {
                    weatherAudioRef.current.pause();
                } catch (err) {
                    console.warn("[AudioPlayer] Cleanup failed for weather audio:", err);
                }
                weatherAudioRef.current = null;
            }
            if (musicRef.current) {
                try {
                    musicRef.current.pause();
                } catch (err) {
                    console.warn("[AudioPlayer] Cleanup failed for music player:", err);
                }
            }
            sfxRefs.current.forEach(sfx => {
                try {
                    sfx.pause();
                } catch (err) {
                    console.warn("[AudioPlayer] Cleanup failed for sfx player:", err);
                }
            });
            sfxRefs.current = [];
        };
    }, []);

    // Always show the volume control after unlock
    if (audioUnlocked) {
        return (
            <div className="fixed top-6 right-6 z-[200] flex items-center gap-2 bg-bgCard/90 backdrop-blur-sm border border-borderDark rounded-full px-3 py-1.5 shadow-lg transition-all">
                <span className="text-sm">🔊</span>
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={localVolume}
                    onChange={e => setLocalVolume(parseFloat(e.target.value))}
                    className="w-20 accent-accentGold h-1"
                />
            </div>
        );
    }

    // Show manual button only if auto‑unlock failed (timeout)
    if (showManualButton) {
        return (
            <button 
                onClick={handleManualUnlock}
                className="fixed top-6 right-6 z-[200] flex items-center gap-3 bg-bgCard border-2 border-accentGold p-2 pl-3 rounded-full shadow-[0_0_20px_rgba(0,0,0,0.5)] hover:scale-105 transition-all group animate-pulse"
                title="Enable Audio"
            >
                <div className="flex flex-col items-end leading-none">
                    <span className="text-accentGold font-bold text-[9px] uppercase tracking-tighter">Audio System</span>
                    <span className="text-white text-[8px] font-medium opacity-70">Click to Enable</span>
                </div>
                <div className="w-8 h-8 rounded-full bg-accentGold flex items-center justify-center text-bgDark text-sm">
                    🔇
                </div>
            </button>
        );
    }

    // Initial loading – show nothing (or a subtle spinner)
    return null;
}