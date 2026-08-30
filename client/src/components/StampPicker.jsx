// client/src/components/StampPicker.jsx
import { useEffect, useState, useRef } from 'react';
import { SERVER_URL } from '../config';

// Helper to identify video formats
const isVideoFormat = (filename) => {
  if (!filename) return false;
  const path = filename.split('?')[0];
  return /\.(webm|mp4)$/i.test(path);
};

export default function StampPicker({ onSelect, onClose }) {
  const [stamps, setStamps] = useState([]);
  const [pos, setPos] = useState({ x: window.innerWidth - 700, y: 100 });
  const [size, setSize] = useState({ w: 350, h: 700 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  const dragStart = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ w: 0, h: 0, mouseX: 0, mouseY: 0 });

  useEffect(() => {
    fetch(`${SERVER_URL}/api/stamps`)
      .then(res => res.json())
      .then(data => setStamps(data))
      .catch(err => console.error("Error fetching stamps:", err));
  }, []);

  const handlePick = (filename) => {
    const url = `${SERVER_URL}/assets/stamps/${encodeURIComponent(filename)}`;

    if (isVideoFormat(filename)) {
      // Create a temporary video element to extract dimensions
      const video = document.createElement('video');
      video.src = url;
      video.preload = 'metadata'; // Instruct the browser to load only metadata (dimensions)
      video.crossOrigin = 'anonymous';
      
      video.onloadedmetadata = () => {
        onSelect({ url, width: video.videoWidth, height: video.videoHeight });
      };
      
      video.onerror = () => {
        // Fallback size if dimensions fail to extract
        console.warn(`[StampPicker] Failed to extract dimensions for video: ${url}`);
        onSelect({ url, width: 0, height: 0 });
      };
    } else {
      // Standard image width/height loader
    const img = new Image();
      img.crossOrigin = 'anonymous';
    img.onload = () => {
      onSelect({ url, width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
        console.warn(`[StampPicker] Failed to load static image: ${url}`);
      onSelect({ url, width: 0, height: 0 });
    };
    img.src = url;
    }
  };

  // --- DRAG LOGIC ---
  const handleMouseDown = (e) => {
    if (e.target.tagName === 'HEADER' || e.target.parentElement.tagName === 'HEADER') {
      setIsDragging(true);
      dragStart.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    }
  };

  // --- RESIZE LOGIC ---
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
          w: Math.max(200, resizeStart.current.w + deltaW),
          h: Math.max(200, resizeStart.current.h + deltaH)
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
        <span className="text-accentGold font-bold text-[10px] uppercase tracking-widest">Stamp Library</span>
        <button onClick={onClose} className="text-textMuted hover:text-white text-xs px-2">✕</button>
      </header>

      {/* Scrollable Content */}
      <div className="flex-1 p-3 overflow-y-auto grid grid-cols-3 gap-2 scrollbar-hide bg-[#0b0c10]">
        {stamps.length === 0 && (
          <p className="col-span-full text-[9px] text-textMuted text-center py-10 italic">
            Drop images in /server/assets/stamps/
          </p>
        )}
        {stamps.map(filename => {
          const isVideo = isVideoFormat(filename);
          const assetUrl = `${SERVER_URL}/assets/stamps/${encodeURIComponent(filename)}`;
          
          return (
          <button
            key={filename}
            onClick={() => handlePick(filename)}
            className="aspect-square rounded border border-borderDark overflow-hidden hover:border-accentGold transition-all bg-bgCard hover:scale-105"
          >
              {isVideo ? (
                // Play animations directly inside the selector panel so DMs can see what they are picking
                <video
                  src={assetUrl}
                  muted
                  loop
                  playsInline
                  autoPlay
                  crossOrigin="anonymous"
                  className="w-full h-full object-contain pointer-events-none"
                />
              ) : (
            <img
                  src={assetUrl}
              alt={filename}
                  crossOrigin="anonymous"
              className="w-full h-full object-contain"
            />
              )}
          </button>
          );
        })}
      </div>

      {/* Resize Handle */}
      <div
        className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize flex items-center justify-center group"
        onMouseDown={handleResizeDown}
      >
        <div className="w-1 h-1 bg-accentGold opacity-30 group-hover:opacity-100 rounded-full mr-1 mb-1"></div>
      </div>
    </div>
  );
}