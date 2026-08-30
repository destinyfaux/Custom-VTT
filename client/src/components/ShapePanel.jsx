// client/src/components/ShapePanel.jsx
import { useState, useRef, useEffect } from 'react';
import { socket } from '../socket';
import soundSynthesizer from '../utils/SoundSynthesizer';

const SHAPES = [
  { id: 'circle', label: 'Circle' },
  { id: 'rectangle', label: 'Rectangle' },
  { id: 'cone', label: 'Cone' },
  { id: 'line', label: 'Line' },
];

const COLORS = [
  '#e6b422', // gold
  '#ff4444', // red
  '#44ff44', // green
  '#4488ff', // blue
  '#ff44ff', // magenta
  '#44ffff', // cyan
  '#ff8800', // orange
  '#ffffff', // white
];

export default function ShapePanel({
  onClose,
  selectedShape,
  selectedColor,
  onSelectShape,
  onSelectColor,
  shapeMode = 'draw', // 'draw' | 'move'
  onSelectMode,
}) {
  const [pos, setPos] = useState({ x: window.innerWidth - 450, y: 120 });
  const [size, setSize] = useState({ w: 320, h: 540 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ w: 0, h: 0, mx: 0, my: 0 });

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
    resizeStart.current = { w: size.w, h: size.h, mx: e.clientX, my: e.clientY };
  };

  useEffect(() => {
    const move = (e) => {
      if (isDragging) setPos({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
      if (isResizing) {
        setSize({
          w: Math.max(260, resizeStart.current.w + (e.clientX - resizeStart.current.mx)),
          h: Math.max(340, resizeStart.current.h + (e.clientY - resizeStart.current.my)),
        });
      }
    };
    const up = () => { setIsDragging(false); setIsResizing(false); };
    if (isDragging || isResizing) {
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
    }
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, [isDragging, isResizing]);

  return (
    <div
      className="fixed z-[1100] bg-bgPanel border border-accentGold rounded-lg shadow-2xl flex flex-col overflow-hidden"
      style={{ left: pos.x, top: pos.y, width: size.w, height: size.h }}
      onMouseDown={handleMouseDown}
    >
      <header className="bg-bgCard p-3 flex justify-between items-center cursor-move border-b border-borderDark shrink-0">
        <span className="text-accentGold font-bold text-[10px] uppercase tracking-widest">Shape Tool</span>
        <button
          onClick={() => {
            soundSynthesizer.playUIClick();
            onClose();
          }}
          className="text-textMuted hover:text-white px-2"
        >
          ✕
        </button>
      </header>

      <div className="flex-1 p-4 overflow-y-auto bg-[#0b0c10] space-y-4">
        {/* MODE TOGGLE: Draw vs Move */}
        <div>
          <div className="text-textMuted text-[10px] uppercase font-bold mb-2 tracking-widest">Action Mode</div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                soundSynthesizer.playUIClick();
                onSelectMode?.('draw');
              }}
              className={`py-2 px-2 rounded text-[10px] font-bold border transition-all flex items-center justify-center gap-1.5 ${
                shapeMode === 'draw'
                  ? 'bg-accentGold text-black border-accentGold shadow-md font-extrabold'
                  : 'bg-bgCard text-textLight border-borderDark hover:border-accentGold/50'
              }`}
            >
              <span>✏️</span>
              <span>Draw / Place</span>
            </button>

            <button
              onClick={() => {
                soundSynthesizer.playUIClick();
                onSelectMode?.('move');
              }}
              className={`py-2 px-2 rounded text-[10px] font-bold border transition-all flex items-center justify-center gap-1.5 ${
                shapeMode === 'move'
                  ? 'bg-accentGold text-black border-accentGold shadow-md font-extrabold'
                  : 'bg-bgCard text-textLight border-borderDark hover:border-accentGold/50'
              }`}
            >
              <span>✋</span>
              <span>Move Shapes</span>
            </button>
          </div>
        </div>

        {/* Shape Type (Enabled during Draw Mode) */}
        <div className={shapeMode === 'move' ? 'opacity-40 pointer-events-none' : ''}>
          <div className="text-textMuted text-[10px] uppercase font-bold mb-2 tracking-widest">Shape Template</div>
          <div className="grid grid-cols-2 gap-2">
            {SHAPES.map((shape) => (
              <button
                key={shape.id}
                onClick={() => {
                  soundSynthesizer.playUIClick();
                  onSelectShape(shape.id);
                }}
                className={`py-1.5 px-2 rounded text-[10px] font-bold border transition-all ${
                  selectedShape === shape.id
                    ? 'bg-accentGold text-black border-accentGold'
                    : 'bg-bgCard text-textLight border-borderDark hover:border-accentGold/50'
                }`}
              >
                {shape.label}
              </button>
            ))}
          </div>
        </div>

        {/* Color (Enabled during Draw Mode) */}
        <div className={shapeMode === 'move' ? 'opacity-40 pointer-events-none' : ''}>
          <div className="text-textMuted text-[10px] uppercase font-bold mb-2 tracking-widest">Color</div>
          <div className="grid grid-cols-4 gap-2">
            {COLORS.map((color) => (
              <button
                key={color}
                onClick={() => {
                  soundSynthesizer.playUIClick();
                  onSelectColor(color);
                }}
                className={`w-10 h-10 rounded-full border-2 transition-all ${
                  selectedColor === color
                    ? 'border-white ring-2 ring-accentGold scale-105'
                    : 'border-borderDark hover:border-accentGold/50'
                }`}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
        </div>

        {/* Dynamic Instructions */}
        <div className="bg-bgCard/50 p-2.5 rounded border border-borderDark text-[9px] text-textMuted space-y-1">
          {shapeMode === 'draw' ? (
            <>
              <p>• <b>Click &amp; drag</b> on the canvas to draw a shape.</p>
              <p>• Right‑click any shape to delete it.</p>
              <p>• Switch to <b>Move Shapes</b> above to reposition existing shapes.</p>
            </>
          ) : (
            <>
              <p className="text-accentGold font-bold">• ✋ Move mode is active!</p>
              <p>• Click &amp; drag any shape to move it across the map.</p>
              <p className="italic text-textMuted">• When closed or in Draw mode, shapes lock in place and clicks pass through to tokens.</p>
            </>
          )}
        </div>

        {/* Clear Shapes Button */}
        <button
          onClick={() => {
            soundSynthesizer.playUIClick();
            socket.emit('clear_my_shapes');
          }}
          className="w-full bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-900/50 font-bold py-2 rounded text-[11px] transition-all"
        >
          🗑️ Clear My Shapes
        </button>

        <button
          onClick={() => {
            soundSynthesizer.playUIClick();
            onClose();
          }}
          className="w-full bg-borderDark text-white font-bold py-2 rounded text-[11px] hover:bg-gray-700 transition-colors"
        >
          Close Panel
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