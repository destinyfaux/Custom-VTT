// client/src/components/StampPicker.jsx
import { useEffect, useState } from 'react';
import { SERVER_URL } from '../config';
import { useDraggableResizable } from '../hooks/useDraggableResizable';
import { extractMediaDimensions } from '../utils/mediaUtils';
import MediaCard from './MediaCard';

export default function StampPicker({ onSelect, onClose }) {
  const [stamps, setStamps] = useState([]);

  const { pos, size, handleMouseDown, handleResizeDown } = useDraggableResizable({
    initialPos: { x: window.innerWidth - 450, y: 100 },
    initialSize: { w: 360, h: 600 },
    minSize: { w: 240, h: 300 }
  });

  useEffect(() => {
    fetch(`${SERVER_URL}/api/stamps`)
      .then(res => res.json())
      .then(data => setStamps(Array.isArray(data) ? data : []))
      .catch(err => console.error('[StampPicker] Error fetching stamps:', err));
  }, []);

  const handlePick = async (filename) => {
    const url = `${SERVER_URL}/assets/stamps/${encodeURIComponent(filename)}`;
    const { width, height } = await extractMediaDimensions(url);
    onSelect({ url, width, height });
  };

  return (
    <div
      className="fixed z-[1000] bg-bgPanel border border-accentGold rounded-lg shadow-2xl flex flex-col overflow-hidden"
      style={{
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        width: `${size.w}px`,
        height: `${size.h}px`,
        userSelect: 'none'
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Draggable Header */}
      <header className="bg-bgCard p-3 flex justify-between items-center cursor-move border-b border-borderDark shrink-0">
        <span className="text-accentGold font-bold text-[10px] uppercase tracking-widest drag-handle">
          Stamp Library ({stamps.length})
        </span>
        <button onClick={onClose} className="text-textMuted hover:text-white text-xs px-2" type="button">
          ✕
        </button>
      </header>

      {/* Scrollable Media Grid */}
      <div className="flex-1 p-3 overflow-y-auto grid grid-cols-3 gap-2.5 bg-[#0b0c10]">
        {stamps.length === 0 && (
          <p className="col-span-full text-[9px] text-textMuted text-center py-10 italic">
            Drop images or videos into /server/assets/stamps/
          </p>
        )}
        {stamps.map(filename => {
          const url = `${SERVER_URL}/assets/stamps/${encodeURIComponent(filename)}`;
          return (
            <MediaCard
              key={filename}
              url={url}
              filename={filename}
              showLabel={false}
              onClick={() => handlePick(filename)}
              className="w-full"
            />
          );
        })}
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