// client/src/components/DMHandouts.jsx
import { useState } from 'react';
import { socket } from '../socket';
import HandoutPicker from './HandoutPicker';

export default function DMHandouts() {
  const [isOpen, setIsOpen] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const pushHandout = (url) => {
    socket.emit('push_handout', url);
  };

  return (
    <div className="bg-bgPanel rounded border border-borderDark mb-2 overflow-hidden">
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="w-full flex justify-between items-center p-2 bg-bgCard hover:bg-borderDark transition-colors"
      >
        <h3 className="text-accentGold text-[10px] font-bold uppercase tracking-wider italic">Handouts</h3>
        <span className="text-accentGold text-xs">{isOpen ? '−' : '+'}</span>
      </button>

      {isOpen && (
        <div className="p-3 border-t border-borderDark space-y-2 animate-in slide-in-from-top-2 duration-200">
          <button 
            onClick={() => setShowPicker(true)}
            className="w-full bg-accentGold text-black font-bold py-2 rounded text-[10px] hover:bg-yellow-500 transition-colors shadow-lg"
          >
            OPEN HANDOUT LIBRARY
          </button>
          
          <button 
            onClick={() => socket.emit('clear_handout')}
            className="w-full bg-red-900 text-white font-bold py-1 rounded text-[9px] hover:bg-red-800 transition-colors"
          >
            CLEAR FOR ALL PLAYERS
          </button>

          {showPicker && (
            <HandoutPicker 
              onSelect={pushHandout} 
              onClose={() => setShowPicker(false)} 
            />
          )}
        </div>
      )}
    </div>
  );
}