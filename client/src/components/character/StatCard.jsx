// client/src/components/character/StatCard.jsx

export default function StatCard({ data, rawStats, liveStats, update }) {
  const stats = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
  const getMod = (score) => Math.floor((parseInt(score) - 10) / 2);

  return (
    <div className="grid grid-cols-3 gap-[5px]">
      {stats.map((stat) => {
        const val = rawStats[stat.toLowerCase()]; // Player entry RAW score
        const liveVal = liveStats[stat.toLowerCase()]; // Suggested score (Race calculations)
        const mod = getMod(val); // Modifier is calculated directly from user entry RAW score!
        const modSign = mod >= 0 ? `+${mod}` : mod;

        return (
          <div 
            key={stat} 
            className="bg-bgCard p-2 rounded-xl border border-borderDark flex flex-col hover:border-accentGold transition-colors"
          >
            {/* Stat Header: Attribute Label and calculated RAW modifier badge */}
            <div className="flex justify-between items-center w-full mb-1.5 px-1">
              <span className="text-accentGold font-bold text-xs tracking-wider flex flex-wrap items-center gap-1">
                {stat}
                {/* Green Visual Help Label displayed only if suggested score differs from entry */}
                {liveVal !== val && (
                  <span 
                    className="text-[9px] text-green-400 font-bold leading-none cursor-help" 
                    title={`Racial/Subracial features suggest setting this stat to ${liveVal} (Adds +${liveVal - val})`}
                  >
                    ({liveVal}?)
                  </span>
                )}
              </span>
              <span className="text-accentGold font-extrabold text-[10px] bg-bgPanel px-1.5 py-0.5 rounded border border-borderDark/40 leading-none">
                {modSign}
              </span>
            </div>

            {/* Direct Value Editor Panel */}
            <div className="flex items-center justify-between bg-bgPanel border border-borderDark rounded-lg w-full px-2 py-1 h-8">
              <input 
                type="number" 
                className="w-full bg-transparent text-center text-xs font-bold text-white outline-none appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                value={val}
                onChange={(e) => update(stat.toLowerCase(), parseInt(e.target.value) || 0)}
              />
              <div className="flex flex-col border-l border-borderDark/60 pl-1.5 gap-0.5 shrink-0">
                <button 
                  onClick={() => update(stat.toLowerCase(), val + 1)} 
                  className="text-textMuted hover:text-white text-[8px] leading-none px-0.5"
                >
                  ▲
                </button>
                <button 
                  onClick={() => update(stat.toLowerCase(), val - 1)} 
                  className="text-textMuted hover:text-white text-[8px] leading-none px-0.5"
                >
                  ▼
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}