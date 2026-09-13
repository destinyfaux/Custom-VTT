// client/src/components/character/SensesCard.jsx
import { getPassiveSkill } from '../../utils/CharacterEngine';
import srd from '../../data/srd_data.json';

export default function SensesCard({ data, liveStats, profBonus }) {
  const passivePer = getPassiveSkill('Perception', data, liveStats, profBonus);
  const passiveInv = getPassiveSkill('Investigation', data, liveStats, profBonus);
  const passiveIns = getPassiveSkill('Insight', data, liveStats, profBonus);

  const senses = [
    { label: 'Passive PER', value: passivePer },
    { label: 'Passive INV', value: passiveInv },
    { label: 'Passive INS', value: passiveIns },
  ];
  const storedVision = Number(data.vision ?? data.normalVision ?? 120);
  const normalVision = storedVision === 1200 ? 120 : storedVision;
  const raceDarkvision = srd.races?.[data.race]?.darkvision;
  const darkvision = data.darkvision ?? raceDarkvision ?? 0;
  const inventory = Array.isArray(data.inventory) ? data.inventory : [];
  const hasTorch = inventory.some(item =>
    item && /torch/i.test(String(item.name || item.itemName || item.type || '')) &&
    (item.quantity === undefined || Number(item.quantity) > 0)
  );

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
      <div className="grid grid-cols-2 gap-[5px] mt-1">
        <div className="bg-bgPanel p-2 rounded border border-borderDark/40 text-center">
          <span className="block text-sm font-extrabold text-white">{normalVision}</span>
          <span className="text-[8px] text-textMuted uppercase tracking-wider">Normal Vision (map)</span>
        </div>
        <div className="bg-bgPanel p-2 rounded border border-borderDark/40 text-center">
          <span className="block text-sm font-extrabold text-white">{darkvision || 'None'}</span>
          <span className="text-[8px] text-textMuted uppercase tracking-wider">Darkvision (ft)</span>
        </div>
      </div>
      <div className={`text-[8px] text-center font-semibold ${darkvision ? 'text-accentGold' : 'text-red-300'}`}>
        Night vision: {darkvision ? `${darkvision} ft` : hasTorch ? 'Torch required' : 'Blind without light'}
        {hasTorch ? ' | Torch available' : ''}
      </div>
    </div>
  );
}