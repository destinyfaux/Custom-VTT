// client/src/components/FXPanel.jsx
import soundSynthesizer from '../utils/SoundSynthesizer';
import { useDraggableResizable } from '../hooks/useDraggableResizable';

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
  const { pos, size, handleMouseDown, handleResizeDown } = useDraggableResizable({
    initialPos: { x: window.innerWidth - 450, y: 120 },
    initialSize: { w: 340, h: 650 },
    minSize: { w: 280, h: 350 }
  });

  return (
    <div
      className="fixed z-[1100] bg-bgPanel border border-accentGold rounded-lg shadow-2xl flex flex-col overflow-hidden"
      style={{ left: pos.x, top: pos.y, width: size.w, height: size.h }}
      onMouseDown={handleMouseDown}
    >
      <header className="bg-bgCard p-3 flex justify-between items-center cursor-move border-b border-borderDark shrink-0">
        <span className="text-accentGold font-bold text-[10px] uppercase tracking-widest drag-handle">Spell FX</span>
        <button
          type="button"
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
                type="button"
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
                type="button"
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
          type="button"
          onClick={() => {
            soundSynthesizer.playUIClick();
            onClose();
          }}
          className="w-full bg-borderDark text-white font-bold py-2 rounded text-[11px] hover:bg-gray-700 transition-colors"
        >
          Close Panel
        </button>
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