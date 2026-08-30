import { useEffect, useState, useRef, useMemo } from 'react';
import { socket } from '../socket';
import { SERVER_URL } from '../config';
import { useTokenList, findMatchingToken } from '../hooks/useTokenList';

export default function MonsterBrowser({ onClose }) {
    const [monsters, setMonsters] = useState({});
    const [filterCR, setFilterCR] = useState('');
    const [filterType, setFilterType] = useState('');
    const [search, setSearch] = useState('');
    const [pos, setPos] = useState({ x: 200, y: 100 });
    const [size, setSize] = useState({ w: 650, h: 500 });
    const [dragging, setDragging] = useState(false);
    const [resizing, setResizing] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const resizeStart = useRef({ w: 0, h: 0, mx: 0, my: 0 });

    // Get the list of available token filenames for auto-assigning avatars
    const { tokens: tokenList } = useTokenList();

    useEffect(() => {
        fetch(`${SERVER_URL}/api/monsters`)
            .then(r => r.json())
            .then(data => setMonsters(data.monsters || {}))
            .catch(() => setMonsters({}));
    }, []);

    const monsterList = useMemo(() => {
        return Object.entries(monsters)
            .filter(([name, m]) => { // ★ FIXED: Correctly destructure 'name' here
                if (filterCR && String(m.challenge_rating) !== filterCR) return false;
                if (filterType && m.type !== filterType) return false;
                if (search && !name.toLowerCase().includes(search.toLowerCase())) return false;
                return true;
            })
            .sort((a, b) => a[0].localeCompare(b[0]));
    }, [monsters, filterCR, filterType, search]);

    const addToTray = (name, data) => {
        let avatarUrl = '';
        const matched = findMatchingToken(name, tokenList);
        if (matched) avatarUrl = matched;
        const sizeValue = data?.size || 'medium';
        socket.emit('add_npcs', {
            creatures: [{
                name,
                avatarUrl,
                hp: data.hp,
                ac: data.ac,
                monsterData: data,
                size: sizeValue
            }]
        });
    };

    // Drag & resize handlers (standard pattern)
    const handleDragDown = (e) => {
        if (e.target.tagName === 'HEADER' || e.target.parentElement?.tagName === 'HEADER') {
            setDragging(true);
            dragStart.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
        }
    };
    const handleResizeDown = (e) => {
        e.preventDefault(); e.stopPropagation();
        setResizing(true);
        resizeStart.current = { w: size.w, h: size.h, mx: e.clientX, my: e.clientY };
    };
    useEffect(() => {
        const move = (e) => {
            if (dragging) setPos({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
            if (resizing) setSize({ w: Math.max(400, resizeStart.current.w + e.clientX - resizeStart.current.mx), h: Math.max(300, resizeStart.current.h + e.clientY - resizeStart.current.my) });
        };
        const up = () => { setDragging(false); setResizing(false); };
        if (dragging || resizing) {
            window.addEventListener('mousemove', move);
            window.addEventListener('mouseup', up);
        }
        return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    }, [dragging, resizing]);

    const crValues = [...new Set(Object.values(monsters).map(m => String(m.challenge_rating)))].sort((a,b) => {
        const num = (s) => s.includes('/') ? 0.5 : parseFloat(s);
        return num(a) - num(b);
    });
    const types = [...new Set(Object.values(monsters).map(m => m.type))].sort();

    return (
        <div
            className="fixed z-[1000] bg-bgPanel border border-accentGold rounded-lg shadow-2xl flex flex-col overflow-hidden"
            style={{ left: pos.x, top: pos.y, width: size.w, height: size.h }}
            onMouseDown={handleDragDown}
        >
            <header className="bg-bgCard p-3 flex justify-between items-center cursor-move border-b border-borderDark shrink-0">
                <span className="text-accentGold font-bold text-[10px] uppercase tracking-widest">Monster Browser</span>
                <button onClick={onClose} className="text-textMuted hover:text-white px-2">✕</button>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* Filter sidebar */}
                <div className="w-40 bg-bgCard border-r border-borderDark p-2 space-y-2 overflow-y-auto">
                    <input
                        type="text"
                        placeholder="Search..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full bg-bgPanel text-white px-1 py-0.5 rounded text-[10px] border border-borderDark"
                    />
                    <select value={filterCR} onChange={e => setFilterCR(e.target.value)} className="w-full bg-bgPanel text-white text-[10px] p-1 rounded border border-borderDark">
                        <option value="">All CR</option>
                        {crValues.map(cr => <option key={cr} value={cr}>CR {cr}</option>)}
                    </select>
                    <select value={filterType} onChange={e => setFilterType(e.target.value)} className="w-full bg-bgPanel text-white text-[10px] p-1 rounded border border-borderDark">
                        <option value="">All Types</option>
                        {types.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>

                {/* Monster list */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {monsterList.length === 0 && <p className="text-textMuted text-xs italic p-4">No monsters match.</p>}
                    {monsterList.map(([name, data]) => (
                        <div
                            key={name}
                            onClick={() => addToTray(name, data)}
                            className="flex items-center justify-between bg-bgCard p-2 rounded border border-borderDark hover:border-accentGold cursor-pointer text-xs"
                        >
                            <span className="text-white truncate">{name}</span>
                            <span className="text-accentGold text-[10px] ml-2 whitespace-nowrap">CR {data.challenge_rating}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize" onMouseDown={handleResizeDown}>
                <div className="w-2 h-2 border-r-2 border-b-2 border-accentGold ml-auto mt-auto mr-1 mb-1 opacity-30" />
            </div>
        </div>
    );
}