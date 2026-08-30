// client/src/components/DiceTray.jsx
import { useState } from 'react';
import { socket } from '../socket';
import soundSynthesizer from '../utils/SoundSynthesizer';
import DiceRollAnimation from './DiceRollAnimation';

export default function DiceTray() {
  const [isOpen, setIsOpen] = useState(false); // Collapsible state
  const diceList = [4, 6, 8, 10, 12, 20, 100];
  
  // State to hold the count of each die type and the flat modifier
  const [pool, setPool] = useState({ 4: 0, 6: 0, 8: 0, 10: 0, 12: 0, 20: 0, 100: 0 });
  const [modifier, setModifier] = useState(0);

  // Active roll states
  const [rollResults, setRollResults] = useState(null);
  const [isRolling, setIsRolling] = useState(false);
  const [pendingMessage, setPendingMessage] = useState('');

  // Last roll history state
  const [lastRollResults, setLastRollResults] = useState(null);
  const [isReviewingLastRoll, setIsReviewingLastRoll] = useState(false);

  const addDie = (sides) => setPool(p => ({ ...p, [sides]: p[sides] + 1 }));
  const removeDie = (e, sides) => {
      e.preventDefault(); // Prevent standard right-click menu
      setPool(p => ({ ...p, [sides]: Math.max(0, p[sides] - 1) }));
  };

  const clearPool = () => {
      setPool({ 4: 0, 6: 0, 8: 0, 10: 0, 12: 0, 20: 0, 100: 0 });
      setModifier(0);
  };

  // Generate a display string of the current pool (e.g., "2d6 + 1d20")
  const poolDisplay = Object.entries(pool)
      .filter(([_, count]) => count > 0)
      .map(([sides, count]) => `${count}d${sides}`)
      .join(' + ');

  // Main roll function with animation
  const executeRollWithAnimation = () => {
    // Calculate everything and store the message
    let total = 0;
    let rollBreakdowns = [];
    let formulaParts = [];
    let d20Rolls = [];
    const results = [];

    Object.entries(pool).forEach(([sides, count]) => {
      if (count > 0) {
        const sidesNum = parseInt(sides);
        let subTotal = 0;
        let rolls = [];
        for (let i = 0; i < count; i++) {
          const r = Math.floor(Math.random() * sidesNum) + 1;
          subTotal += r;
          rolls.push(r);
          if (sidesNum === 20) d20Rolls.push(r);
          results.push({ sides: sidesNum, value: r });
        }
        total += subTotal;
        formulaParts.push(`${count}d${sides}`);
        rollBreakdowns.push(`[${rolls.join(', ')}]`);
      }
    });

    if (formulaParts.length === 0 && modifier === 0) return;

    const modVal = parseInt(modifier) || 0;
    let finalTotal = total + modVal;

    let formulaString = formulaParts.join(' + ');
    let resultString = rollBreakdowns.join(' + ');
    if (modVal !== 0) {
      const sign = modVal > 0 ? '+' : '-';
      const absMod = Math.abs(modVal);
      formulaString += ` ${sign} ${absMod}`;
      if (rollBreakdowns.length > 0) {
        resultString += ` ${sign} ${absMod}`;
      } else {
        resultString = `${modVal}`;
      }
    }

    let isNat1 = d20Rolls.some(r => r === 1);
    let isNat20 = d20Rolls.some(r => r === 20);
    let chatPrefix = '';
    if (isNat1) {
      soundSynthesizer.playCriticalFail();
      chatPrefix = '💀 CRITICAL FAIL! 💀 ';
    } else if (isNat20) {
      soundSynthesizer.playCriticalSuccess();
      chatPrefix = '✨✨ CRITICAL HIT! ✨✨ ';
    } else {
      soundSynthesizer.playDiceRoll();
    }

    const msg = chatPrefix + `rolled ${formulaString} ➔ ${resultString} = ${finalTotal}`;

    // Store message and trigger animation
    setPendingMessage(msg);
    setRollResults(results);
    setLastRollResults(results); // Save to history for review
    setIsRolling(true);
  };

  const handleAnimationComplete = () => {
    if (pendingMessage) {
      socket.emit('chat_message', pendingMessage);
    }
    clearPool();
    setIsRolling(false);
    setRollResults(null);
    setPendingMessage('');
  };

  const handleReviewClose = () => {
    setIsReviewingLastRoll(false);
  };

  const hasDice = Object.values(pool).some(count => count > 0);

  return (
    <>
      {/* Active Rolling Animation Overlay */}
      {isRolling && rollResults && (
        <DiceRollAnimation
          results={rollResults}
          onComplete={handleAnimationComplete}
          isReviewMode={false}
        />
      )}

      {/* Review Last Roll Overlay */}
      {isReviewingLastRoll && lastRollResults && (
        <DiceRollAnimation
          results={lastRollResults}
          onComplete={handleReviewClose}
          isReviewMode={true}
        />
      )}

      <div className="bg-bgPanel rounded border border-borderDark mb-2 overflow-hidden shadow-sm">
        {/* Collapsible Header with Last Roll Button */}
        <div className="w-full flex justify-between items-center p-2 bg-bgCard hover:bg-borderDark transition-colors group">
          <button 
            onClick={() => {
              soundSynthesizer.playUIClick();
              setIsOpen(!isOpen);
            }}
            className="flex items-center gap-2 flex-1 text-left"
          >
            <span className="text-[10px]">🎲</span>
            <h3 className="text-accentGold text-[10px] font-bold uppercase tracking-widest">Dice Tray</h3>
          </button>

          <div className="flex items-center gap-2">
            {/* View Last Roll Quick Action */}
            {lastRollResults && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  soundSynthesizer.playUIClick();
                  setIsReviewingLastRoll(true);
                }}
                title="View previous roll results"
                className="text-[9px] px-1.5 py-0.5 rounded bg-bgPanel border border-accentGold/40 text-accentGold hover:bg-accentGold hover:text-black font-bold uppercase tracking-wider transition-all flex items-center gap-1 shadow-sm"
              >
                <span>📜</span>
                <span>Last Roll</span>
              </button>
            )}

            <button
              onClick={() => {
                soundSynthesizer.playUIClick();
                setIsOpen(!isOpen);
              }}
              className="text-accentGold font-bold text-xs px-1"
            >
              {isOpen ? '−' : '+'}
            </button>
          </div>
        </div>

        {/* Expandable Content */}
        {isOpen && (
          <div className="p-3 border-t border-borderDark animate-in slide-in-from-top-2 duration-200">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[9px] text-textMuted italic">L-click add, R-click remove</span>
            </div>

            {/* The Dice Grid */}
            <div className="grid grid-cols-4 gap-1.5 mb-3">
              {diceList.map(d => (
                <button 
                  key={d} 
                  className={`relative py-1 rounded border transition-all text-[10px] font-bold
                    ${pool[d] > 0 ? 'bg-accentGold text-black border-accentGold' : 'bg-bgCard text-textLight border-borderDark hover:border-accentGold'}
                  `}
                  onClick={() => {
                    soundSynthesizer.playUIClick();
                    addDie(d);
                  }}
                  onContextMenu={(e) => {
                    soundSynthesizer.playUIClick();
                    removeDie(e, d);
                  }}
                >
                  d{d}
                  {pool[d] > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[8px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center border border-bgPanel">
                      {pool[d]}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* The Roll Builder Output & Modifier */}
            <div className="bg-bgCard p-2 rounded border border-borderDark mb-3">
              <div className="text-[10px] text-textMuted mb-1 text-center min-h-[14px] truncate">
                {poolDisplay || 'Select dice...'}
              </div>
              <div className="flex items-center justify-between gap-2 mt-1.5 pt-1.5 border-t border-borderDark/50">
                <label className="text-[9px] text-accentGold uppercase font-bold">Mod:</label>
                <input 
                  type="number" 
                  className="bg-bgPanel text-white text-center w-12 p-0.5 text-[10px] rounded border border-borderDark focus:outline-none focus:border-accentGold"
                  value={modifier}
                  onChange={(e) => setModifier(e.target.value)}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button 
                className="flex-1 bg-borderDark text-textMuted text-[9px] font-bold py-1 rounded hover:bg-gray-700 transition-colors"
                onClick={() => {
                  soundSynthesizer.playUIClick();
                  clearPool();
                }}
              >
                CLEAR
              </button>
              <button 
                className={`flex-[2] text-black text-[9px] font-bold py-1 rounded transition-all
                  ${hasDice || parseInt(modifier) !== 0 ? 'bg-accentGold hover:bg-yellow-500 shadow-md' : 'bg-yellow-900 cursor-not-allowed opacity-50'}
                `}
                onClick={executeRollWithAnimation}
                disabled={!hasDice && parseInt(modifier) === 0}
              >
                ROLL
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}