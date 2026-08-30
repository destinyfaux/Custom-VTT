// client/src/components/PlayerPrompt.jsx
import { useEffect, useState, useCallback } from 'react';
import { socket } from '../socket';
import { getAbilityModifier } from '../utils/CharacterEngine';

export default function PlayerPrompt() {
  const [prompt, setPrompt] = useState(null); // { tokenId }
  const [manualRoll, setManualRoll] = useState('');
  const [manualBonus, setManualBonus] = useState(0);

  // Compute initiative bonus from the player's stored sheet data
  const getInitiativeBonus = useCallback(() => {
    try {
      const raw = localStorage.getItem('tome_data');
      if (!raw) return 0;
      const data = JSON.parse(raw);
      const dex = parseInt(data.dex) || 10;
      return getAbilityModifier(dex); // DEX mod only for now (feats later)
    } catch {
      return 0;
    }
  }, []);

  useEffect(() => {
    const handlePrompt = ({ tokenId }) => {
      setPrompt({ tokenId });
      setManualRoll('');
      setManualBonus(getInitiativeBonus());
    };

    socket.on('initiative_prompt', handlePrompt);
    return () => socket.off('initiative_prompt', handlePrompt);
  }, [getInitiativeBonus]);

  if (!prompt) return null;

  const submitInitiative = (roll, bonus) => {
    socket.emit('submit_initiative', { tokenId: prompt.tokenId, roll, bonus });
    setPrompt(null);
  };

  const handleVirtualRoll = () => {
    const roll = Math.floor(Math.random() * 20) + 1;
    const bonus = getInitiativeBonus();
    submitInitiative(roll, bonus);
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    const roll = parseInt(manualRoll, 10);
    const bonus = parseInt(manualBonus, 10) || 0;
    if (isNaN(roll) || roll < 1 || roll > 20) {
      alert('Enter a valid d20 roll (1–20)');
      return;
    }
    submitInitiative(roll, bonus);
  };

  return (
    <div className="fixed inset-0 z-[500] bg-black bg-opacity-60 flex items-center justify-center">
      <div className="bg-bgPanel border border-accentGold rounded-xl p-6 w-80 shadow-2xl animate-in zoom-in duration-200">
        <h2 className="text-accentGold font-bold text-lg mb-2 text-center">Roll Initiative!</h2>
        <p className="text-textMuted text-xs text-center mb-4">
          The DM requests your initiative roll.
        </p>

        <div className="space-y-4">
          {/* Virtual Dice Button */}
          <button
            onClick={handleVirtualRoll}
            className="w-full bg-accentGold text-black font-extrabold py-3 rounded-lg text-xl hover:bg-yellow-500 transition-colors flex items-center justify-center gap-2"
          >
            <span className="text-2xl">🎲</span>
            Roll d20
            <span className="text-sm font-normal text-black/70 ml-2">
              (+{getInitiativeBonus()})
            </span>
          </button>

          {/* Manual Input */}
          <form onSubmit={handleManualSubmit} className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-xs text-textMuted w-10">Roll:</label>
              <input
                type="number"
                min="1"
                max="20"
                value={manualRoll}
                onChange={(e) => setManualRoll(e.target.value)}
                placeholder="d20"
                className="w-full bg-bgCard text-white border border-borderDark rounded p-1 text-center text-sm focus:border-accentGold outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-textMuted w-10">Bonus:</label>
              <input
                type="number"
                value={manualBonus}
                onChange={(e) => setManualBonus(e.target.value)}
                className="w-full bg-bgCard text-white border border-borderDark rounded p-1 text-center text-sm focus:border-accentGold outline-none"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-borderDark text-white font-bold py-2 rounded text-sm hover:bg-gray-700 transition-colors"
            >
              Submit Manual Roll
            </button>
          </form>

          <button
            onClick={() => setPrompt(null)}
            className="w-full text-textMuted text-xs underline hover:text-white"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}