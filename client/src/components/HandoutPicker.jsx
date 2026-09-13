// client/src/components/HandoutPicker.jsx
import { useEffect, useState } from 'react';
import { SERVER_URL } from '../config';
import { useDraggableResizable } from '../hooks/useDraggableResizable';
import MediaCard from './MediaCard';

export default function HandoutPicker({ onSelect, onClose }) {
  const [handouts, setHandouts] = useState([]);

  const { pos, size, handleMouseDown, handleResizeDown } = useDraggableResizable({
    initialPos: { x: window.innerWidth - 650, y: 100 },
    initialSize: { w: 520, h: 560 },
    minSize: { w: 320, h: 320 }
  });

  useEffect(() => {
    fetch(`${SERVER_URL}/api/handouts`)
      .then(res => res.json())
      .then(data => setHandouts(Array.isArray(data) ? data : []))
      .catch(err => console.error('[HandoutPicker] Error fetching handouts:', err));
  }, []);

  return (
    <div
      className="fixed z-[1000] bg-bgPanel border border-accentGold rounded-lg shadow-2xl flex flex-col overflow-hidden"
      style={{
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        width: `${size.w}px`,
        height: `${size.h}px`,
        userSelect: 'none',
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Draggable Header */}
      <header className="bg-bgCard p-3 flex justify-between items-center border-b border-borderDark shrink-0 cursor-move">
        <span className="text-accentGold font-bold text-[10px] uppercase tracking-widest drag-handle">
          Handout Library ({handouts.length})
        </span>
        <button
          onClick={onClose}
          className="text-textMuted hover:text-white text-xs px-2"
          type="button"
        >
          ✕
        </button>
      </header>

      {/* Scrollable Media Grid */}
      <div className="flex-1 p-3 overflow-y-auto bg-[#0b0c10]">
        {handouts.length === 0 && (
          <p className="text-[9px] text-textMuted text-center py-10 italic">
            Drop images or videos into /server/assets/handouts/
          </p>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 justify-start">
          {handouts.map(filename => {
            const url = `${SERVER_URL}/assets/handouts/${encodeURIComponent(filename)}`;
            return (
              <MediaCard
                key={filename}
                url={url}
                filename={filename}
                onClick={() => onSelect(url)}
                className="w-full"
              />
            );
          })}
        </div>
      </div>

      {/* Resize Handle */}
      <div
        className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize flex items-center justify-center group"
        onMouseDown={handleResizeDown}
      >
        <div className="w-1.5 h-1.5 bg-accentGold opacity-40 group-hover:opacity-100 rounded-full mr-1 mb-1 transition-opacity" />
      </div>
    </div>
  );
}