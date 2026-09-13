// client/src/components/MonsterBrowser.jsx
import { useEffect, useState, useMemo } from 'react';
import { socket } from '../socket';
import { SERVER_URL } from '../config';
import { useTokenList, findMatchingToken } from '../hooks/useTokenList';
import { useDraggableResizable } from '../hooks/useDraggableResizable';

function MonsterAvatar({ name, tokenUrl }) {
  const [hasError, setHasError] = useState(false);

  // Reset error state if the resolved tokenUrl changes
  useEffect(() => {
    setHasError(false);
  }, [tokenUrl]);

  if (tokenUrl && !hasError) {
    return (
      <img
        src={tokenUrl}
        alt={name}
        loading="lazy"
        onError={() => setHasError(true)}
        className="w-10 h-10 rounded-full object-cover border border-borderDark shrink-0 bg-bgPanel"
      />
    );
  }

  const initial = name ? name.trim().charAt(0).toUpperCase() : '?';

  return (
    <div className="w-10 h-10 rounded-full bg-bgPanel border border-borderDark flex items-center justify-center text-accentGold font-extrabold text-sm shrink-0 select-none">
      {initial}
    </div>
  );
}

export default function MonsterBrowser({ onClose }) {
  const [monsters, setMonsters] = useState({});
  const [filterCR, setFilterCR] = useState('');
  const [filterType, setFilterType] = useState('');
  const [search, setSearch] = useState('');

  const { pos, size, handleMouseDown, handleResizeDown } = useDraggableResizable({
    initialPos: { x: 200, y: 100 },
    initialSize: { w: 650, h: 500 },
    minSize: { w: 400, h: 320 }
  });

  const { tokens: tokenList } = useTokenList();

  useEffect(() => {
    const baseUrl = (SERVER_URL || '').replace(/\/+$/, '');
    fetch(`${baseUrl}/api/monsters`)
      .then(r => r.json())
      .then(data => setMonsters(data.monsters || {}))
      .catch(() => setMonsters({}));
  }, []);

  const monsterList = useMemo(() => {
    return Object.entries(monsters)
      .filter(([name, m]) => {
        if (filterCR && String(m.cr ?? m.challenge_rating ?? '') !== filterCR) return false;
        if (filterType && m.type !== filterType) return false;
        if (search && !name.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => a[0].localeCompare(b[0]));
  }, [monsters, filterCR, filterType, search]);

  const addToTray = (name, data) => {
    const matchedToken = findMatchingToken(name, tokenList);
    const sizeValue = data?.size || 'medium';
    socket.emit('add_npcs', {
      creatures: [{
        name,
        avatarUrl: matchedToken || '',
        hp: data.hp,
        ac: data.ac,
        monsterData: data,
        size: sizeValue
      }]
    });
  };

  const crValues = useMemo(() => {
    return [...new Set(Object.values(monsters).map(m => String(m.cr ?? m.challenge_rating ?? '')))].filter(Boolean).sort((a, b) => {
      const num = (s) => (s.includes('/') ? 0.5 : parseFloat(s));
      return num(a) - num(b);
    });
  }, [monsters]);

  const types = useMemo(() => {
    return [...new Set(Object.values(monsters).map(m => m.type))].filter(Boolean).sort();
  }, [monsters]);

  return (
    <div
      className="fixed z-[1000] bg-bgPanel border border-accentGold rounded-lg shadow-2xl flex flex-col overflow-hidden"
      style={{ left: pos.x, top: pos.y, width: size.w, height: size.h }}
      onMouseDown={handleMouseDown}
    >
      {/* Draggable Header */}
      <header className="bg-bgCard p-3 flex justify-between items-center cursor-move border-b border-borderDark shrink-0 select-none">
        <span className="text-accentGold font-bold text-[10px] uppercase tracking-widest drag-handle">
          Monster Browser
        </span>
        <button onClick={onClose} className="text-textMuted hover:text-white px-2" type="button">✕</button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Filter sidebar */}
        <div className="w-40 bg-bgCard border-r border-borderDark p-2 space-y-2 overflow-y-auto shrink-0">
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-bgPanel text-white px-2 py-1 rounded text-[10px] border border-borderDark outline-none focus:border-accentGold"
          />
          <select
            value={filterCR}
            onChange={e => setFilterCR(e.target.value)}
            className="w-full bg-bgPanel text-white text-[10px] p-1 rounded border border-borderDark outline-none focus:border-accentGold"
          >
            <option value="">All CR</option>
            {crValues.map(cr => <option key={cr} value={cr}>CR {cr}</option>)}
          </select>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="w-full bg-bgPanel text-white text-[10px] p-1 rounded border border-borderDark outline-none focus:border-accentGold"
          >
            <option value="">All Types</option>
            {types.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* Monster list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-[#0b0c10]">
          {monsterList.length === 0 && (
            <p className="text-textMuted text-xs italic p-4 text-center">No monsters match your criteria.</p>
          )}

          {monsterList.map(([name, data]) => {
            const tokenUrl = findMatchingToken(name, tokenList);
            const speed = data.speed && typeof data.speed === 'object'
              ? Object.entries(data.speed).map(([kind, value]) => `${kind} ${value} ft`).join(', ')
              : data.speed;
            const abilities = [...(data.traits || []), ...(data.actions || [])]
              .slice(0, 3)
              .map(item => item.name)
              .filter(Boolean)
              .join(', ');

            return (
              <div
                key={name}
                onClick={() => addToTray(name, data)}
                className="flex items-center gap-3 bg-bgCard p-2 rounded border border-borderDark hover:border-accentGold cursor-pointer text-xs transition-all"
              >
                <MonsterAvatar name={name} tokenUrl={tokenUrl} />
                <div className="min-w-0 flex-1">
                  <div className="text-white font-bold truncate">{name}</div>
                  <div className="text-textMuted text-[9px] truncate">
                    {data.size || 'Medium'} {data.type || 'creature'} • {data.alignment || 'unaligned'}
                  </div>
                  <div className="text-textMuted text-[9px] truncate">
                    HP {data.hp ?? '—'} • AC {data.ac ?? '—'} • {data.traits?.length || 0} traits • {data.actions?.length || 0} actions
                  </div>
                  <div className="text-textMuted text-[9px] truncate">
                    {speed || 'Speed —'}{data.senses ? ` • Senses: ${Object.entries(data.senses).map(([key, value]) => `${key} ${value}`).join(', ')}` : ''}
                  </div>
                  {abilities && <div className="text-accentGold/80 text-[9px] truncate">Abilities: {abilities}</div>}
                </div>

                <span className="text-accentGold text-[10px] ml-2 whitespace-nowrap font-bold">
                  CR {data.cr ?? data.challenge_rating ?? '—'}
                </span>
              </div>
            );
          })}
        </div>
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