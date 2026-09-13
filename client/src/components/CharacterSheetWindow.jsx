import { useEffect, useState } from 'react';
import { SERVER_URL } from '../config';
import { getSessionToken } from '../auth';
import { socket } from '../socket';
import CharacterSheet from './character/CharacterSheet';

const tabs = [
  ['stats', 'Stats'], ['skills', 'Skills'], ['senses', 'Senses'],
  ['actions', 'Actions'], ['gear', 'Gear'], ['features', 'Features'],
  ['spells', 'Spells'], ['appearance', 'Appearance'], ['journal', 'Journal']
];

export default function CharacterSheetWindow() {
  const [character, setCharacter] = useState(null);
  const [activeTab, setActiveTab] = useState('stats');
  const [status, setStatus] = useState('Loading account...');
  const token = getSessionToken();

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setStatus('Sign in on the main VTT first, then open the character sheet.');
      return undefined;
    }

    fetch(`${SERVER_URL}/api/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    })
      .then((res) => res.json())
      .then(async (auth) => {
        if (!auth.success || !auth.user) throw new Error('Your session has expired. Sign in again.');
        if (auth.user.role === 'DM') throw new Error('DMs use the main table workspace.');
        const response = await fetch(`${SERVER_URL}/api/characters`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const characters = await response.json();
        if (!response.ok || !Array.isArray(characters) || !characters.length) {
          throw new Error('No character is saved in this account yet.');
        }
        const activeId = localStorage.getItem('vtt_active_character_id');
        const selected = characters.find((item) => item.id === activeId) || characters[0];
        if (cancelled) return;
        localStorage.setItem('vtt_active_character_id', selected.id);
        localStorage.setItem('tome_data', JSON.stringify(selected.data || {}));
        setCharacter(selected);
        setStatus('');
        socket.auth = {
          userId: auth.user.userId,
          role: 'Player',
          name: selected.name,
          characterId: selected.id,
          sessionToken: token,
          roomCode: localStorage.getItem('vtt_room_code') || ''
        };
        if (!socket.connected) socket.connect();
      })
      .catch((error) => {
        if (!cancelled) setStatus(error.message);
      });

    return () => {
      cancelled = true;
      if (socket.connected) socket.disconnect();
    };
  }, [token]);

  if (status) {
    return <div className="min-h-screen bg-bgDark text-textLight flex items-center justify-center p-8 text-center">{status}</div>;
  }

  return (
    <main className="min-h-screen bg-bgDark text-textLight p-4 md:p-8">
      <div className="max-w-[1600px] mx-auto bg-bgPanel border border-borderDark rounded-2xl shadow-2xl overflow-hidden">
        <header className="flex flex-wrap items-center justify-between gap-3 p-5 border-b border-borderDark">
          <div>
            <p className="text-accentGold text-xs uppercase tracking-[0.25em] font-bold">Character Sheet</p>
            <h1 className="text-2xl font-extrabold">{character?.name || 'Adventurer'}</h1>
          </div>
          <button
            type="button"
            onClick={() => window.close()}
            className="px-3 py-2 text-xs font-bold border border-borderDark rounded-lg hover:border-accentGold"
          >
            Close Window
          </button>
        </header>
        <nav className="flex gap-2 overflow-x-auto p-3 border-b border-borderDark">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap ${
                activeTab === id ? 'bg-accentGold text-black' : 'bg-bgCard text-textMuted hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="p-4 md:p-8 min-h-[calc(100vh-170px)]">
          <CharacterSheet tab={activeTab} role="Player" />
        </div>
      </div>
    </main>
  );
}
