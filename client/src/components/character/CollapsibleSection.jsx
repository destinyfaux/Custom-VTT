// client/src/components/character/CollapsibleSection.jsx
import { useState } from 'react';

export default function CollapsibleSection({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    // Changed mb-4 to mb-0 to align with 5px gap rules
    <div className="bg-bgPanel rounded-xl border border-borderDark overflow-hidden mb-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex justify-between items-center p-3 bg-bgCard hover:bg-borderDark transition-colors"
      >
        <h3 className="text-accentGold font-bold text-[10px] uppercase tracking-widest">{title}</h3>
        <span className="text-accentGold text-xs font-bold">{open ? '−' : '+'}</span>
      </button>
      {open && (
        // Tightened interior container padding from p-4 to p-2.5
        <div className="p-2.5 border-t border-borderDark">
          {children}
        </div>
      )}
    </div>
  );
}