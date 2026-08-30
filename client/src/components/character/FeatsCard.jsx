import { useState, useMemo } from 'react';
import srd from '../../data/srd_data.json';

export default function FeatsCard({ data, update }) {
  const [search, setSearch] = useState('');
  const [showBrowser, setShowBrowser] = useState(false);
  const [browserSearch, setBrowserSearch] = useState('');

  const playerFeats = data.feats || [];

  // Inline search (existing)
  const allFeats = Object.entries(srd.feats || {});
  const filteredFeats = useMemo(() => {
    if (!search) return [];
    return allFeats.filter(([name]) => name.toLowerCase().includes(search.toLowerCase())).slice(0, 10);
  }, [search]);

  // Browser list
  const browserFeats = useMemo(() => {
    if (!browserSearch) return allFeats;
    return allFeats.filter(([name]) => name.toLowerCase().includes(browserSearch.toLowerCase()));
  }, [browserSearch]);

  const addFeat = (featName, featData) => {
    const newFeats = [...playerFeats, { name: featName, ...featData }];
    update('feats', newFeats);
    setSearch('');
    setShowBrowser(false);
    setBrowserSearch('');
  };

  const removeFeat = (idx) => {
    const newFeats = playerFeats.filter((_, i) => i !== idx);
    update('feats', newFeats);
  };

  return (
    <div className="bg-bgPanel p-4 rounded-xl border border-borderDark">
      <h3 className="text-accentGold font-bold text-[10px] uppercase mb-3 tracking-widest">Feats</h3>
      
      {/* Inline search */}
      <input
        className="w-full bg-bgCard p-2 rounded text-xs text-white border border-borderDark mb-2"
        placeholder="Search feats..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      {filteredFeats.length > 0 && (
        <div className="bg-bgCard border border-accentGold rounded mb-2 max-h-40 overflow-y-auto">
          {filteredFeats.map(([name, feat]) => (
            <div
              key={name}
              className="p-2 text-xs hover:bg-borderDark cursor-pointer flex justify-between items-center"
              onClick={() => addFeat(name, feat)}
            >
              <span>{name}</span>
              <span className="text-textMuted text-[10px]">{feat.prerequisite || 'No prereq'}</span>
            </div>
          ))}
        </div>
      )}

      <button
        className="w-full bg-borderDark text-white py-1 rounded text-xs mb-3 hover:bg-gray-700"
        onClick={() => setShowBrowser(true)}
      >
        Browse All Feats
      </button>

      {/* Player's chosen feats */}
      <div className="space-y-1">
        {playerFeats.length === 0 && <p className="text-[10px] text-textMuted italic">No feats taken.</p>}
        {playerFeats.map((f, idx) => (
          <div key={idx} className="flex justify-between items-center bg-bgCard p-2 rounded border border-borderDark text-xs">
            <div>
              <span className="text-white font-bold">{f.name}</span>
              <p className="text-textMuted text-[10px] mt-1">{f.description}</p>
            </div>
            <button onClick={() => removeFeat(idx)} className="text-red-500 hover:text-red-400">×</button>
          </div>
        ))}
      </div>

      {/* Feat Browser Modal */}
      {showBrowser && (
        <div className="fixed inset-0 z-[1200] bg-black bg-opacity-70 flex items-center justify-center">
          <div className="bg-bgPanel border border-accentGold rounded-xl w-[500px] h-[550px] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-3 border-b border-borderDark">
              <input
                type="text"
                placeholder="Search all feats..."
                value={browserSearch}
                onChange={e => setBrowserSearch(e.target.value)}
                className="w-full bg-bgCard text-white p-2 rounded text-xs border border-borderDark focus:border-accentGold outline-none"
              />
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {browserFeats.length === 0 && (
                <p className="text-textMuted text-xs italic text-center py-10">No feats match your search.</p>
              )}
              {browserFeats.map(([name, feat]) => (
                <div
                  key={name}
                  className="bg-bgCard p-2 rounded border border-borderDark hover:border-accentGold cursor-pointer text-xs"
                  onClick={() => addFeat(name, feat)}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-white font-bold">{name}</span>
                    <span className="text-textMuted text-[9px]">{feat.prerequisite || 'No prereq'}</span>
                  </div>
                  <p className="text-textMuted text-[10px] mt-1 line-clamp-2">{feat.description}</p>
                </div>
              ))}
            </div>
            <div className="p-2 border-t border-borderDark">
              <button
                onClick={() => setShowBrowser(false)}
                className="w-full bg-borderDark text-white py-1 rounded text-xs hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}