// client/src/components/character/SavingThrowsCard.jsx
import { isSavingThrowProficient, calculateSavingThrow } from '../../utils/CharacterEngine';

export default function SavingThrowsCard({ data, stats, profBonus, update }) {
  const statList = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

  const toggleProf = (stat) => {
    const key = `save_prof_${stat.toLowerCase()}`;
    // Fetch currently active proficiency level (manual or default)
    const currentVal = isSavingThrowProficient(data, stat);
    update(key, !currentVal);
  };

  return (
    <div>
      {/* Grid mimicking the 3-column layout of StatCard */}
      <div className="grid grid-cols-3 gap-[5px]">
        {statList.map((stat) => {
          const isProf = isSavingThrowProficient(data, stat);
          const saveMod = calculateSavingThrow(stat, data, stats, profBonus);

          return (
            <div 
              key={stat} 
              onClick={() => toggleProf(stat)}
              className="bg-bgCard p-2 rounded-xl border border-borderDark flex flex-col hover:border-accentGold transition-colors cursor-pointer select-none group"
            >
              {/* Header: Stat Label on left, Proficiency Toggle Dot on right */}
              <div className="flex justify-between items-center w-full mb-1.5 px-1">
                <span className="text-accentGold font-bold text-xs tracking-wider leading-none">
                  {stat}
                </span>
                
                {/* Circular toggle dot */}
                <div 
                  className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-colors ${
                    isProf 
                      ? 'bg-accentGold border-accentGold' 
                      : 'border-textMuted group-hover:border-accentGold bg-transparent'
                  }`}
                >
                  {isProf && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
                </div>
              </div>

              {/* Bottom Display Panel: Calculated saving throw modifier */}
              <div className="flex items-center justify-center bg-bgPanel border border-borderDark rounded-lg w-full h-8 text-xs font-extrabold text-white">
                {saveMod >= 0 ? `+${saveMod}` : saveMod}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}