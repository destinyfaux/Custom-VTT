// client/src/components/TokenContextMenu.jsx
import { useState } from 'react';
import { socket } from '../socket';
import soundSynthesizer from '../utils/SoundSynthesizer';
import { getTokenLabel } from '../utils/tokenNaming';
import { ALL_CONDITIONS, CONDITION_ICONS } from '../utils/canvasOverlayRenderer';

export default function TokenContextMenu({
  contextMenu,
  tokens,
  role,
  userId,
  mapLabels = {},
  moveGroupIds = [],
  onToggleMoveGroup,
  onClearMoveGroup,
  onClose,
  onViewMonster,
}) {
  const [healInput, setHealInput] = useState('');
  const [damageInput, setDamageInput] = useState('');
  const [showHealInput, setShowHealInput] = useState(false);
  const [showDamageInput, setShowDamageInput] = useState(false);

  if (!contextMenu) return null;

  const targetToken = tokens.find(t => t.id === contextMenu.tokenId);
  if (!targetToken) return null;

  const displayLabel = getTokenLabel(mapLabels, targetToken);
  // DM controls any token; players control tokens they own
  const canControl = role === 'DM' || targetToken.ownerId === userId;
  const inMoveGroup = moveGroupIds.includes(targetToken.id);

  return (
    <div
      className="fixed z-[200] bg-bgPanel border border-accentGold rounded-lg p-2 shadow-2xl"
      style={{ left: contextMenu.x, top: contextMenu.y }}
      onMouseDown={e => e.stopPropagation()}
    >
      <div className="text-accentGold text-[10px] font-bold mb-2 uppercase tracking-widest">
        {displayLabel}
      </div>

      {/* Flight Toggle (DM or token owner) */}
      {canControl && (
        <button
          onClick={() => {
            socket.emit('toggle_token_flying', { tokenId: contextMenu.tokenId });
            soundSynthesizer.playFlightGust(!targetToken.flying);
            onClose();
          }}
          className="w-full text-left text-[10px] px-2 py-1 rounded text-sky-300 hover:bg-borderDark"
        >
          {targetToken.flying ? '🪶 Land' : '🪶 Take Flight'}
        </button>
      )}

      {/* Move Group Toggle (DM or token owner) */}
      {canControl && onToggleMoveGroup && (
        <button
          onClick={() => {
            onToggleMoveGroup(contextMenu.tokenId);
            soundSynthesizer.playUIClick();
            onClose();
          }}
          className={`w-full text-left text-[10px] px-2 py-1 rounded hover:bg-borderDark ${inMoveGroup ? 'text-cyan-300' : 'text-textLight'}`}
        >
          {inMoveGroup ? '🧩 Remove from Move Group' : '🧩 Add to Move Group'}
        </button>
      )}

      {moveGroupIds.length > 0 && onClearMoveGroup && (
        <button
          onClick={() => {
            onClearMoveGroup();
            onClose();
          }}
          className="w-full text-left text-[10px] px-2 py-1 rounded text-red-400 hover:bg-borderDark"
        >
          🧹 Clear Move Group ({moveGroupIds.length})
        </button>
      )}

      {/* Heal Option */}
      {!showHealInput ? (
        <button
          onClick={() => setShowHealInput(true)}
          className="w-full text-left text-[10px] px-2 py-1 rounded text-green-400 hover:bg-borderDark"
        >
          💚 Heal
        </button>
      ) : (
        <div className="flex items-center gap-1 mb-1">
          <input
            type="number"
            min="1"
            value={healInput}
            onChange={e => setHealInput(e.target.value)}
            placeholder="HP"
            className="w-16 bg-bgCard text-white border border-borderDark rounded px-1 py-0.5 text-[10px]"
            autoFocus
          />
          <button
            onClick={() => {
              const amt = parseInt(healInput);
              if (amt > 0) {
                socket.emit('update_token_hp', { tokenId: contextMenu.tokenId, amount: amt, isHeal: true, senderName: socket.auth.name });
                soundSynthesizer.playHeal();
                onClose();
              }
            }}
            className="px-2 py-0.5 bg-green-700 text-white rounded text-[9px] hover:bg-green-600"
          >
            Apply
          </button>
        </div>
      )}

      {/* Damage Option */}
      {!showDamageInput ? (
        <button
          onClick={() => setShowDamageInput(true)}
          className="w-full text-left text-[10px] px-2 py-1 rounded text-red-400 hover:bg-borderDark"
        >
          ❤️‍🔥 Damage
        </button>
      ) : (
        <div className="flex items-center gap-1 mb-1">
          <input
            type="number"
            min="1"
            value={damageInput}
            onChange={e => setDamageInput(e.target.value)}
            placeholder="HP"
            className="w-16 bg-bgCard text-white border border-borderDark rounded px-1 py-0.5 text-[10px]"
            autoFocus
          />
          <button
            onClick={() => {
              const amt = parseInt(damageInput);
              if (amt > 0) {
                socket.emit('update_token_hp', { tokenId: contextMenu.tokenId, amount: amt, isHeal: false, senderName: socket.auth.name });
                soundSynthesizer.playDamage();
                onClose();
              }
            }}
            className="px-2 py-0.5 bg-red-700 text-white rounded text-[9px] hover:bg-red-600"
          >
            Apply
          </button>
        </div>
      )}

      {/* View Monster Stat Block */}
      {targetToken.monsterData && (role === 'DM' || targetToken.ownerId === userId) && (
        <>
          <div className="border-t border-borderDark my-1" />
          <button
            onClick={() => {
              onViewMonster(targetToken.monsterData);
              onClose();
            }}
            className="w-full text-left text-[10px] px-2 py-1 rounded text-accentGold hover:bg-borderDark"
          >
            📖 View Stat Block
          </button>
        </>
      )}

      {targetToken.type === 'player' && targetToken.ownerId === userId && targetToken.hasTorch && (
        <>
          <div className="border-t border-borderDark my-1" />
          <button
            onClick={() => {
              socket.emit('toggle_player_torch', targetToken.id);
              onClose();
            }}
            className="w-full text-left text-[10px] px-2 py-1 rounded text-yellow-300 hover:bg-borderDark"
          >
            {targetToken.torchActive ? '🕯️ Deactivate Torch' : '🔥 Activate Torch'}
          </button>
        </>
      )}

      {/* Conditions (DM Only) */}
      {role === 'DM' && (
        <>
          <div className="border-t border-borderDark my-1" />
          <div className="text-accentGold text-[10px] font-bold mb-1 uppercase tracking-widest">Conditions</div>
          <div className="grid grid-cols-1 gap-1 max-h-44 overflow-y-auto">
            {ALL_CONDITIONS.map(cond => {
              const active = targetToken?.conditions?.includes(cond);
              return (
                <button
                  key={cond}
                  onClick={() => {
                    socket.emit('toggle_condition', { tokenId: contextMenu.tokenId, condition: cond });
                    onClose();
                  }}
                  className={`text-left text-[10px] px-2 py-1 rounded flex items-center gap-1 ${
                    active ? 'bg-accentGold text-black' : 'text-textLight hover:bg-borderDark'
                  }`}
                >
                  <span>{CONDITION_ICONS[cond]}</span>
                  {cond}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => {
              socket.emit('clear_conditions', { tokenId: contextMenu.tokenId });
              onClose();
            }}
            className="mt-2 w-full text-[9px] text-red-400 hover:text-red-300 py-1"
          >
            Clear All
          </button>
        </>
      )}

      {/* Recall Token */}
      {targetToken.type === 'npc' && (role === 'DM' || targetToken.ownerId === userId) && (
        <>
          <div className="border-t border-borderDark my-1" />
          <button
            onClick={() => {
              socket.emit('remove_token', contextMenu.tokenId);
              onClose();
            }}
            className="w-full text-left text-[10px] px-2 py-1 rounded text-red-400 hover:bg-borderDark"
          >
            ↩️ Recall to Tray
          </button>
        </>
      )}
    </div>
  );
}