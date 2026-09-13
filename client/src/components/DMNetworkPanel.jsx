// client/src/components/DMNetworkPanel.jsx
import { useState, useEffect } from 'react';
import { socket } from '../socket';
import { SERVER_URL } from '../config';
import { useDraggableResizable } from '../hooks/useDraggableResizable';

export default function DMNetworkPanel({ onClose }) {
  const [settings, setSettings] = useState({
    pingTimeout: 60000,
    pingInterval: 25000,
    maxHttpBufferSize: 100000000,
    versionGapThreshold: 5
  });

  const { pos, size, handleMouseDown, handleResizeDown } = useDraggableResizable({
    initialPos: { x: window.innerWidth - 450, y: 100 },
    initialSize: { w: 340, h: 400 },
    minSize: { w: 280, h: 320 }
  });

  useEffect(() => {
    fetch(`${SERVER_URL}/api/network-settings`)
      .then(res => res.json())
      .then(data => {
        if (data && typeof data === 'object') {
          setSettings(prev => ({ ...prev, ...data }));
        }
      })
      .catch(err => console.error('[DMNetworkPanel] Failed to fetch network settings:', err));
  }, []);

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const applySettings = () => {
    socket.emit('update_network_settings', settings);
    onClose();
  };

  const formatBytes = (bytes) => {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${bytes} B`;
  };

  return (
    <div
      className="fixed z-[1200] bg-bgPanel border border-accentGold rounded-lg shadow-2xl flex flex-col overflow-hidden"
      style={{ left: pos.x, top: pos.y, width: size.w, height: size.h }}
      onMouseDown={handleMouseDown}
    >
      <header className="bg-bgCard p-3 flex justify-between items-center cursor-move border-b border-borderDark shrink-0">
        <span className="text-accentGold font-bold text-[10px] uppercase tracking-widest drag-handle">Network Tuning</span>
        <button onClick={onClose} className="text-textMuted hover:text-white px-2" type="button">✕</button>
      </header>

      <div className="flex-1 p-4 space-y-4 text-xs bg-[#0b0c10] overflow-y-auto">
        {/* Ping Timeout */}
        <div>
          <label className="text-textMuted block mb-1">Ping Timeout (ms)</label>
          <input
            type="range"
            min="10000"
            max="180000"
            step="5000"
            value={settings.pingTimeout}
            onChange={e => updateSetting('pingTimeout', parseInt(e.target.value, 10))}
            className="w-full accent-accentGold"
          />
          <div className="flex justify-between text-[9px] text-textMuted mt-1">
            <span>10s</span>
            <span>{settings.pingTimeout} ms</span>
            <span>180s</span>
          </div>
          <p className="text-[8px] text-textMuted mt-1">Max time before disconnecting inactive clients.</p>
        </div>

        {/* Ping Interval */}
        <div>
          <label className="text-textMuted block mb-1">Ping Interval (ms)</label>
          <input
            type="range"
            min="5000"
            max="60000"
            step="1000"
            value={settings.pingInterval}
            onChange={e => updateSetting('pingInterval', parseInt(e.target.value, 10))}
            className="w-full accent-accentGold"
          />
          <div className="flex justify-between text-[9px] text-textMuted mt-1">
            <span>5s</span>
            <span>{settings.pingInterval} ms</span>
            <span>60s</span>
          </div>
          <p className="text-[8px] text-textMuted mt-1">How often server pings clients to check connection.</p>
        </div>

        {/* Max Payload Size */}
        <div>
          <label className="text-textMuted block mb-1">Max Payload Size</label>
          <select
            value={settings.maxHttpBufferSize}
            onChange={e => updateSetting('maxHttpBufferSize', parseInt(e.target.value, 10))}
            className="w-full bg-bgCard text-white border border-borderDark rounded p-1 text-[10px]"
          >
            <option value={100000000}>100 MB (default)</option>
            <option value={200000000}>200 MB</option>
            <option value={500000000}>500 MB</option>
          </select>
          <p className="text-[8px] text-textMuted mt-1">Current: {formatBytes(settings.maxHttpBufferSize)}</p>
        </div>

        {/* Version Gap Threshold */}
        <div>
          <label className="text-textMuted block mb-1">Version Gap Threshold</label>
          <input
            type="range"
            min="1"
            max="20"
            step="1"
            value={settings.versionGapThreshold ?? 5}
            onChange={e => updateSetting('versionGapThreshold', parseInt(e.target.value, 10))}
            className="w-full accent-accentGold"
          />
          <div className="flex justify-between text-[9px] text-textMuted mt-1">
            <span>1 (strict)</span>
            <span>{settings.versionGapThreshold ?? 5}</span>
            <span>20 (loose)</span>
          </div>
          <p className="text-[8px] text-textMuted mt-1">Missed versions before forcing full resync.</p>
        </div>

        <button
          type="button"
          onClick={applySettings}
          className="w-full bg-accentGold text-black font-bold py-2 rounded text-[11px] hover:bg-yellow-500 transition-colors"
        >
          APPLY & CLOSE
        </button>
        <p className="text-[8px] text-textMuted text-center">Changes apply immediately without restart.</p>
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