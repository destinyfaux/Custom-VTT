// client/src/components/CheckRequestPanel.jsx
import { useState, useEffect } from 'react';
import { socket } from '../socket';

const SKILLS = [
  'Acrobatics', 'Animal Handling', 'Arcana', 'Athletics',
  'Deception', 'History', 'Insight', 'Intimidation',
  'Investigation', 'Medicine', 'Nature', 'Perception',
  'Performance', 'Persuasion', 'Religion',
  'Sleight of Hand', 'Stealth', 'Survival'
];

const ABILITIES = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

export default function CheckRequestPanel({ onClose, players = [] }) {
  const [targetUserId, setTargetUserId] = useState('');
  const [checkType, setCheckType] = useState('skill'); // 'skill' or 'ability'
  const [skillOrAbility, setSkillOrAbility] = useState('Perception');
  const [dc, setDc] = useState(15);
  const [reason, setReason] = useState('');
  const [pos, setPos] = useState({ x: window.innerWidth - 450, y: 100 });
  const [size, setSize] = useState({ w: 340, h: 380 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragStart = useState({ x: 0, y: 0 })[0];
  const resizeStart = useState({ w: 0, h: 0, mouseX: 0, mouseY: 0 })[0];

  // Fixed socket listeners – request player list on mount and listen to updates
  useEffect(() => {
    if (checkType === 'ability') {
      setSkillOrAbility('STR');   // default ability
    } else {
      setSkillOrAbility('Perception'); // default skill
    }
  }, [checkType]);

  // Ensure a player is selected
  const handleSend = () => {
    if (!targetUserId) {
      alert('Please select a player first.');
      return;
    }
    // Double‑check the player still exists in the list
    const stillExists = players.some(p => p.userId === targetUserId);
    if (!stillExists) {
      alert('Selected player is no longer available.');
      setTargetUserId('');
      return;
    }
    socket.emit('request_check', {
      targetUserId,
      checkType,          // 'skill' or 'ability'
      skillOrAbility,     // e.g. 'Perception' or 'STR'
      dc: parseInt(dc),
      reason
    });
    onClose();
  };

  // Draggable / resizable logic (reuse pattern from HandoutPicker)
  const handleMouseDown = (e) => {
    if (e.target.tagName === 'HEADER' || e.target.parentElement?.tagName === 'HEADER') {
      setIsDragging(true);
      dragStart.x = e.clientX - pos.x;
      dragStart.y = e.clientY - pos.y;
    }
  };
  const handleResizeDown = (e) => {
    e.preventDefault(); e.stopPropagation();
    setIsResizing(true);
    resizeStart.w = size.w; resizeStart.h = size.h;
    resizeStart.mouseX = e.clientX; resizeStart.mouseY = e.clientY;
  };
  useEffect(() => {
    const move = (e) => {
      if (isDragging) setPos({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
      if (isResizing) setSize({ w: Math.max(280, resizeStart.w + e.clientX - resizeStart.mouseX), h: Math.max(300, resizeStart.h + e.clientY - resizeStart.mouseY) });
    };
    const up = () => { setIsDragging(false); setIsResizing(false); };
    if (isDragging || isResizing) {
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
    }
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, [isDragging, isResizing]);

  return (
    <div
      className="fixed z-[1000] bg-bgPanel border border-accentGold rounded-lg shadow-2xl flex flex-col overflow-hidden"
      style={{ left: pos.x, top: pos.y, width: size.w, height: size.h }}
      onMouseDown={handleMouseDown}
    >
      <header className="bg-bgCard p-3 flex justify-between items-center cursor-move border-b border-borderDark shrink-0">
        <span className="text-accentGold font-bold text-[10px] uppercase tracking-widest">Request Check</span>
        <button onClick={onClose} className="text-textMuted hover:text-white px-2">✕</button>
      </header>

      <div className="p-4 space-y-3 flex-1 text-xs">
        {/* Target player */}
        <select
          className="w-full bg-bgCard text-white p-2 border border-borderDark rounded"
          value={targetUserId}
          onChange={e => setTargetUserId(e.target.value)}
        >
          <option value="">Select player...</option>
          {players.map(p => (
            <option key={p.userId} value={p.userId}>{p.name}</option>
          ))}
        </select>

        {/* Check type */}
        <div className="flex gap-2">
          <button
            className={`flex-1 py-1 rounded ${checkType === 'skill' ? 'bg-accentGold text-black' : 'bg-bgCard text-textLight'}`}
            onClick={() => setCheckType('skill')}
          >Skill</button>
          <button
            className={`flex-1 py-1 rounded ${checkType === 'ability' ? 'bg-accentGold text-black' : 'bg-bgCard text-textLight'}`}
            onClick={() => setCheckType('ability')}
          >Saving Throw</button>
        </div>

        {/* Skill/Ability selector */}
        <select
          className="w-full bg-bgCard text-white p-2 border border-borderDark rounded"
          value={skillOrAbility}
          onChange={e => setSkillOrAbility(e.target.value)}
        >
          {(checkType === 'skill' ? SKILLS : ABILITIES).map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>

        {/* DC input */}
        <div className="flex items-center gap-2">
          <span className="text-textMuted">DC:</span>
          <input
            type="number"
            min="1"
            max="50"
            value={dc}
            onChange={e => setDc(e.target.value)}
            className="w-20 bg-bgCard text-white p-1 text-center border border-borderDark rounded"
          />
        </div>

        {/* Reason */}
        <input
          type="text"
          placeholder="Reason (optional)"
          value={reason}
          onChange={e => setReason(e.target.value)}
          className="w-full bg-bgCard text-white p-2 border border-borderDark rounded"
        />

        <button
          onClick={handleSend}
          className="w-full bg-accentGold text-black font-bold py-2 rounded hover:bg-yellow-500 transition-colors"
        >
          SEND REQUEST
        </button>
      </div>

      {/* Resize handle */}
      <div className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize" onMouseDown={handleResizeDown}>
        <div className="w-2 h-2 border-r-2 border-b-2 border-accentGold ml-auto mt-auto mr-1 mb-1 opacity-30" />
      </div>
    </div>
  );
}