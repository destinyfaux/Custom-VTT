// client/src/components/OptionsModal.jsx
import { useState, useEffect, useRef } from 'react';
import { applyTheme, getThemeOptions, getStoredTheme } from '../utils/theme';
import { socket } from '../socket';

const STORAGE_KEY = 'vtt_ui_settings';

export default function OptionsModal({ onClose }) {
    const isDM = localStorage.getItem('vtt_role') === 'DM';

    const [settings, setSettings] = useState(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) { return {}; }
        }
        return {
            uiFontScale: 1.0,
            theme: getStoredTheme(),
            proceduralAudio: true,
            pingColor: localStorage.getItem('vtt_ping_color') || '#e6b422'
        };
    });

    const [webhookUrl, setWebhookUrl] = useState('');
    const [testSent, setTestSent] = useState(false);

    const [pos, setPos] = useState({ x: window.innerWidth - 500, y: 120 });
    const [size, setSize] = useState({ w: 360, h: 580 });
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const resizeStart = useRef({ w: 0, h: 0, mouseX: 0, mouseY: 0 });

    // Sync webhook from server state if available
    useEffect(() => {
        const handleState = (state) => {
            if (state && state.discordWebhookUrl !== undefined) {
                setWebhookUrl(state.discordWebhookUrl);
            }
        };

        socket.on('init_state', handleState);
        socket.on('state_update', handleState);

        return () => {
            socket.off('init_state', handleState);
            socket.off('state_update', handleState);
        };
    }, []);

    const applySettings = (newSettings) => {
        // Font scale
        document.documentElement.style.setProperty('--ui-font-scale', newSettings.uiFontScale);
        // Theme
        applyTheme(newSettings.theme || 'default');
        // Audio toggle
        localStorage.setItem('vtt_procedural_audio', newSettings.proceduralAudio ? 'true' : 'false');
        // Ping color
        localStorage.setItem('vtt_ping_color', newSettings.pingColor);
        // Save all settings
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
    };

    // Apply on mount and when settings change
    useEffect(() => {
        applySettings(settings);
    }, [settings]);

    const updateSetting = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    const handleSaveWebhook = (url) => {
        setWebhookUrl(url);
        socket.emit('update_discord_webhook', url);
    };

    const handleTestWebhook = () => {
        socket.emit('test_discord_webhook');
        setTestSent(true);
        setTimeout(() => setTestSent(false), 3000);
    };

    // Dragging & resizing
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
                w: Math.max(300, resizeStart.current.w + (e.clientX - resizeStart.current.mouseX)),
                h: Math.max(400, resizeStart.current.h + (e.clientY - resizeStart.current.mouseY))
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
                <span className="text-accentGold font-bold text-[10px] uppercase tracking-widest">Settings</span>
                <button onClick={onClose} className="text-textMuted hover:text-textLight px-2">✕</button>
            </header>

            <div className="flex-1 p-4 space-y-4 text-xs bg-bgDark overflow-y-auto">
                {/* UI Font Scale */}
                <div>
                    <label className="text-textMuted block mb-1">UI Font Size</label>
                    <input
                        type="range"
                        min="0.8"
                        max="1.3"
                        step="0.02"
                        value={settings.uiFontScale}
                        onChange={e => updateSetting('uiFontScale', parseFloat(e.target.value))}
                        className="w-full accent-accentGold"
                    />
                    <div className="flex justify-between text-[9px] text-textMuted mt-1">
                        <span>Smaller</span>
                        <span>{Math.round(settings.uiFontScale * 100)}%</span>
                        <span>Larger</span>
                    </div>
                    <p className="text-[8px] text-textMuted mt-1">Adjusts sidebar, chat, and button text.</p>
                </div>

                {/* Theme Toggle */}
                <div>
                    <label className="text-textMuted block mb-1">Theme</label>
                    <div className="grid grid-cols-3 gap-1.5">
                        {getThemeOptions().map((option) => (
                            <button
                                key={option.value}
                                onClick={() => updateSetting('theme', option.value)}
                                className={`py-1 rounded text-[10px] font-bold truncate transition-all ${
                                    settings.theme === option.value
                                        ? 'bg-accentGold text-black shadow-md'
                                        : 'bg-bgCard text-textLight hover:bg-borderDark'
                                }`}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                    <p className="text-[8px] text-textMuted mt-1">Switch the UI mood for a session without changing your layout.</p>
                </div>

                {/* Procedural Audio Toggle */}
                <div>
                    <label className="text-textMuted block mb-1">Procedural Audio</label>
                    <div className="flex gap-2">
                        <button
                            onClick={() => updateSetting('proceduralAudio', true)}
                            className={`flex-1 py-1 rounded text-[10px] font-bold ${settings.proceduralAudio === true ? 'bg-accentGold text-black' : 'bg-bgCard text-textLight hover:bg-borderDark'}`}
                        >
                            On
                        </button>
                        <button
                            onClick={() => updateSetting('proceduralAudio', false)}
                            className={`flex-1 py-1 rounded text-[10px] font-bold ${settings.proceduralAudio === false ? 'bg-accentGold text-black' : 'bg-bgCard text-textLight hover:bg-borderDark'}`}
                        >
                            Off
                        </button>
                    </div>
                    <p className="text-[8px] text-textMuted mt-1">Sound effects for damage, healing, dice, etc.</p>
                </div>

                {/* Ping Color Picker */}
                <div>
                    <label className="text-textMuted block mb-1">Ping Color</label>
                    <input
                        type="color"
                        value={settings.pingColor || '#e6b422'}
                        onChange={e => updateSetting('pingColor', e.target.value)}
                        className="w-full h-8 bg-bgCard border border-borderDark rounded cursor-pointer"
                    />
                    <p className="text-[8px] text-textMuted mt-1">Your ping marker color (visible to all).</p>
                </div>

                {/* DM-ONLY DISCORD WEBHOOK SECTION */}
                {isDM && (
                    <div className="pt-3 border-t border-borderDark">
                        <div className="flex items-center justify-between mb-1">
                            <label className="text-accentGold font-bold uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                                <span>💬</span> Discord Webhook (DM Only)
                            </label>
                        </div>
                        <input
                            type="password"
                            placeholder="https://discord.com/api/webhooks/..."
                            value={webhookUrl}
                            onChange={(e) => handleSaveWebhook(e.target.value)}
                            className="w-full p-2 bg-bgCard text-white text-[10px] rounded border border-borderDark focus:outline-none focus:border-accentGold font-mono"
                        />
                        <div className="flex items-center justify-between mt-2">
                            <button
                                onClick={handleTestWebhook}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1 px-3 rounded text-[10px] transition-colors"
                            >
                                {testSent ? '✓ Ping Sent!' : 'Send Test Ping'}
                            </button>
                            <span className="text-[8px] text-textMuted italic">
                                Automatically logs rolls & global chat
                            </span>
                        </div>
                    </div>
                )}

                <button
                    onClick={onClose}
                    className="w-full bg-borderDark text-textLight font-bold py-2 rounded text-[11px] hover:bg-gray-700 transition-colors mt-2"
                >
                    CLOSE
                </button>
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