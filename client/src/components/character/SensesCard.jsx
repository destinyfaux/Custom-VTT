// client/src/components/character/SensesCard.jsx
import { getPassiveSkill } from '../../utils/CharacterEngine';

export default function SensesCard({ data, liveStats, profBonus }) {
  const passivePer = getPassiveSkill('Perception', data, liveStats, profBonus);
  const passiveInv = getPassiveSkill('Investigation', data, liveStats, profBonus);
  const passiveIns = getPassiveSkill('Insight', data, liveStats, profBonus);

  const senses = [
    { label: 'Passive PER', value: passivePer },
    { label: 'Passive INV', value: passiveInv },
    { label: 'Passive INS', value: passiveIns },
  ];

  return (
    <div className="bg-bgCard p-2.5 rounded-xl border border-borderDark flex flex-col gap-1.5 shadow-sm">
      {/* 3-Column horizontal metric container */}
      <div className="grid grid-cols-3 gap-[5px]">
        {senses.map(sense => (
          <div 
            key={sense.label} 
            className="bg-bgPanel p-2 rounded border border-borderDark/40 flex flex-col items-center justify-center text-center"
          >
            <span className="text-base font-extrabold text-white mb-0.5 leading-none">{sense.value}</span>
            <span className="text-[9px] text-textMuted font-semibold leading-tight uppercase tracking-wider">{sense.label}</span>
          </div>
        ))}
      </div>
      <div className="text-[7.5px] text-textMuted italic text-center leading-none mt-0.5">
        Scores = 10 + skill modifier.
      </div>
    </div>
  );
}