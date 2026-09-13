import { useEffect, useState } from 'react';
import { socket } from '../socket';
import srd from '../data/srd_data.json';
import { getAbilityModifier, calculateSkillTotal, getProficiencyBonus, calculateLiveStats } from '../utils/CharacterEngine';

export default function CheckPrompt() {
  const [prompt, setPrompt] = useState(null); // { checkType, skillOrAbility, dc, reason, requestorName }
  const [manualRoll, setManualRoll] = useState('');

  useEffect(() => {
    socket.on('check_request', (data) => {
      setPrompt(data);
      setManualRoll('');
    });
    return () => socket.off('check_request');
  }, []);

  if (!prompt) return null;

  const getBonus = () => {
    try {
      const raw = localStorage.getItem('tome_data');
      if (!raw) return 0;
      const data = JSON.parse(raw);
      const liveStats = calculateLiveStats(data);
      const profBonus = getProficiencyBonus(data.lvl || 1);
      if (prompt.checkType === 'ability') {
        const ability = prompt.skillOrAbility.toLowerCase();
        return getAbilityModifier(liveStats[ability] || 10);
      } else {
        return calculateSkillTotal(prompt.skillOrAbility, data, liveStats, profBonus);
      }
    } catch { return 0; }
  };

  const bonus = getBonus();
  const label = prompt.checkType === 'ability' ? `${prompt.skillOrAbility} Saving Throw` : `${prompt.skillOrAbility} Check`;

  const submit = (roll) => {
    socket.emit('submit_check', {
      targetUserId: socket.auth.userId,
      checkType: prompt.checkType,
      skillOrAbility: prompt.skillOrAbility,
      dc: prompt.dc,
      roll,
      bonus,
      reason: prompt.reason,
      requestorName: prompt.requestorName
    });
    setPrompt(null);
  };

  const handleVirtualRoll = () => {
    const roll = Math.floor(Math.random() * 20) + 1;
    submit(roll);
  };

  const handleManual = (e) => {
    e.preventDefault();
    const roll = parseInt(manualRoll);
    if (isNaN(roll) || roll < 1 || roll > 20) return alert('Enter 1–20');
    submit(roll);
  };

  return (
    <div className="fixed inset-0 z-[500] bg-black bg-opacity-60 flex items-center justify-center">
      <div className="bg-bgPanel border border-accentGold rounded-xl p-6 w-80 shadow-2xl">
        <h2 className="text-accentGold font-bold text-lg mb-1 text-center">{label}</h2>
        <p className="text-textMuted text-xs text-center mb-2">Requested by {prompt.requestorName}</p>
        {prompt.reason && <p className="text-textLight text-xs italic text-center mb-3">"{prompt.reason}"</p>}
        <p className="text-accentGold text-center font-bold mb-4">DC {prompt.dc}</p>

        <button
          onClick={handleVirtualRoll}
          className="w-full bg-accentGold text-black font-extrabold py-3 rounded-lg text-xl flex items-center justify-center gap-2 mb-3"
        >
          🎲 Roll d20 <span className="text-sm font-normal">(+{bonus})</span>
        </button>

        <form onSubmit={handleManual} className="space-y-2">
          <input
            type="number"
            min="1"
            max="20"
            value={manualRoll}
            onChange={e => setManualRoll(e.target.value)}
            placeholder="Manual d20"
            className="w-full bg-bgCard text-white border border-borderDark rounded p-2 text-center"
          />
          <button type="submit" className="w-full bg-borderDark text-white font-bold py-1 rounded text-sm">Submit Manual</button>
        </form>

        <button onClick={() => setPrompt(null)} className="w-full text-textMuted text-xs mt-2 underline">Cancel</button>
      </div>
    </div>
  );
}