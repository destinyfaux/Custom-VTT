// client/src/components/WeatherPicker.jsx
import { useState, useEffect, useRef } from 'react';
import { socket } from '../socket';
import { SERVER_URL } from '../config';
import { useDraggableResizable } from '../hooks/useDraggableResizable';

export default function WeatherPicker({ onClose }) {
  const [weatherTypes, setWeatherTypes] = useState([]);
  const [selectedType, setSelectedType] = useState(null);
  const [volume, setVolume] = useState(0.5);
  const [playing, setPlaying] = useState(false);
  const [lightningEnabled, setLightningEnabled] = useState(false);
  const previewAudio = useRef(null);

  const { pos, size, handleMouseDown, handleResizeDown } = useDraggableResizable({
    initialPos: { x: 300, y: 150 },
    initialSize: { w: 340, h: 440 },
    minSize: { w: 280, h: 360 }
  });

  useEffect(() => {
    fetch(`${SERVER_URL}/api/weather`)
      .then(async r => {
        if (!r.ok) throw new Error(`Status ${r.status}`);
        return r.json();
      })
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setWeatherTypes(data);
        } else {
          setWeatherTypes(['rain', 'fog', 'ash_storm', 'blizzard', 'snow']);
        }
      })
      .catch(err => {
        console.warn('[WeatherPicker] Falling back to presets:', err);
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

  const applyWeather = () => {
    if (!selectedType) return;
    stopPreview();
    socket.emit('change_weather', {
      type: selectedType,
      volume,
      isPlaying: playing,
      lightningEnabled
    });
    onClose();
  };

  const clearWeather = () => {
    stopPreview();
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
    audio.play().catch(e => console.warn('[WeatherPicker] Preview audio blocked:', e));
    previewAudio.current = audio;
    setPlaying(true);
    setSelectedType(type);
  };

  return (
    <div
      className="fixed z-[1200] bg-bgPanel border border-accentGold rounded-lg shadow-2xl flex flex-col overflow-hidden"
      style={{ left: pos.x, top: pos.y, width: size.w, height: size.h }}
      onMouseDown={handleMouseDown}
    >
      <header className="bg-bgCard p-3 flex justify-between items-center cursor-move border-b border-borderDark shrink-0">
        <span className="text-accentGold font-bold text-[10px] uppercase tracking-widest drag-handle">Weather</span>
        <button onClick={onClose} className="text-textMuted hover:text-white px-2" type="button">✕</button>
      </header>

      <div className="flex-1 p-4 space-y-4 text-xs bg-[#0b0c10] overflow-y-auto">
        <div className="grid grid-cols-2 gap-2">
          {weatherTypes.map(type => (
            <button
              key={type}
              type="button"
              onClick={() => previewSound(type)}
              className={`py-2 rounded text-[10px] font-bold border transition-all ${
                selectedType === type
                  ? 'bg-accentGold text-black border-accentGold'
                  : 'bg-bgCard text-white border-borderDark hover:border-accentGold'
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
            onChange={e => {
              const val = parseFloat(e.target.value);
              setVolume(val);
              if (previewAudio.current) previewAudio.current.volume = val;
            }}
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
            type="button"
            onClick={applyWeather}
            disabled={!selectedType}
            className="flex-1 bg-accentGold text-black font-bold py-2 rounded text-[11px] hover:bg-yellow-500 disabled:opacity-50 transition-colors"
          >
            Apply Weather
          </button>
          <button
            type="button"
            onClick={clearWeather}
            className="flex-1 bg-borderDark text-white font-bold py-2 rounded text-[11px] hover:bg-gray-700 transition-colors"
          >
            Clear Weather
          </button>
        </div>
        <button
          type="button"
          onClick={stopPreview}
          className="w-full text-[9px] text-textMuted underline hover:text-white"
        >
          Stop Preview
        </button>
      </div>

      {/* Resize Handle */}
      <div
        className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize flex items-end justify-end p-1 group"
        onMouseDown={handleResizeDown}
      >
        <div className="w-2 h-2 border-r-2 border-b-2 border-accentGold opacity-30 group-hover:opacity-100" />
      </div>
    </div>
  );
}