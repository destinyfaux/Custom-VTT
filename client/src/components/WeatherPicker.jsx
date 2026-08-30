// client/src/components/WeatherPicker.jsx
import { useState, useEffect, useRef } from 'react';
import { socket } from '../socket';
import { SERVER_URL } from '../config';

export default function WeatherPicker({ onClose }) {
    const [weatherTypes, setWeatherTypes] = useState([]);
    const [selectedType, setSelectedType] = useState(null);
    const [volume, setVolume] = useState(0.5);
    const [playing, setPlaying] = useState(false);
    const [lightningEnabled, setLightningEnabled] = useState(false);
    const previewAudio = useRef(null);
    const [pos, setPos] = useState({ x: 300, y: 150 });
    const [size, setSize] = useState({ w: 340, h: 440 }); // increased height for toggle
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const resizeStart = useRef({ w: 0, h: 0, mx: 0, my: 0 });

    useEffect(() => {
        // Robust fetch parser handles potential 404/non-JSON anomalies gracefully
        fetch(`${SERVER_URL}/api/weather`)
            .then(async r => {
                if (!r.ok) {
                    throw new Error(`Server returned status code: ${r.status}`);
                }
                const contentType = r.headers.get("content-type");
                if (contentType && contentType.includes("application/json")) {
                    return r.json();
                } else {
                    throw new Error("Response was not JSON structure");
                }
            })
            .then(data => {
                if (Array.isArray(data) && data.length > 0) {
                    setWeatherTypes(data);
                } else {
                    // Fallback to presets if server-side list is empty
                    setWeatherTypes(['rain', 'fog', 'ash_storm', 'blizzard', 'snow']);
                }
            })
            .catch(err => {
                console.warn('[WeatherPicker] Failed to load server-defined weather, falling back to presets:', err);
                // Graceful asset fallback
                setWeatherTypes(['rain', 'fog', 'ash_storm', 'blizzard', 'snow']);
            });
    }, []);

    // Cleanup preview audio on unmount
    useEffect(() => {
        return () => {
            if (previewAudio.current) {
                try {
                    previewAudio.current.pause();
                    previewAudio.current = null;
                } catch (e) {
                    // ignore
                }
            }
        };
    }, []);

    const applyWeather = () => {
        if (!selectedType) return;
        stopPreview(); // <-- Stop preview audio before applying
        socket.emit('change_weather', {
            type: selectedType,
            volume: volume,
            isPlaying: playing,
            lightningEnabled: lightningEnabled
        });
        onClose();
    };

// In clearWeather, include lightningEnabled: false
    const clearWeather = () => {
        socket.emit('change_weather', {
            type: null,
            volume: 0,
            isPlaying: false,
            lightningEnabled: false
        });
        onClose();
    };

    const previewSound = (type) => {
        if (previewAudio.current) {
            try {
                previewAudio.current.pause();
            } catch (err) {
                console.warn(err);
            }
        }
        const audio = new Audio(`${SERVER_URL}/assets/weather/${type}/sound.mp3`);
        audio.loop = true;
        audio.volume = volume;
        audio.play().catch(e => console.warn("[WeatherPicker] Preview audio playback rejected:", e));
        previewAudio.current = audio;
        setPlaying(true);
        setSelectedType(type);
    };

    const stopPreview = () => {
        if (previewAudio.current) {
            try {
            previewAudio.current.pause();
            } catch (err) {
                console.warn(err);
            }
            previewAudio.current = null;
        }
        setPlaying(false);
    };

    // Dragging & resizing (same pattern as DMNetworkPanel)
    const handleMouseDown = (e) => {
        if (e.target.tagName === 'HEADER' || e.target.parentElement?.tagName === 'HEADER') {
            setIsDragging(true);
            dragStart.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
        }
    };
    const handleResizeDown = (e) => {
        e.preventDefault(); e.stopPropagation();
        setIsResizing(true);
        resizeStart.current = { w: size.w, h: size.h, mx: e.clientX, my: e.clientY };
    };
    useEffect(() => {
        const move = (e) => {
            if (isDragging) setPos({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
            if (isResizing) setSize({
                w: Math.max(280, resizeStart.current.w + (e.clientX - resizeStart.current.mx)),
                h: Math.max(340, resizeStart.current.h + (e.clientY - resizeStart.current.my))
            });
        };
        const up = () => { setIsDragging(false); setIsResizing(false); };
        if (isDragging || isResizing) {
            window.addEventListener('mousemove', move);
            window.addEventListener('mouseup', up);
        }
        return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    }, [isDragging, isResizing]);

    return (
        <div
            className="fixed z-[1200] bg-bgPanel border border-accentGold rounded-lg shadow-2xl flex flex-col overflow-hidden"
            style={{ left: pos.x, top: pos.y, width: size.w, height: size.h }}
            onMouseDown={handleMouseDown}
        >
            <header className="bg-bgCard p-3 flex justify-between items-center cursor-move border-b border-borderDark shrink-0">
                <span className="text-accentGold font-bold text-[10px] uppercase tracking-widest">Weather</span>
                <button onClick={onClose} className="text-textMuted hover:text-white px-2">✕</button>
            </header>
            <div className="flex-1 p-4 space-y-4 text-xs bg-[#0b0c10] overflow-y-auto">
                <div className="grid grid-cols-2 gap-2">
                    {weatherTypes.map(type => (
                        <button
                            key={type}
                            onClick={() => previewSound(type)}
                            className={`py-2 rounded text-[10px] font-bold border ${
                                selectedType === type ? 'bg-accentGold text-black border-accentGold' : 'bg-bgCard text-white border-borderDark hover:border-accentGold'
                            }`}
                        >
                            {type.replace('_', ' ').toUpperCase()}
                        </button>
                    ))}
                </div>

                {/* Volume Slider */}
                <div>
                    <label className="text-textMuted block mb-1">Weather Volume</label>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={volume}
                        onChange={e => setVolume(parseFloat(e.target.value))}
                        className="w-full accent-accentGold"
                    />
                </div>

                {/* Lightning Toggle */}
                <div className="flex items-center gap-2 mt-1">
                    <input
                        type="checkbox"
                        id="lightningToggle"
                        checked={lightningEnabled}
                        onChange={(e) => setLightningEnabled(e.target.checked)}
                        className="w-4 h-4 accent-accentGold cursor-pointer"
                    />
                    <label htmlFor="lightningToggle" className="text-xs text-textMuted cursor-pointer">
                        Enable Lightning Flashes
                    </label>
                </div>

                <div className="flex gap-2 mt-2">
                    <button
                        onClick={applyWeather}
                        disabled={!selectedType}
                        className="flex-1 bg-accentGold text-black font-bold py-2 rounded text-[11px] hover:bg-yellow-500 disabled:opacity-50"
                    >
                        Apply Weather
                    </button>
                    <button
                        onClick={clearWeather}
                        className="flex-1 bg-borderDark text-white font-bold py-2 rounded text-[11px] hover:bg-gray-700"
                    >
                        Clear Weather
                    </button>
                </div>
                <button onClick={stopPreview} className="w-full text-[9px] text-textMuted underline">Stop Preview</button>
            </div>
            <div className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize flex items-end justify-end p-1 group" onMouseDown={handleResizeDown}>
                <div className="w-2 h-2 border-r-2 border-b-2 border-accentGold opacity-30 group-hover:opacity-100" />
            </div>
        </div>
    );
}