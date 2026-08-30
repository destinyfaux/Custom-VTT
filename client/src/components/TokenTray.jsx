// client/src/components/TokenTray.jsx
import { useState, useEffect } from 'react';
import { socket } from '../socket';
import TokenPicker from './TokenPicker';
import MonsterBrowser from './MonsterBrowser';
import { useTokenList, findMatchingToken } from '../hooks/useTokenList';
import { getUnplacedNpcTokenIds } from '../utils/tokenTrayUtils';

export default function TokenTray({ placingTokenId, setPlacingTokenId }) {
  const { tokens: tokenList } = useTokenList();  // available token filenames
  const [isOpen, setIsOpen] = useState(true); // Start open so DM sees characters initially
  const [tokens, setTokens] = useState([]);
  const [showAddNpc, setShowAddNpc] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  // Added 'quantity' field to default new NPC state
  const [newNpc, setNewNpc] = useState({ name: '', avatarUrl: '', hp: 10, ac: 10, quantity: 1 });
  const [showMonsterBrowser, setShowMonsterBrowser] = useState(false);
  // Store the active group we are changing the avatar for
  const [selectingImageForGroup, setSelectingImageForGroup] = useState(null);

  // 1) Listen for full state updates (covers recalls, deletions, etc.)
  useEffect(() => {
    // Baseline state sync
    const handleStateSync = (state) => {
      setTokens(state.tokens || []);
    };

    // Lightweight additions
    const handleTokenAdded = ({ token }) => {
      if (!token) return;
      setTokens(prev => {
        if (prev.some(t => t.id === token.id)) {
          return prev.map(t => t.id === token.id ? token : t);
        }
        return [...prev, token];
      });
    };

    const handleNpcBatchAdded = ({ tokens: batchTokens = [] }) => {
      if (!batchTokens.length) return;
      setTokens(prev => {
        const existingIds = new Set(prev.map(t => t.id));
        const filteredNew = batchTokens.filter(t => !existingIds.has(t.id));
        return [...prev, ...filteredNew];
      });
    };

    const handleTokenFinalPosition = ({ tokenId, isPlaced }) => {
      setTokens(prev => prev.map(t =>
        t.id === tokenId ? { ...t, isPlaced: isPlaced ?? true } : t
      ));
    };

    // Recalls (when a token is removed from the canvas back to the tray)
    const handleTokenRemoved = ({ tokenId }) => {
      setTokens(prev => prev.map(t =>
        t.id === tokenId ? { ...t, isPlaced: false } : t
      ));
    };

    // Deletions (when tokens are permanently erased from the tray)
    const handleTokenDeleted = ({ tokenId }) => {
      setTokens(prev => prev.filter(t => t.id !== tokenId));
    };

    const handleTokensDeleted = ({ tokenIds = [] }) => {
      const idSet = new Set(tokenIds);
      setTokens(prev => prev.filter(t => !idSet.has(t.id)));
    };

    // Avatar updates
    const handleTokenAvatarUpdated = ({ tokenId, avatarUrl }) => {
      setTokens(prev => prev.map(t =>
        t.id === tokenId ? { ...t, avatarUrl } : t
      ));
    };

    // ─── Register Listeners ───
    socket.on('init_state', handleStateSync);
    socket.on('state_update', handleStateSync);
    socket.on('npc_added', handleTokenAdded);
    socket.on('token_added', handleTokenAdded);
    socket.on('npc_batch_added', handleNpcBatchAdded);
    socket.on('token_final_position', handleTokenFinalPosition);
    socket.on('token_removed', handleTokenRemoved);
    socket.on('token_deleted', handleTokenDeleted);
    socket.on('tokens_deleted', handleTokensDeleted);
    socket.on('token_avatar_updated', handleTokenAvatarUpdated);

    return () => {
      socket.off('init_state', handleStateSync);
      socket.off('state_update', handleStateSync);
      socket.off('npc_added', handleTokenAdded);
      socket.off('token_added', handleTokenAdded);
      socket.off('npc_batch_added', handleNpcBatchAdded);
      socket.off('token_final_position', handleTokenFinalPosition);
      socket.off('token_removed', handleTokenRemoved);
      socket.off('token_deleted', handleTokenDeleted);
      socket.off('tokens_deleted', handleTokensDeleted);
      socket.off('token_avatar_updated', handleTokenAvatarUpdated);
    };
  }, []);

  const unplacedTokens = tokens.filter(t => !t.isPlaced);

  // Group unplaced tokens by name, type, and avatar so they stack cleanly
  const groupedTokens = [];
  unplacedTokens.forEach(token => {
    const key = `${token.name}_${token.type}_${token.avatarUrl || ''}`;
    let group = groupedTokens.find(g => g.key === key);
    if (!group) {
      group = {
        key,
        name: token.name,
        type: token.type,
        avatarUrl: token.avatarUrl,
        tokens: []
      };
      groupedTokens.push(group);
    }
    group.tokens.push(token);
  });

  const handleSpawnGroup = (group) => {
    // Find if any token in this group is currently being placed
    const activeTokenInGroup = group.tokens.find(t => t.id === placingTokenId);

    if (activeTokenInGroup) {
      // Toggle off if clicking spawn again on an already active placement
      setPlacingTokenId(null);
    } else {
      // Select the first available unplaced token from the stack to put into placement mode
      if (group.tokens.length > 0) {
        setPlacingTokenId(group.tokens[0].id);
      }
    }
  };

  const createNpc = (e) => {
    e.preventDefault();
    const qty = Math.max(1, parseInt(newNpc.quantity) || 1);

    if (!newNpc.name.trim()) return;

    let avatarUrl = newNpc.avatarUrl;
    if (!avatarUrl) {
      const matched = findMatchingToken(newNpc.name, tokenList);
      if (matched) avatarUrl = matched;
    }

    const creatures = Array.from({ length: qty }, () => ({
      name: newNpc.name,
      avatarUrl,
      hp: newNpc.hp,
      ac: newNpc.ac,
      size: 1
    }));

    socket.emit('add_npcs', { creatures });

    setNewNpc({ name: '', avatarUrl: '', hp: 10, ac: 10, quantity: 1 });
    setShowAddNpc(false);
    setShowPicker(false);
  };

  const selectIcon = (url) => {
    setNewNpc(prev => ({ ...prev, avatarUrl: url }));
    setShowPicker(false);
  };

  const recallAll = () => {
    if (window.confirm("Recall all placed tokens to the tray?")) {
      // Loop through currently placed tokens and 'remove' them (which recalls players)
      tokens.filter(t => t.isPlaced).forEach(t => {
        socket.emit('remove_token', t.id);
      });
    }
  };

  const clearNpcTrayTokens = () => {
    const npcTokenIds = getUnplacedNpcTokenIds(tokens);
    if (npcTokenIds.length === 0) return;

    if (window.confirm(`Clear ${npcTokenIds.length} unplaced NPC token${npcTokenIds.length === 1 ? '' : 's'} from the tray?`)) {
      socket.emit('delete_tokens', { tokenIds: npcTokenIds });
    }
  };

  // Manual refresh button – forces full state resync
  const handleRefreshTray = () => {
    console.log('[TokenTray] Manual refresh requested');
    socket.emit('request_full_state');
  };

  return (
    <div className="bg-bgPanel rounded border border-borderDark mb-2 overflow-hidden">
      {/* Visual Icon Selection (Floating Window) */}
      {showPicker && (
        <TokenPicker 
          onSelect={selectIcon} 
          onClose={() => setShowPicker(false)} 
        />
      )}

      {/* Monster Browser (Floating Window) */}
      {showMonsterBrowser && (
        <MonsterBrowser onClose={() => setShowMonsterBrowser(false)} />
      )}

      {/* TokenPicker for changing avatar of an entire NPC stack */}
      {selectingImageForGroup && (
        <TokenPicker
          onSelect={(url) => {
            // Update the avatar for every individual token currently in this stack
            selectingImageForGroup.tokens.forEach(t => {
              socket.emit('update_token_avatar', { tokenId: t.id, avatarUrl: url });
            });
            setSelectingImageForGroup(null);
          }}
          onClose={() => setSelectingImageForGroup(null)}
        />
      )}

      {/* Collapsible Header */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center p-2 bg-bgCard hover:bg-borderDark transition-colors"
      >
        <h3 className="text-accentGold text-[10px] font-bold uppercase tracking-wider italic">Token Tray</h3>
        <div className="flex items-center gap-2">
            {unplacedTokens.length > 0 && !isOpen && (
                <span className="bg-accentGold text-black text-[8px] px-1 rounded font-bold">
                    {unplacedTokens.length}
                </span>
            )}
            <span className="text-accentGold text-xs">{isOpen ? '−' : '+'}</span>
        </div>
      </button>

      {isOpen && (
        <div className="p-3 border-t border-borderDark animate-in slide-in-from-top-2 duration-200">
          
          {/* Top Controls Row */}
          <div className="flex justify-between items-center mb-3">
            <div className="flex flex-wrap gap-2">
              <button 
                onClick={recallAll}
                className="bg-borderDark text-textMuted px-2 py-1 rounded text-[9px] hover:text-white font-bold transition-colors border border-transparent hover:border-accentGold"
              >
                RECALL ALL
              </button>
              <button 
                onClick={() => {
                  setShowAddNpc(!showAddNpc);
                  setPlacingTokenId(null); // Cancel placement mode if adding NPC
                  if (showPicker) setShowPicker(false);
                }}
                className={`px-2 py-1 rounded text-[9px] font-bold transition-colors ${showAddNpc ? 'bg-red-900 text-white' : 'bg-bgCard text-accentGold border border-borderDark hover:bg-borderDark'}`}
              >
                {showAddNpc ? 'CANCEL' : '+ NPC'}
              </button>
              <button 
                onClick={() => {
                  setShowMonsterBrowser(true);
                  setPlacingTokenId(null);   // cancel placement mode
                  setShowPicker(false);      // close icon picker
                  setShowAddNpc(false);      // close NPC form
                }}
                className="px-2 py-1 rounded text-[9px] font-bold bg-bgCard text-accentGold border border-borderDark hover:bg-borderDark transition-colors"
              >
                SEARCH MONSTER
              </button>
              <button 
                onClick={clearNpcTrayTokens}
                className="px-2 py-1 rounded text-[9px] font-bold bg-red-900 text-white hover:bg-red-700 transition-colors"
                title="Remove all unplaced NPC tokens from the tray"
              >
                CLEAR NPCS
              </button>
              {/* ★ MANUAL REFRESH BUTTON ★ */}
              <button 
                onClick={handleRefreshTray}
                className="px-2 py-1 rounded text-[9px] font-bold bg-accentGold text-black hover:bg-yellow-500 transition-colors"
                title="Force a full state resync"
              >
                ↻ REFRESH TRAY
              </button>
            </div>
          </div>

          {/* Add NPC Form */}
          {showAddNpc && (
            <form onSubmit={createNpc} className="bg-bgCard p-3 rounded border border-accentGold mb-4 space-y-3 shadow-xl">
              <div className="space-y-1">
                <input 
                  className="w-full bg-bgPanel p-2 text-[10px] text-white border border-borderDark rounded outline-none focus:border-accentGold"
                  placeholder="NPC Name..."
                  value={newNpc.name}
                  onChange={e => setNewNpc({...newNpc, name: e.target.value})}
                  required
                />
              </div>

              <div className="space-y-1">
                <button 
                  type="button"
                  onClick={() => setShowPicker(!showPicker)}
                  className="w-full flex items-center gap-3 bg-bgPanel p-2 rounded border border-borderDark hover:border-accentGold transition-colors text-left"
                >
                  <div className="w-6 h-6 rounded-full bg-bgCard border border-borderDark overflow-hidden flex items-center justify-center flex-shrink-0">
                    {newNpc.avatarUrl ? <img src={newNpc.avatarUrl} className="w-full h-full object-cover" /> : <span className="text-[10px]">🖼️</span>}
                  </div>
                  <span className="text-[9px] text-textMuted">{newNpc.avatarUrl ? "Icon Selected" : "Select Icon..."}</span>
                </button>
              </div>

              {/* Three-column configuration row: HP, AC, and Quantity */}
              <div className="flex gap-2">
                <div className="w-1/3 flex flex-col gap-0.5">
                  <span className="text-[7px] text-textMuted uppercase text-center font-bold">HP</span>
                  <input
                    type="number"
                    className="w-full bg-bgPanel p-1 text-[10px] text-white border border-borderDark rounded text-center"
                    placeholder="HP"
                    value={newNpc.hp}
                    onChange={e => setNewNpc({ ...newNpc, hp: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="w-1/3 flex flex-col gap-0.5">
                  <span className="text-[7px] text-textMuted uppercase text-center font-bold">AC</span>
                  <input
                    type="number"
                    className="w-full bg-bgPanel p-1 text-[10px] text-white border border-borderDark rounded text-center"
                    placeholder="AC"
                    value={newNpc.ac}
                    onChange={e => setNewNpc({ ...newNpc, ac: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="w-1/3 flex flex-col gap-0.5">
                  <span className="text-[7px] text-textMuted uppercase text-center font-bold">Qty</span>
                  <input
                    type="number"
                    min="1"
                    className="w-full bg-bgPanel p-1 text-[10px] text-white border border-borderDark rounded text-center"
                    placeholder="Qty"
                    value={newNpc.quantity}
                    onChange={e => setNewNpc({ ...newNpc, quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                  />
                </div>
              </div>
              <button type="submit" className="w-full bg-accentGold text-black text-[9px] font-bold py-1.5 rounded hover:bg-yellow-500">
                CREATE NPC
              </button>
            </form>
          )}

          {/* Unplaced Token List */}
          <div className="space-y-1 max-h-60 overflow-y-auto pr-1 scrollbar-hide">
            {groupedTokens.length === 0 && !showAddNpc && (
              <div className="text-[9px] text-textMuted italic text-center py-4 bg-bgCard rounded border border-dashed border-borderDark">
                No tokens in tray
              </div>
            )}
            {groupedTokens.map(group => {
              const isCurrentTarget = group.tokens.some(t => t.id === placingTokenId);
              
              return (
                <div 
                  key={group.key} 
                  className={`flex items-center justify-between bg-bgCard p-1.5 rounded border transition-all ${isCurrentTarget ? 'border-white ring-1 ring-white shadow-lg scale-[1.02]' : 'border-borderDark hover:border-accentGold'}`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-bgPanel border border-borderDark overflow-hidden flex-shrink-0">
                      {group.avatarUrl ? (
                        <img src={group.avatarUrl} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] text-textMuted">
                          {group.name.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] text-white font-bold truncate max-w-[70px] leading-tight" title={group.name}>
                          {group.name}
                        </span>
                        {group.tokens.length > 1 && (
                          <span className="bg-bgPanel text-accentGold text-[8px] px-1 py-0.2 rounded border border-borderDark font-extrabold">
                            x{group.tokens.length}
                          </span>
                        )}
                      </div>
                      <span className={`text-[7px] uppercase font-bold ${group.type === 'player' ? 'text-accentGold' : 'text-red-400'}`}>
                        {group.type}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex gap-1">
                    <button 
                      onClick={() => handleSpawnGroup(group)}
                      className={`${isCurrentTarget ? 'bg-white text-black' : 'bg-accentGold text-black'} text-[8px] font-bold px-2 py-1 rounded transition-all`}
                    >
                      {isCurrentTarget ? 'CANCEL' : 'SPAWN'}
                    </button>
                    
                    {/* NPC avatar change button (applies to all in stack) */}
                    {group.type === 'npc' && !isCurrentTarget && (
                      <button
                        onClick={() => setSelectingImageForGroup(group)}
                        className="bg-blue-900 text-white text-[8px] px-1.5 rounded hover:bg-blue-600 transition-colors"
                        title="Change token image for all"
                      >
                        🖼️
                      </button>
                    )}

                    {/* Delete button (deletes one item from the stack pool) */}
                    {group.type === 'npc' && !isCurrentTarget && (
                      <button 
                        onClick={() => socket.emit('delete_tokens', { tokenIds: group.tokens.map(t => t.id) })} 
                        className="bg-red-900 text-white text-[9px] px-1.5 rounded hover:bg-red-600 transition-colors"
                        title="Remove stack"
                      >
                        &times;
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}