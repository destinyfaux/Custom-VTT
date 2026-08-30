// client/src/components/BottomToolbar.jsx
import { useEffect, useState, useRef } from 'react';
import { socket } from '../socket';
import { SERVER_URL } from '../config';
import DMNetworkPanel from './DMNetworkPanel';
import OptionsModal from './OptionsModal';
import WeatherPicker from './WeatherPicker';

export default function BottomToolbar({
  tool, setTool,
  showGrid, setShowGrid,
  lightRadius, setLightRadius,
  lightColor, setLightColor,
  onToggleCombat,
  onToggleCheckRequest,
  stampSize,
  setStampSize
}) {
  const [maps, setMaps] = useState([]);
  const [selectedMap, setSelectedMap] = useState('');
  const [showNetworkPanel, setShowNetworkPanel] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showWeatherPicker, setShowWeatherPicker] = useState(false);

  // Day/Night configuration state
  const [showDayNightPanel, setShowDayNightPanel] = useState(false);
  const [panelPos, setPanelPos] = useState({ left: 350, bottom: 44 });
  const [dayNight, setDayNight] = useState({
    mode: 'off',
    dayColor: '#ffaa33',
    dayOpacity: 0.15,
    nightColor: '#0a1428',
    nightOpacity: 0.55,
    duskColor: '#9333ea',
    duskOpacity: 0.25
  });

  const dayNightPanelRef = useRef(null);
  const gearButtonRef = useRef(null);

  // Sync state from server
  useEffect(() => {
    const handleState = (state) => {
      if (state && state.dayNight) {
        setDayNight(state.dayNight);
      }
    };
    socket.on('init_state', handleState);
    socket.on('state_update', handleState);
    return () => {
      socket.off('init_state', handleState);
      socket.off('state_update', handleState);
    };
  }, []);

  // Calculate anchor position & toggle
  const toggleDayNightPanel = (e) => {
    e.stopPropagation();
    if (!showDayNightPanel && gearButtonRef.current) {
      const rect = gearButtonRef.current.getBoundingClientRect();
      const popoverWidth = 270;
      const leftPos = Math.max(10, Math.min(window.innerWidth - popoverWidth - 10, rect.left - 100));
      setPanelPos({
        left: leftPos,
        bottom: window.innerHeight - rect.top + 8
      });
    }
    setShowDayNightPanel(prev => !prev);
  };

  // Close Day/Night popover on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (
        dayNightPanelRef.current &&
        !dayNightPanelRef.current.contains(e.target) &&
        gearButtonRef.current &&
        !gearButtonRef.current.contains(e.target)
      ) {
        setShowDayNightPanel(false);
      }
    };
    if (showDayNightPanel) {
      window.addEventListener('mousedown', handleOutsideClick);
    }
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, [showDayNightPanel]);

  const updateDayNight = (changes) => {
    const updated = { ...dayNight, ...changes };
    setDayNight(updated);
    socket.emit('change_day_night', updated);
  };

  const cycleMode = () => {
    const modes = ['off', 'day', 'dusk', 'night'];
    const nextIdx = (modes.indexOf(dayNight.mode) + 1) % modes.length;
    updateDayNight({ mode: modes[nextIdx] });
  };

  useEffect(() => {
    fetch(`${SERVER_URL}/api/maps`)
      .then(res => res.json())
      .then(data => {
        setMaps(data);
        if (data.length > 0) setSelectedMap(data[0].name);
      })
      .catch(err => console.error("Error fetching maps:", err));
  }, []);

  const loadMap = () => {
    if (selectedMap) socket.emit('change_map', selectedMap);
  };

  // Get thumbnail for the currently selected map
  const currentMapData = maps.find(m => m.name === selectedMap);
  const thumbnailUrl = currentMapData?.thumbnail
    ? `${SERVER_URL}${currentMapData.thumbnail}`
    : null;

  // Tool list with keyboard shortcut numbers – includes 'hide' tool at position 7
  const tools = ['pan', 'draw', 'erase', 'lights', 'stamps', 'notes', 'hide'];

  // Reusable tool action tooltips
  const toolDescriptions = {
    pan: 'Pan Map & Drag Tokens (Shortcut: 1) — Navigate map or drag owned tokens',
    draw: 'Draw Vision Blocking Walls (Shortcut: 2) — Left-click coordinates to draw walls, Right-click to finalize',
    erase: 'Eraser Tool (Shortcut: 3) — Click any element (wall, light, stamp, note, token) to delete it',
    lights: 'Place Light Sources (Shortcut: 4) — Left-click to place a dynamic light with custom radius',
    stamps: 'Place Map Stamps (Shortcut: 5) — Left-click to place the chosen library stamp on the map layout',
    notes: 'Persistent DM Notes (Shortcut: 6) — Left-click map to place a pin, click pins to edit content',
    hide: 'Hide/Reveal Assets (Shortcut: 7) — Left-click tokens or stamps to hide or show them for players',
    };

  const getDayNightLabel = () => {
    switch (dayNight.mode) {
      case 'day': return '☀️ DAY';
      case 'dusk': return '🌅 DUSK';
      case 'night': return '🌙 NIGHT';
      default: return '☀️/🌙 LIGHT';
    }
  };

  return (
    <>
      {/* ========== FLOATING FIXED DAY/NIGHT SETTINGS POPOVER ========== */}
      {showDayNightPanel && (
        <div
          ref={dayNightPanelRef}
          onMouseDown={(e) => e.stopPropagation()}
          className="fixed z-[1500] w-[270px] bg-bgPanel border border-accentGold rounded-xl p-3 shadow-2xl space-y-3 text-xs select-none animate-in fade-in zoom-in-95 duration-150"
          style={{ left: panelPos.left, bottom: panelPos.bottom }}
        >
          <div className="flex items-center justify-between border-b border-borderDark pb-1.5">
            <span className="text-accentGold font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5">
              <span>☀️/🌙</span> Ambient Lighting
            </span>
            <button
              onClick={() => setShowDayNightPanel(false)}
              className="text-textMuted hover:text-textLight text-xs px-1"
            >
              ✕
            </button>
          </div>

          {/* Mode Selection Grid */}
          <div className="grid grid-cols-4 gap-1">
            {[
              { id: 'off', label: 'Off' },
              { id: 'day', label: '☀️ Day' },
              { id: 'dusk', label: '🌅 Dusk' },
              { id: 'night', label: '🌙 Night' },
            ].map(m => (
              <button
                key={m.id}
                onClick={() => updateDayNight({ mode: m.id })}
                className={`py-1 rounded text-[9px] font-bold transition-all ${
                  dayNight.mode === m.id
                    ? 'bg-accentGold text-black font-extrabold shadow-sm'
                    : 'bg-bgCard text-textMuted hover:bg-borderDark hover:text-textLight'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Night Tint Customizer */}
          <div className="space-y-1.5 bg-bgCard p-2 rounded-lg border border-borderDark/60">
            <div className="flex items-center justify-between text-[10px] font-bold text-indigo-300">
              <span className="flex items-center gap-1">🌙 Night Tint</span>
              <input
                type="color"
                value={dayNight.nightColor || '#0a1428'}
                onChange={e => updateDayNight({ nightColor: e.target.value })}
                className="w-5 h-5 rounded cursor-pointer border border-borderDark bg-transparent"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0.05"
                max="0.95"
                step="0.05"
                value={dayNight.nightOpacity ?? 0.55}
                onChange={e => updateDayNight({ nightOpacity: parseFloat(e.target.value) })}
                className="w-full accent-indigo-400 h-1.5 cursor-pointer"
              />
              <span className="text-[9px] text-textMuted w-8 text-right font-mono">
                {Math.round((dayNight.nightOpacity ?? 0.55) * 100)}%
              </span>
            </div>
          </div>

          {/* Dusk Tint Customizer */}
          <div className="space-y-1.5 bg-bgCard p-2 rounded-lg border border-borderDark/60">
            <div className="flex items-center justify-between text-[10px] font-bold text-purple-300">
              <span className="flex items-center gap-1">🌅 Dusk Tint</span>
              <input
                type="color"
                value={dayNight.duskColor || '#9333ea'}
                onChange={e => updateDayNight({ duskColor: e.target.value })}
                className="w-5 h-5 rounded cursor-pointer border border-borderDark bg-transparent"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0.05"
                max="0.85"
                step="0.05"
                value={dayNight.duskOpacity ?? 0.25}
                onChange={e => updateDayNight({ duskOpacity: parseFloat(e.target.value) })}
                className="w-full accent-purple-400 h-1.5 cursor-pointer"
              />
              <span className="text-[9px] text-textMuted w-8 text-right font-mono">
                {Math.round((dayNight.duskOpacity ?? 0.25) * 100)}%
              </span>
            </div>
          </div>

          {/* Day Warmth Customizer */}
          <div className="space-y-1.5 bg-bgCard p-2 rounded-lg border border-borderDark/60">
            <div className="flex items-center justify-between text-[10px] font-bold text-amber-300">
              <span className="flex items-center gap-1">☀️ Day Warmth</span>
              <input
                type="color"
                value={dayNight.dayColor || '#ffaa33'}
                onChange={e => updateDayNight({ dayColor: e.target.value })}
                className="w-5 h-5 rounded cursor-pointer border border-borderDark bg-transparent"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0.05"
                max="0.8"
                step="0.05"
                value={dayNight.dayOpacity ?? 0.15}
                onChange={e => updateDayNight({ dayOpacity: parseFloat(e.target.value) })}
                className="w-full accent-amber-400 h-1.5 cursor-pointer"
              />
              <span className="text-[9px] text-textMuted w-8 text-right font-mono">
                {Math.round((dayNight.dayOpacity ?? 0.15) * 100)}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ========== BOTTOM TOOLBAR CONTAINER ========== */}
      <div className="h-9 min-h-[2.25rem] flex-none bg-bgPanel border-t border-borderDark flex items-center px-2 gap-2 overflow-x-auto scrollbar-hide relative">
        {/* Map selector and load + thumbnail */}
        <div className="flex items-center gap-1 bg-bgCard border border-borderDark rounded px-1 h-7 shrink-0">
          <select
            className="bg-transparent text-textLight text-[10px] focus:outline-none cursor-pointer"
            value={selectedMap}
            onChange={(e) => setSelectedMap(e.target.value)}
            title="Select a map folder to load"
          >
            {maps.length === 0 && (
              <option value="" className="bg-bgCard text-textLight">No maps</option>
            )}
            {maps.map(m => (
              <option key={m.name} value={m.name} className="bg-bgCard text-textLight">
                {m.name}
              </option>
            ))}
          </select>
          <button
            className="bg-accentGold text-black font-extrabold px-2 rounded text-[10px] hover:bg-yellow-500 transition-colors h-5"
            onClick={loadMap}
            title="Load selected map scene onto VTT canvas"
          >
            LOAD
          </button>
          {thumbnailUrl && (
            <div 
              className="w-7 h-7 rounded overflow-hidden border border-borderDark flex-shrink-0"
              title="Selected map preview"
            >
              <img src={thumbnailUrl} alt={selectedMap} className="w-full h-full object-cover" />
            </div>
          )}
        </div>

      <div className="h-5 w-px bg-borderDark opacity-50 shrink-0" />

      {/* Tool buttons with number hints */}
      {tools.map((t, i) => (
        <button
          key={t}
          className={`px-3 py-1 text-[10px] font-bold rounded transition-all shrink-0 ${
            tool === t ? 'bg-accentGold text-black' : 'bg-transparent text-accentGold hover:bg-borderDark'
          }`}
          onClick={() => setTool(t)}
          title={toolDescriptions[t]}
        >
          {t.toUpperCase()} ({i + 1})
        </button>
      ))}

      {/* Grid toggle */}
      <button
        className="px-3 py-1 text-[10px] font-bold bg-transparent text-accentGold rounded hover:bg-borderDark transition-all shrink-0"
        onClick={() => setShowGrid(!showGrid)}
        title="Toggle combat map alignment grid overlay"
      >
        GRID {showGrid ? 'ON' : 'OFF'}
      </button>

      {/* Stamp size slider (only when stamps tool active) */}
      {tool === 'stamps' && (
        <div className="flex items-center gap-2 bg-bgCard border border-borderDark rounded px-2 h-7 shrink-0" title="Stamp size">
          <label className="text-[9px] text-accentGold font-bold">Size</label>
          <input
            type="range"
            min="20"
            max="500"
            step="1"
            value={stampSize}
            onChange={e => setStampSize(Number(e.target.value))}
            className="w-28 accent-accentGold h-1"
          />
          <span className="text-[9px] text-accentGold w-12">{stampSize}px</span>
        </div>
      )}

      {/* Light configuration (only when lights tool active) */}
      {tool === 'lights' && (
        <div className="flex items-center gap-2 bg-bgCard border border-borderDark rounded px-2 h-7 shrink-0" title="Configure placed light parameters">
          <label className="text-[9px] text-accentGold font-bold" title="Light radius value">R</label>
          <input
            type="range"
            min="50"
            max="1000"
            step="10"
            value={lightRadius}
            onChange={e => setLightRadius(Number(e.target.value))}
            className="w-20 accent-[#e6b422] h-1"
            title="Adjust placed light projection radius (pixels)"
          />
          <span className="text-[9px] text-accentGold w-6">{lightRadius}</span>
          <input
            type="color"
            value={lightColor}
            onChange={e => setLightColor(e.target.value)}
            className="w-5 h-5 cursor-pointer border border-borderDark rounded"
            title="Adjust placed light aura color"
          />
        </div>
      )}

      <div className="h-5 w-px bg-borderDark opacity-50 shrink-0" />

        {/* ========== DAY / NIGHT CYCLE BUTTON WITH TRIGGER ========== */}
        <div className="relative shrink-0 flex items-center">
          <div className="flex items-center bg-bgCard border border-borderDark rounded overflow-hidden">
            <button
              onClick={cycleMode}
              className={`px-2.5 py-1 text-[10px] font-bold transition-all flex items-center gap-1 ${
                dayNight.mode === 'night'
                  ? 'bg-indigo-950 text-indigo-200 border-r border-borderDark'
                  : dayNight.mode === 'day'
                  ? 'bg-amber-500 text-black border-r border-borderDark'
                  : dayNight.mode === 'dusk'
                  ? 'bg-purple-900 text-purple-200 border-r border-borderDark'
                  : 'bg-transparent text-textMuted hover:text-textLight border-r border-borderDark'
              }`}
              title="Click to cycle Day / Dusk / Night / Off"
            >
              {getDayNightLabel()}
            </button>
            <button
              ref={gearButtonRef}
              onClick={toggleDayNightPanel}
              className={`px-2 py-1 text-[10px] transition-colors ${
                showDayNightPanel ? 'bg-accentGold text-black' : 'text-textMuted hover:text-accentGold hover:bg-borderDark'
              }`}
              title="Configure Day / Night tint colors and opacity"
            >
              ⚙️
            </button>
          </div>
        </div>

      {/* WEATHER FX button */}
      <button
        onClick={() => setShowWeatherPicker(true)}
        className="px-3 py-1 text-[10px] font-bold bg-borderDark text-textLight rounded hover:bg-gray-700 transition-all shrink-0 whitespace-nowrap"
        title="Weather Effects"
      >
        🌦️ WEATHER
      </button>

      {/* REQUEST CHECK button */}
      <button
        onClick={onToggleCheckRequest}
        className="px-3 py-1 text-[10px] font-bold bg-accentGold text-black rounded hover:bg-yellow-500 transition-all shrink-0 whitespace-nowrap"
        title="Prompt a chosen player to roll an ability saving throw or skill check"
      >
        REQUEST CHECK
      </button>

      {/* COMBAT button */}
      <button
        onClick={onToggleCombat}
        className="px-3 py-1 text-[10px] font-bold bg-red-900 text-textLight rounded hover:bg-red-700 transition-all shrink-0 whitespace-nowrap"
        title="Open Initiative and Combat turn tracker panel"
      >
        COMBAT
      </button>

      {/* Save Session */}
      <div className="h-5 w-px bg-borderDark opacity-50 shrink-0" />

      {/* SAVE SESSION button */}
      <button
        onClick={() => socket.emit('save_session')}
        className="px-3 py-1 text-[10px] font-bold bg-accentGold text-black rounded hover:bg-yellow-500 transition-all shrink-0 whitespace-nowrap"
        title="Save all active tokens, stamps, and note changes back to server data.json"
      >
        SAVE SESSION
      </button>

      {/* NETWORK TUNING button (DM only) */}
      <div className="h-5 w-px bg-borderDark opacity-50 shrink-0" />
      <button
        onClick={() => setShowNetworkPanel(true)}
        className="px-3 py-1 text-[10px] font-bold bg-borderDark text-textLight rounded hover:bg-gray-700 transition-all shrink-0 whitespace-nowrap"
        title="Adjust server network settings for high-ping players (ping timeout, interval, payload size)"
      >
        NETWORK
      </button>

      {/* Modals */}
      {showNetworkPanel && <DMNetworkPanel onClose={() => setShowNetworkPanel(false)} />}
      {showOptions && <OptionsModal onClose={() => setShowOptions(false)} />}
      {showWeatherPicker && <WeatherPicker onClose={() => setShowWeatherPicker(false)} />}
    </div>
    </>
  );
}