// client/src/components/HandoutPicker.jsx
import { useEffect, useState, useRef } from 'react';
import { SERVER_URL } from '../config';

export default function HandoutPicker({ onSelect, onClose }) {
  const [handouts, setHandouts] = useState([]);
  const [pos, setPos] = useState({ x: window.innerWidth - 700, y: 100 });
  const [size, setSize] = useState({ w: 500, h: 550 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  const dragStart = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ w: 0, h: 0, mouseX: 0, mouseY: 0 });

  useEffect(() => {
    fetch(`${SERVER_URL}/api/handouts`)
      .then(res => res.json())
      .then(data => setHandouts(data))
      .catch(err => console.error("Error fetching handouts:", err));
  }, []);

  // ---- DRAG (only on the title span) ----
  const handleDragStart = (e) => {
    if (e.target.classList.contains('drag-handle')) {
      setIsDragging(true);
      dragStart.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    }
  };

  // ---- RESIZE ----
  const handleResizeDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeStart.current = { w: size.w, h: size.h, mouseX: e.clientX, mouseY: e.clientY };
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging) {
        setPos({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
      }
      if (isResizing) {
        const deltaW = e.clientX - resizeStart.current.mouseX;
        const deltaH = e.clientY - resizeStart.current.mouseY;
        setSize({
          w: Math.max(350, resizeStart.current.w + deltaW),
          h: Math.max(350, resizeStart.current.h + deltaH),
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing]);

  // Helper to detect video files
  const isVideo = (filename) => {
    const videoExtensions = ['.mp4', '.webm', '.mov', '.ogg'];
    return videoExtensions.some(ext => filename.toLowerCase().endsWith(ext));
  };

  const getLabel = (filename) => {
    return filename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
  };

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
      onMouseDown={handleDragStart}
    >
      {/* Header – drag only on the title */}
      <header className="bg-bgCard p-3 flex justify-between items-center border-b border-borderDark shrink-0">
        <span className="text-accentGold font-bold text-[10px] uppercase tracking-widest cursor-move drag-handle">
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

      {/* Scrollable Content – Fixed‑size flex grid */}
      <div className="flex-1 p-3 overflow-y-auto bg-[#0b0c10]">
        {handouts.length === 0 && (
          <p className="text-[9px] text-textMuted text-center py-10 italic">
            Drop images or videos in /server/assets/handouts/
          </p>
        )}

        <div className="flex flex-wrap gap-3 justify-start">
          {handouts.map(filename => {
            const url = `${SERVER_URL}/assets/handouts/${filename}`;
            const label = getLabel(filename);
            const video = isVideo(filename);

            return (
              <button
                key={filename}
                onClick={() => onSelect(url)}
                className="group flex flex-col items-center bg-bgCard rounded-lg border border-borderDark hover:border-accentGold transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-accentGold overflow-hidden flex-shrink-0 w-[250px]"
                type="button"
              >
                <div className="w-[250px] h-[250px] bg-bgPanel flex items-center justify-center p-0.5 relative">
                  {video ? (
                    <>
                      <video
                        src={url}
                        className="w-full h-full object-contain rounded"
                        muted
                        playsInline
                      />
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                        <span className="text-white text-2xl">▶</span>
                      </div>
                    </>
                  ) : (
                    <img
                      src={url}
                      alt={filename}
                      className="w-full h-full object-contain rounded"
                      loading="lazy"
                    />
                  )}
                </div>
                <span className="text-[8px] text-textMuted truncate w-full text-center px-1 py-0.5 group-hover:text-white transition-colors">
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Resize Handle */}
      <div
        className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize flex items-center justify-center group"
        onMouseDown={handleResizeDown}
      >
        <div className="w-1.5 h-1.5 bg-accentGold opacity-40 group-hover:opacity-100 rounded-full mr-1 mb-1 transition-opacity"></div>
      </div>
    </div>
  );
}