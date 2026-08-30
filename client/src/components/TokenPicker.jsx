// client/src/components/TokenPicker.jsx
import { useEffect, useState, useRef } from 'react';
import { SERVER_URL } from '../config';

export default function TokenPicker({ onSelect, onClose }) {
  const [tokens, setTokens] = useState([]);
  const [pos, setPos] = useState({ x: window.innerWidth - 700, y: 100 });
  const [size, setSize] = useState({ w: 400, h: 500 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  
  const dragStart = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ w: 0, h: 0, mouseX: 0, mouseY: 0 });

  useEffect(() => {
    fetch(`${SERVER_URL}/api/tokens`)
      .then(res => res.json())
      .then(data => setTokens(data))
      .catch(err => console.error("Error fetching token library:", err));
  }, []);

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
        <span className="text-accentGold font-bold text-[10px] uppercase tracking-widest pointer-events-none">
          Token Library ({tokens.length})
        </span>
        <button onClick={onClose} className="text-textMuted hover:text-white text-xs px-2">✕</button>
      </header>
      
      {/* Scrollable Content – Grid with labels */}
      <div className="flex-1 p-3 overflow-y-auto bg-[#0b0c10]">
        {tokens.length === 0 && (
          <p className="text-[9px] text-textMuted text-center py-10 italic">
            Drop images in /server/assets/tokens/
          </p>
        )}
        
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
          {tokens.map(filename => {
            // Get file name without extension for label
            const label = filename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
            const imageUrl = `${SERVER_URL}/assets/tokens/${filename}`;
            
            return (
              <button
                key={filename}
                onClick={() => onSelect(imageUrl)}
                className="group flex flex-col items-center bg-bgCard rounded-lg border border-borderDark hover:border-accentGold transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-accentGold overflow-hidden"
              >
                <div className="w-full aspect-square bg-bgPanel flex items-center justify-center p-1">
                  <img
                    src={imageUrl}
                    alt={filename}
                    className="w-full h-full object-contain rounded"
                    loading="lazy"
                  />
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