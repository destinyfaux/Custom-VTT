// client/src/components/FXPanel.jsx
import { useState, useRef, useEffect } from 'react';
import soundSynthesizer from '../utils/SoundSynthesizer';

const SHAPES = [
  { id: 'AOE', label: 'AOE (Circle)' },
  { id: 'Cone', label: 'Cone (60°)' },
  { id: 'Beam', label: 'Beam' },
  { id: 'Missile', label: 'Missile' },
  { id: 'Burn', label: 'Burn' },
  { id: 'Glow', label: 'Glow' },
  { id: 'Slash', label: 'Slash' },
  { id: 'Smash', label: 'Smash' },
  { id: 'Pulse', label: 'Pulse' },
  { id: 'Ring', label: 'Ring' },
];

const STYLES = [
  { id: 'fire', label: 'Fire' },
  { id: 'water', label: 'Water' },
  { id: 'blood', label: 'Blood' },
  { id: 'holy', label: 'Holy' },
  { id: 'dark', label: 'Dark' },
  { id: 'frost', label: 'Frost' },
  { id: 'acid', label: 'Acid' },
  { id: 'smoke', label: 'Smoke' },
  { id: 'slash', label: 'Slash Spark' },
  { id: 'impact', label: 'Impact Dust' },
  { id: 'lightning', label: 'Lightning' },
  { id: 'force', label: 'Force' },
];

export default function FXPanel({
  onClose,
  selectedShape,
  selectedStyle,
  onSelectShape,
  onSelectStyle,
}) {
  const [pos, setPos] = useState({ x: window.innerWidth - 450, y: 120 });
  const [size, setSize] = useState({ w: 340, h: 700 });
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
          w: Math.max(280, resizeStart.current.w + (e.clientX - resizeStart.current.mx)),
          h: Math.max(350, resizeStart.current.h + (e.clientY - resizeStart.current.my)),
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
        <span className="text-accentGold font-bold text-[10px] uppercase tracking-widest">Spell FX</span>
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
        {/* Shape Selector */}
        <div>
          <div className="text-textMuted text-[10px] uppercase font-bold mb-2 tracking-widest">Shape</div>
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

        {/* Style Selector */}
        <div>
          <div className="text-textMuted text-[10px] uppercase font-bold mb-2 tracking-widest">Style</div>
          <div className="grid grid-cols-2 gap-2">
            {STYLES.map((style) => (
              <button
                key={style.id}
                onClick={() => {
                  soundSynthesizer.playUIClick();
                  onSelectStyle(style.id);
                }}
                className={`py-1.5 px-2 rounded text-[10px] font-bold border transition-all ${
                  selectedStyle === style.id
                    ? 'bg-accentGold text-black border-accentGold'
                    : 'bg-bgCard text-textLight border-borderDark hover:border-accentGold/50'
                }`}
              >
                {style.label}
              </button>
            ))}
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-bgCard/50 p-2 rounded border border-borderDark text-[9px] text-textMuted italic">
          <p>Click &amp; drag on the canvas to cast the selected effect.</p>
          <p className="mt-1">• AOE/Beam/Cone/Slash/Pulse/Ring: drag from start to end</p>
          <p>• Missile: drag from start to target point</p>
          <p>• Burn/Glow/Smash: click (or drag short distance) at target point</p>
        </div>

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