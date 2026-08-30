// client/src/components/DMNetworkPanel.jsx
import { useState, useEffect, useRef } from 'react';
import { socket } from '../socket';
import { SERVER_URL } from '../config';

export default function DMNetworkPanel({ onClose }) {
    const [settings, setSettings] = useState({
        pingTimeout: 60000,
        pingInterval: 25000,
        maxHttpBufferSize: 100000000,
        versionGapThreshold: 5
    });
    const [pos, setPos] = useState({ x: window.innerWidth - 450, y: 100 });
    const [size, setSize] = useState({ w: 340, h: 380 });
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const resizeStart = useRef({ w: 0, h: 0, mouseX: 0, mouseY: 0 });

    useEffect(() => {
        // Fetch current settings from server
        fetch(`${SERVER_URL}/api/network-settings`)
            .then(res => res.json())
            .then(data => setSettings(data))
            .catch(err => console.error('Failed to fetch network settings:', err));
    }, []);

    const updateSetting = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    const applySettings = () => {
        socket.emit('update_network_settings', settings);
        onClose(); // optional: close after apply
    };

    // Dragging logic
    const handleMouseDown = (e) => {
        if (e.target.tagName === 'HEADER' || e.target.parentElement?.tagName === 'HEADER') {
            setIsDragging(true);
            dragStart.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
        }
    };

    const handleResizeDown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsResizing(true);
        resizeStart.current = { w: size.w, h: size.h, mouseX: e.clientX, mouseY: e.clientY };
    };

    useEffect(() => {
        const move = (e) => {
            if (isDragging) setPos({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
            if (isResizing) setSize({
                w: Math.max(280, resizeStart.current.w + (e.clientX - resizeStart.current.mouseX)),
                h: Math.max(300, resizeStart.current.h + (e.clientY - resizeStart.current.mouseY))
            });
        };
        const up = () => { setIsDragging(false); setIsResizing(false); };
        if (isDragging || isResizing) {
            window.addEventListener('mousemove', move);
            window.addEventListener('mouseup', up);
        }
        return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    }, [isDragging, isResizing]);

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
                <span className="text-accentGold font-bold text-[10px] uppercase tracking-widest">Network Tuning</span>
                <button onClick={onClose} className="text-textMuted hover:text-white px-2">✕</button>
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
                        onChange={e => updateSetting('pingTimeout', parseInt(e.target.value))}
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
                        onChange={e => updateSetting('pingInterval', parseInt(e.target.value))}
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
                        onChange={e => updateSetting('maxHttpBufferSize', parseInt(e.target.value))}
                        className="w-full bg-bgCard text-white border border-borderDark rounded p-1 text-[10px]"
                    >
                        <option value={100000000}>100 MB (default)</option>
                        <option value={200000000}>200 MB</option>
                        <option value={500000000}>500 MB</option>
                    </select>
                    <p className="text-[8px] text-textMuted mt-1">Current: {formatBytes(settings.maxHttpBufferSize)}</p>
                </div>

                {/* NEW: Version Gap Threshold */}
                <div>
                    <label className="text-textMuted block mb-1">Version Gap Threshold</label>
                    <input
                        type="range"
                        min="1"
                        max="20"
                        step="1"
                        value={settings.versionGapThreshold ?? 5}
                        onChange={e => updateSetting('versionGapThreshold', parseInt(e.target.value))}
                        className="w-full accent-accentGold"
                    />
                    <div className="flex justify-between text-[9px] text-textMuted mt-1">
                        <span>1 (strict)</span>
                        <span>{settings.versionGapThreshold ?? 5}</span>
                        <span>20 (loose)</span>
                    </div>
                    <p className="text-[8px] text-textMuted mt-1">How many missed versions before forcing full resync. Higher values help high-ping players.</p>
                </div>

                <button
                    onClick={applySettings}
                    className="w-full bg-accentGold text-black font-bold py-2 rounded text-[11px] hover:bg-yellow-500 transition-colors"
                >
                    APPLY & CLOSE
                </button>
                <p className="text-[8px] text-textMuted text-center">Changes apply immediately without restart.</p>
            </div>

            {/* Resize handle */}
            <div
                className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize flex items-end justify-end p-1 group"
                onMouseDown={handleResizeDown}
            >
                <div className="w-2 h-2 border-r-2 border-b-2 border-accentGold opacity-30 group-hover:opacity-100" />
            </div>
        </div>
    );
}