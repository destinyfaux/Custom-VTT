// client/src/components/character/SkillsCard.jsx
import { getAbilityModifier } from '../../utils/CharacterEngine';

export default function SkillsCard({ data, update, liveStats, profBonus }) {
  const groups = [
    { id: 'str', label: 'Strength' },
    { id: 'dex', label: 'Dexterity' },
    { id: 'con', label: 'Constitution' },
    { id: 'int', label: 'Intelligence' },
    { id: 'wis', label: 'Wisdom' },
    { id: 'cha', label: 'Charisma' }
  ];

  const allSkills = [
    {n:"Athletics", s:"str"},
    {n:"Acrobatics", s:"dex"},{n:"Sleight of Hand", s:"dex"},{n:"Stealth", s:"dex"},
    {n:"Arcana", s:"int"},{n:"History", s:"int"},{n:"Investigation", s:"int"},{n:"Nature", s:"int"},{n:"Religion", s:"int"},
    {n:"Animal Handling", s:"wis"},{n:"Insight", s:"wis"},{n:"Medicine", s:"wis"},{n:"Perception", s:"wis"},{n:"Survival", s:"wis"},
    {n:"Deception", s:"cha"},{n:"Intimidation", s:"cha"},{n:"Performance", s:"cha"},{n:"Persuasion", s:"cha"}
  ];

  const cycleProf = (skillName) => {
    const current = data[`prof_${skillName}`] || 0;
    // 0: None, 1: Proficient, 2: Expertise, 0.5: Half
    const next = current === 0 ? 1 : current === 1 ? 2 : current === 2 ? 0.5 : 0;
    update(`prof_${skillName}`, next);
  };

  return (
    <div className="bg-bgPanel p-4 rounded-xl border border-borderDark mb-4">
      <h3 className="text-accentGold font-bold text-[10px] uppercase mb-4 tracking-widest">Skills & Proficiencies</h3>
      
      {groups.map(group => {
        // Calculate Modifier for this Ability Group
        const mod = getAbilityModifier(liveStats[group.id] || 10);
        const groupSkills = allSkills.filter(s => s.s === group.id);

        return (
          <div key={group.id} className="mb-4">
            {/* Ability Group Header */}
            <div className="flex justify-between text-[10px] text-accentGold mb-2 border-b border-borderDark pb-1">
              <span className="font-bold uppercase">{group.label}</span>
              <span className="font-bold">{mod >= 0 ? `+${mod}` : mod}</span>
            </div>

            {/* Skills in this Ability Group */}
            <div className="flex flex-col gap-1">
              {groupSkills.map(sk => {
                const profLevel = data[`prof_${sk.n}`] || 0;
                // Calculate Final Bonus: Ability Mod + (Prof Level * Prof Bonus)
                const total = mod + (profLevel * profBonus);
                
                const label = profLevel === 1 ? 'P' : profLevel === 2 ? 'E' : profLevel === 0.5 ? '½' : '';
            
            return (
                  <div key={sk.n} 
                       className="flex items-center justify-between bg-bgCard p-2 rounded border border-borderDark hover:border-accentGold transition-colors cursor-pointer"
                       onClick={() => cycleProf(sk.n)}
                  >
                    <div className="flex items-center gap-2">
                        <div className={`w-5 h-5 flex items-center justify-center rounded text-[9px] font-bold border ${profLevel > 0 ? 'bg-accentGold text-black border-accentGold' : 'bg-bgPanel text-textMuted border-borderDark'}`}>
                            {label}
                        </div>
                        <span className="text-[11px] text-white">{sk.n}</span>
                    </div>
                    <span className="text-xs font-bold text-white">
                        {total >= 0 ? `+${total}` : total}
                    </span>
                </div>
                );
        })}
      </div>
          </div>
        );
      })}
    </div>
  );
}