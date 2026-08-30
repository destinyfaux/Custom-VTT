// client/src/components/DMAudioDeck.jsx
import { useEffect, useState } from 'react';
import { socket } from '../socket';
import { SERVER_URL } from '../config';

export default function DMAudioDeck() {
    const [isOpen, setIsOpen] = useState(false);
    const [audioList, setAudioList] = useState({ music: [], sfx: [] });
    const [selectedMusic, setSelectedMusic] = useState('');
    const [musicVol, setMusicVol] = useState(0.5);
    const [isPlaying, setIsPlaying] = useState(false);
    
    const [selectedSfx, setSelectedSfx] = useState('');
    const [sfxVol, setSfxVol] = useState(0.8);
    const [sfxLoop, setSfxLoop] = useState(false);

    useEffect(() => {
        fetch(`${SERVER_URL}/api/audio`)
            .then(res => res.json())
            .then(data => {
                setAudioList(data);
                if(data.music.length > 0) setSelectedMusic(data.music[0]);
                if(data.sfx.length > 0) setSelectedSfx(data.sfx[0]);
            });
    }, []);

    // ★ SYNC WITH SERVER STATE UPON RECONNECTION / INITIAL LOAD
    useEffect(() => {
        const handleState = (state) => {
            if (state.audio?.music) {
                const { track, volume, isPlaying: serverIsPlaying } = state.audio.music;
                if (track) setSelectedMusic(track);
                setMusicVol(volume);
                setIsPlaying(serverIsPlaying);
            }
        };

        socket.on('state_update', handleState);
        return () => socket.off('state_update', handleState);
    }, []);

    const toggleMusic = () => {
        const nextPlaying = !isPlaying;
        setIsPlaying(nextPlaying);
        socket.emit('audio_music_update', { track: selectedMusic, volume: musicVol, isPlaying: nextPlaying });
    };

    const triggerSfx = () => {
        socket.emit('audio_play_sfx', { track: selectedSfx, volume: sfxVol, loop: sfxLoop });
    };

    return (
        <div className="bg-bgPanel rounded border border-borderDark mb-2 overflow-hidden">
            {/* Collapsible Header */}
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex justify-between items-center p-2 bg-bgCard hover:bg-borderDark transition-colors"
            >
                <h3 className="text-accentGold text-[10px] font-bold uppercase tracking-wider italic">Audio Controls</h3>
                <span className="text-accentGold text-xs">{isOpen ? '−' : '+'}</span>
            </button>

            {isOpen && (
                <div className="p-3 border-t border-borderDark animate-in slide-in-from-top-2 duration-200">
            {/* Music Section */}
            <div className="mb-4">
                        <div className="flex justify-between items-center mb-1">
                            <label className="text-textMuted uppercase text-[9px] font-bold">Ambient Music</label>
                            {isPlaying && <span className="text-green-500 text-[8px] animate-pulse">LIVE</span>}
                        </div>
                        <select 
                            className="w-full bg-bgPanel text-textLight p-1 mb-2 rounded border border-borderDark text-[10px] outline-none focus:border-accentGold" 
                            value={selectedMusic} 
                            onChange={(e) => setSelectedMusic(e.target.value)}
                        >
                    {audioList.music.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                        
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-[9px] text-textMuted w-4">Vol</span>
                            <input 
                                type="range" min="0" max="1" step="0.1" value={musicVol} 
                                className="flex-1 accent-accentGold h-1" 
                                onChange={(e) => setMusicVol(parseFloat(e.target.value))} 
                            />
                        </div>

                        <button 
                            className={`w-full font-bold py-1 rounded text-[10px] transition-colors ${isPlaying ? 'bg-red-900 text-textLight' : 'bg-accentGold text-black'}`} 
                            onClick={toggleMusic}
                        >
                    {isPlaying ? "STOP MUSIC" : "PLAY MUSIC"}
                </button>
            </div>

            {/* SFX Section */}
                    <div className="border-t border-borderDark pt-3">
                        <label className="text-textMuted uppercase text-[9px] font-bold block mb-1">Sound Effects</label>
                        <select 
                            className="w-full bg-bgPanel text-textLight p-1 mb-2 rounded border border-borderDark text-[10px] outline-none focus:border-accentGold" 
                            value={selectedSfx} 
                            onChange={(e) => setSelectedSfx(e.target.value)}
                        >
                    {audioList.sfx.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                        
                        <div className="flex items-center justify-between gap-4 mb-2">
                            <div className="flex items-center gap-2 flex-1">
                                <span className="text-[9px] text-textMuted">Vol</span>
                                <input 
                                    type="range" min="0" max="1" step="0.1" value={sfxVol} 
                                    className="flex-1 accent-accentGold h-1" 
                                    onChange={(e) => setSfxVol(parseFloat(e.target.value))} 
                                />
                            </div>
                            <label className="flex items-center gap-1 cursor-pointer group">
                                <input 
                                    type="checkbox" checked={sfxLoop} 
                                    className="accent-accentGold w-3 h-3"
                                    onChange={(e) => setSfxLoop(e.target.checked)} 
                                />
                                <span className="text-[9px] text-textMuted group-hover:text-textLight">Loop</span>
                            </label>
                        </div>

                        <button 
                            className="w-full bg-borderDark text-textLight font-bold py-1 rounded text-[10px] hover:bg-gray-700 transition-colors" 
                            onClick={triggerSfx}
                        >
                            TRIGGER SFX
                        </button>
                        
                        <button 
                            className="w-full mt-2 text-[8px] text-red-500 opacity-60 hover:opacity-100 underline uppercase tracking-tighter" 
                            onClick={() => socket.emit('audio_stop_sfx')}
                        >
                            Kill All Active SFX
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}