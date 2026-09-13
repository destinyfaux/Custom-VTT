// client/src/components/RulesModal.jsx
// In-session rules & rulings quick reference — searchable over the curated
// SRD 5.1 table rules (rules_reference.json) plus the 15 conditions from
// srd_data.json. Available to players AND the DM (everyone forgets how
// grapple works mid-session).
import { useMemo, useState } from 'react';
import srd from '../data/srd_data.json';
import rulesData from '../data/rules_reference.json';

const CATEGORY_ORDER = ['Conditions', 'Combat', 'Movement', 'Downtime', 'Exploration'];

const CATEGORY_STYLES = {
  Conditions: 'bg-purple-900/60 text-purple-200 border-purple-700/60',
  Combat: 'bg-red-950/60 text-red-200 border-red-800/60',
  Movement: 'bg-blue-950/60 text-blue-200 border-blue-800/60',
  Downtime: 'bg-emerald-950/60 text-emerald-200 border-emerald-800/60',
  Exploration: 'bg-amber-950/60 text-amber-200 border-amber-800/60',
};

// Merge curated rules + SRD conditions into one searchable list
const ALL_ENTRIES = [
  ...rulesData.rules.map(r => ({
    title: r.title,
    category: r.category,
    keywords: r.keywords || '',
    text: r.text
  })),
  ...(srd.conditions || []).map(c => ({
    title: c.name,
    category: 'Conditions',
    keywords: 'condition status effect ' + (c.name || ''),
    text: c.description || ''
  }))
];

export default function RulesModal({ onClose }) {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  const categories = useMemo(() => {
    const present = new Set(ALL_ENTRIES.map(e => e.category));
    return ['All', ...CATEGORY_ORDER.filter(c => present.has(c))];
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ALL_ENTRIES.filter(e => {
      if (activeCategory !== 'All' && e.category !== activeCategory) return false;
      if (!q) return true;
      return (
        e.title.toLowerCase().includes(q) ||
        e.keywords.toLowerCase().includes(q) ||
        e.text.toLowerCase().includes(q)
      );
    });
  }, [query, activeCategory]);

  // Group results by category for scannable sections (search result order kept)
  const grouped = useMemo(() => {
    const map = new Map();
    for (const e of results) {
      if (!map.has(e.category)) map.set(e.category, []);
      map.get(e.category).push(e);
    }
    return [...map.entries()].sort(
      (a, b) => CATEGORY_ORDER.indexOf(a[0]) - CATEGORY_ORDER.indexOf(b[0])
    );
  }, [results]);

  return (
    <div className="fixed inset-0 z-[1100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6" onMouseDown={onClose}>
      <div
        className="w-full max-w-3xl h-[82vh] bg-bgPanel border border-accentGold rounded-xl shadow-2xl flex flex-col overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-borderDark bg-bgCard shrink-0">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-accentGold font-bold text-sm uppercase tracking-widest flex items-center gap-2">
              📚 Rules &amp; Rulings Reference
            </h2>
            <button onClick={onClose} className="text-textMuted hover:text-white text-sm px-2">✕</button>
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search rules… (e.g. grapple, prone, death save, potion)"
            className="w-full bg-bgPanel text-white text-sm border border-borderDark rounded-lg px-3 py-2 focus:border-accentGold focus:outline-none placeholder:text-textMuted/60"
            autoFocus
          />
          {/* Category chips */}
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-colors ${
                  activeCategory === cat
                    ? 'bg-accentGold text-black border-accentGold'
                    : 'bg-transparent text-textMuted border-borderDark hover:text-white hover:border-textMuted'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5 bg-[#0b0c10]">
          {grouped.length === 0 && (
            <p className="text-xs text-textMuted italic text-center py-12">
              No rulings match “{query}”. Ask your DM — that's what they're for. 🎲
            </p>
          )}

          {grouped.map(([category, entries]) => (
            <div key={category} className="space-y-2">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-textMuted border-b border-borderDark/60 pb-1">
                {category} <span className="text-textMuted/60">({entries.length})</span>
              </h3>
              {entries.map(e => (
                <div key={e.title} className="bg-bgCard border border-borderDark rounded-lg p-3 hover:border-accentGold/40 transition-colors">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="font-bold text-white text-sm">{e.title}</span>
                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider shrink-0 ${CATEGORY_STYLES[e.category] || 'bg-bgPanel text-textMuted border-borderDark'}`}>
                      {e.category}
                    </span>
                  </div>
                  <p className="text-xs text-textLight leading-relaxed">{e.text}</p>
                </div>
              ))}
            </div>
          ))}

          <p className="text-[9px] text-textMuted/70 text-center pt-2 pb-1">
            Condensed from SRD 5.1 (CC-BY-4.0). House rules always override — ask your DM.
          </p>
        </div>
      </div>
    </div>
  );
}
