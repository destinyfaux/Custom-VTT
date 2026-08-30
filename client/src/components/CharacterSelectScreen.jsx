// client/src/components/CharacterSelectScreen.jsx
import { useState, useEffect, useRef } from 'react';
import { SERVER_URL } from '../config';

export default function CharacterSelectScreen({
  user,
  onSelectCharacter,
  onCreateNew,
  onLogout
}) {
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [backgroundUrl, setBackgroundUrl] = useState(null);
  const [hasLocalMigration, setHasLocalMigration] = useState(false);
  const [localData, setLocalData] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  // State for character deletion confirmation modal
  const [characterToDelete, setCharacterToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fileInputRef = useRef(null);

  // 1. Fetch Dynamic Background Media (matching LoginScreen)
  useEffect(() => {
    fetch(`${SERVER_URL}/api/login-background`)
      .then((res) => res.json())
      .then((data) => setBackgroundUrl(data.url))
      .catch(() => setBackgroundUrl(null));
  }, []);

  // 2. Fetch User's Characters from Server Database
  const fetchCharacters = async () => {
    const token = localStorage.getItem('vtt_session_token');
    try {
      const res = await fetch(`${SERVER_URL}/api/characters`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setCharacters(Array.isArray(data) ? data : []);
      setLoading(false);
    } catch (err) {
      console.error('[Character Vault] Error fetching characters:', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCharacters();

    // Check if the current browser window has an unsaved character in localStorage
    try {
      const raw = localStorage.getItem('tome_data');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.name) {
          setLocalData(parsed);
          setHasLocalMigration(true);
        }
      }
    } catch (e) {}
  }, []);

  // 3. Claim / Import Unsaved Local Cache
  const handleClaimLocal = async () => {
    if (!localData) return;
    const token = localStorage.getItem('vtt_session_token');
    try {
      const res = await fetch(`${SERVER_URL}/api/characters/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ sheetData: localData })
      });
      const result = await res.json();
      if (result.success) {
        setSuccessMessage(`Imported "${localData.name}" into your account vault!`);
        setHasLocalMigration(false);
        fetchCharacters();
      }
    } catch (err) {
      setErrorMessage('Failed to save cached character to server.');
    }
  };

  // 4. Import Character File (.json) from PC
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (!parsed || typeof parsed !== 'object' || !parsed.name) {
          setErrorMessage('Invalid character file. Could not find character name.');
          return;
        }

        const token = localStorage.getItem('vtt_session_token');
        const res = await fetch(`${SERVER_URL}/api/characters/save`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ sheetData: parsed })
        });
        const result = await res.json();

        if (result.success) {
          setSuccessMessage(`Successfully imported "${parsed.name}"!`);
          setErrorMessage('');
          fetchCharacters();
        } else {
          setErrorMessage(result.error || 'Failed to import character.');
        }
      } catch (err) {
        setErrorMessage('Failed to read or parse JSON character file.');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  // 5. Export Character File (.json) to PC
  const handleExportCharacter = (e, char) => {
    e.stopPropagation();
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(char.data || char, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `${(char.name || 'character').replace(/\s+/g, '_')}_sheet.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  // 6. Delete Character from Server Vault
  const handleConfirmDelete = async () => {
    if (!characterToDelete) return;
    setIsDeleting(true);

    const token = localStorage.getItem('vtt_session_token');
    try {
      const res = await fetch(`${SERVER_URL}/api/characters/${characterToDelete.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = await res.json();
      setIsDeleting(false);

      if (res.ok && result.success) {
        setSuccessMessage(`Deleted "${characterToDelete.name}" from your vault.`);
        setErrorMessage('');
        
        // Clean up localStorage active id if it was the deleted character
        if (localStorage.getItem('vtt_active_character_id') === characterToDelete.id) {
          localStorage.removeItem('vtt_active_character_id');
        }

        setCharacterToDelete(null);
        fetchCharacters();
      } else {
        setErrorMessage(result.error || 'Failed to delete character.');
        setCharacterToDelete(null);
      }
    } catch (err) {
      setIsDeleting(false);
      setErrorMessage('Network error while attempting to delete character.');
      setCharacterToDelete(null);
    }
  };

  const isVideo = backgroundUrl && /\.(mp4|webm|mov)$/i.test(backgroundUrl);

  return (
    <div className="h-screen w-screen relative bg-bgDark overflow-hidden select-none flex items-center justify-center p-4">
      {/* Background Media Engine */}
      {backgroundUrl ? (
        isVideo ? (
          <video
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          >
            <source src={`${SERVER_URL}${backgroundUrl}`} />
          </video>
        ) : (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${SERVER_URL}${backgroundUrl})` }}
          />
        )
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#0b0c10] via-[#1f2833] to-[#0b0c10]" />
      )}

      {/* Darkened Atmosphere Overlay */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" />

      {/* Hidden File Input for JSON Imports */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".json"
        className="hidden"
      />

      {/* Main Character Selection Vault Portal */}
      <div className="relative z-10 w-full max-w-2xl bg-[#12141a]/95 backdrop-blur-xl border border-accentGold/40 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.85)] p-8 flex flex-col items-center animate-in zoom-in duration-300">
        
        {/* Header */}
        <div className="flex justify-between items-center w-full mb-5 border-b border-borderDark/60 pb-4">
          <div>
            <h2 className="text-2xl font-extrabold text-accentGold tracking-wider flex items-center gap-2">
              <span>⚔️</span> Character Vault
            </h2>
            <p className="text-xs text-textMuted mt-0.5">
              Logged in as <strong className="text-white">{user?.username || 'Adventurer'}</strong>
            </p>
          </div>
          <button
            onClick={onLogout}
            className="text-xs font-semibold text-red-400 hover:text-red-300 border border-red-900/60 bg-red-950/30 px-3 py-1.5 rounded-lg transition-all hover:bg-red-900/50"
          >
            Log Out
          </button>
        </div>

        {/* Feedback Banners */}
        {errorMessage && (
          <div className="w-full text-center text-xs text-red-400 bg-red-950/40 border border-red-800/60 p-2.5 rounded-xl mb-3 animate-in fade-in">
            {errorMessage}
          </div>
        )}
        {successMessage && (
          <div className="w-full text-center text-xs text-green-400 bg-green-950/40 border border-green-800/60 p-2.5 rounded-xl mb-3 animate-in fade-in">
            {successMessage}
          </div>
        )}

        {/* Local Cache Recovery Notice */}
        {hasLocalMigration && (
          <div className="w-full bg-yellow-950/40 border border-accentGold/60 rounded-xl p-3 mb-4 flex items-center justify-between text-xs shadow-inner">
            <span className="text-yellow-200">
              ⚡ Found cached character sheet <strong>"{localData.name}"</strong> on this device.
            </span>
            <button
              onClick={handleClaimLocal}
              className="bg-accentGold text-black font-bold px-3 py-1.5 rounded-lg hover:bg-yellow-500 transition-all uppercase text-[10px] tracking-wider shadow-md"
            >
              Claim to Account
            </button>
          </div>
        )}

        {/* Character Vault Cards Grid */}
        {loading ? (
          <div className="py-16 text-accentGold text-sm font-semibold animate-pulse flex flex-col items-center gap-2">
            <span>🛡️</span>
            <span>Opening Character Vault...</span>
          </div>
        ) : (
          <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-3.5 max-h-80 overflow-y-auto pr-1.5 mb-6 scrollbar-hide">
            {characters.map((char) => (
              <div
                key={char.id}
                onClick={() => onSelectCharacter(char)}
                className="group relative flex items-center justify-between p-3.5 rounded-xl border border-borderDark/80 bg-bgCard/90 hover:border-accentGold hover:bg-[#1a1d24] cursor-pointer transition-all duration-200 hover:scale-[1.02] shadow-md"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-bgPanel border border-accentGold/50 flex items-center justify-center shrink-0 shadow-inner">
                    {char.avatarUrl || char.data?.avatarUrl ? (
                      <img src={char.avatarUrl || char.data?.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-lg font-black text-accentGold">
                        {(char.name || '?').charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-white group-hover:text-accentGold truncate transition-colors">
                      {char.name}
                    </h3>
                    <p className="text-[11px] text-textMuted truncate">
                      Level {char.data?.lvl || 1} • {char.data?.class || 'Adventurer'}
                    </p>
                    <div className="flex gap-2 text-[9px] text-textMuted mt-0.5 font-mono">
                      <span>HP {char.data?.hpCur ?? char.data?.hpMax ?? 10}/{char.data?.hpMax || 10}</span>
                      <span>•</span>
                      <span>AC {char.data?.ac || 10}</span>
                    </div>
                  </div>
                </div>

                {/* Card Actions: Export & Delete */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={(e) => handleExportCharacter(e, char)}
                    title="Export Character JSON backup"
                    className="p-1.5 text-textMuted hover:text-accentGold rounded-lg hover:bg-black/40 transition-colors"
                  >
                    ⬇️
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCharacterToDelete(char);
                    }}
                    title="Delete Character from vault"
                    className="p-1.5 text-textMuted hover:text-red-400 rounded-lg hover:bg-black/40 transition-colors text-xs"
                  >
                    🗑️
                  </button>
                  <span className="text-accentGold font-bold text-xs group-hover:translate-x-1 transition-transform ml-1">
                    Enter →
                  </span>
                </div>
              </div>
            ))}

            {characters.length === 0 && (
              <div className="col-span-2 text-center py-12 border border-dashed border-borderDark/80 rounded-xl bg-black/20 text-textMuted text-xs italic">
                No characters found in your vault. Create a new one or import an existing sheet file below.
              </div>
            )}
          </div>
        )}

        {/* Bottom Gateway Controls */}
        <div className="flex w-full gap-3 pt-2 border-t border-borderDark/40">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 bg-bgCard hover:bg-borderDark border border-borderDark hover:border-accentGold/60 text-white font-extrabold py-3 rounded-xl transition-all uppercase tracking-wider text-xs shadow-md flex items-center justify-center gap-2"
          >
            📁 Import Sheet (.json)
          </button>
          <button
            onClick={onCreateNew}
            className="flex-1 bg-accentGold hover:bg-yellow-500 text-black font-extrabold py-3 rounded-xl transition-all uppercase tracking-wider text-xs shadow-lg hover:shadow-[0_0_20px_rgba(230,180,34,0.4)] flex items-center justify-center gap-2"
          >
            ➕ Create Character
          </button>
        </div>
      </div>

      {/* Confirmation Modal for Character Deletion */}
      {characterToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#12141a] border border-red-700/60 rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center animate-in zoom-in duration-200">
            <span className="text-3xl mb-2 block">⚠️</span>
            <h3 className="text-red-400 font-extrabold text-base uppercase tracking-wider mb-2">
              Delete Character?
            </h3>
            <p className="text-xs text-textLight leading-relaxed mb-6">
              Are you sure you want to permanently delete <strong className="text-white">"{characterToDelete.name}"</strong> from your server vault? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setCharacterToDelete(null)}
                disabled={isDeleting}
                className="flex-1 bg-bgCard border border-borderDark hover:border-white/40 text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-extrabold py-2.5 rounded-xl text-xs uppercase tracking-wider transition-colors shadow-lg shadow-red-950/50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}