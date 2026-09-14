// client/src/App.jsx
import { useEffect, useState, useRef } from 'react';
import { socket } from './socket';
import { getOrGenerateUserId, getRole, getUserName, getSessionToken, clearIdentityStorage } from './auth';
import { SERVER_URL } from "./config";
import soundSynthesizer from './utils/SoundSynthesizer';
import { useResizable } from './hooks/useResizable';

/* ==========================================================================
   COMPONENT IMPORTS: VTT LAYOUT & UTILITIES
   ========================================================================== */
import CanvasMap from './components/CanvasMap';
import DiceTray from './components/DiceTray';
import AudioPlayer from './components/AudioPlayer';
import Sidebar from './components/Sidebar';
import TokenTray from './components/TokenTray';
import DMHandouts from './components/DMHandouts';
import InitiativeBar from './components/InitiativeBar';
import BottomToolbar from './components/BottomToolbar';
import PlayerPrompt from './components/PlayerPrompt';
import ConnectionStatus from './components/ConnectionStatus';
import LoginScreen from './components/LoginScreen';
import CharacterSelectScreen from './components/CharacterSelectScreen';
import CharacterSheetWindow from './components/CharacterSheetWindow';
import PartyPlayerCard from './components/PartyPlayerCard';
import { vaultFetch } from './utils/vaultFetch';

// Restored missing Audio Deck and DM Controls imports
import DMAudioDeck from './components/DMAudioDeck';
import DMControls from './components/DMControls';

/* ==========================================================================
   COMPONENT IMPORTS: MODULAR MODALS & PANELS
   ========================================================================== */
import CombatPanel from './components/CombatPanel';
import StampPicker from './components/StampPicker';
import CheckRequestPanel from './components/CheckRequestPanel';
import CheckPrompt from './components/CheckPrompt';
import DMCharacterViewer from './components/DMCharacterViewer';
import GearModal from './components/character/GearModal';
import CharacterSheet from './components/character/CharacterSheet';
import FXPanel from './components/FXPanel';
// Shape Panel Import
import ShapePanel from './components/ShapePanel';
// System Shock and Death Save Modal Imports
import SystemShockModal from './components/SystemShockModal';
import DeathSaveModal from './components/DeathSaveModal';

/* ==========================================================================
   COMPONENT IMPORTS: BACK-OFFICE / SRD MANAGEMENT
   ========================================================================== */
import SRDManager from './tools/SRDManager/SRDManager';
import { SRDProvider } from './tools/SRDManager/SRDContext';

/* ==========================================================================
   MAIN SYSTEM ENGINE: APP
   ========================================================================== */
function App() {
  // --- Account & Character Selection States ---
  const [currentUser, setCurrentUser] = useState(null);
  // Server-resolved socket identity (guest_<uuid> or account userId).
  // Kept separate from `currentUser` because that state is intentionally
  // null for Quick Play guests — but token ownership checks (End Turn etc.)
  // need the id AS THE SERVER SEES IT for every role.
  const [socketUserId, setSocketUserId] = useState(null);
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  // --- Core Identity States ---
  const [role, setRoleState] = useState(getRole());
  const [name, setName] = useState(getUserName());
  const [players, setPlayers] = useState([]);
  const [chat, setChat] = useState([]);
  const [msg, setMsg] = useState('');
  const [activeMap, setActiveMap] = useState(null);
  const [isSynced, setIsSynced] = useState(true);

  // Environmental / Atmosphere States
  const [weather, setWeather] = useState(null);
  const [dayNight, setDayNight] = useState(null);
  const [music, setMusic] = useState(null);

  // Stamp placement states
  const [stampSize, setStampSize] = useState(64);

  // Wall drawing geometry state
  const [wallType, setWallType] = useState('normal'); // 'normal' | 'door' | 'secret_door' | 'window'

  // Shape Tool states
  const [shapeActive, setShapeActive] = useState(false);
  const [shapeType, setShapeType] = useState('circle');
  const [shapeColor, setShapeColor] = useState('#e6b422');
  const [showShapePanel, setShowShapePanel] = useState(false);
  const [shapeMode, setShapeMode] = useState('draw'); // 'draw' | 'move'

  // Pop-out Triggers
  const [showGearModal, setShowGearModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);

  // System Shock & Death Save Automation States
  const [systemShockData, setSystemShockData] = useState(null);
  const [deathSaveData, setDeathSaveData] = useState(null);

  // --- Resizable Panel Sizing ---
  const { size: leftPanelWidth, startDrag: startDragLeftPanel } = useResizable('leftPanelWidth', 320, 240, 600, 'horizontal');
  const { size: chatHeight, startDrag: startDragChat } = useResizable(`chatHeight_${role}`, role === 'DM' ? 160 : 300, 120, 500, 'vertical');

  // --- Ephemeral Visual Handout States ---
  const [activeHandout, setActiveHandout] = useState(null);

  // --- TOKEN PLACEMENT STATE ---
  // Tracks which token the DM is currently trying to place on the map
  const [placingTokenId, setPlacingTokenId] = useState(null);

  // --- Canvas tool state (lifted up) ---
  const [tool, setTool] = useState('pan');
  const [showGrid, setShowGrid] = useState(true);
  const [lightRadius, setLightRadius] = useState(300);
  const [lightColor, setLightColor] = useState('#e6b422');

  // --- Sidebar tools ---
  const [measureActive, setMeasureActive] = useState(false);
  const [pingActive, setPingActive] = useState(false);

  // --- Combat panel visibility ---
  const [showCombatPanel, setShowCombatPanel] = useState(false);

  // --- Check request panel ---
  const [showCheckPanel, setShowCheckPanel] = useState(false);

  // --- DM viewing character sheet ---
  const [viewingCharacter, setViewingCharacter] = useState(null);

  // Stamp states
  const [showStampPicker, setShowStampPicker] = useState(false);
  const [placingStamp, setPlacingStamp] = useState(null);

  // --- Spell Visual Effects Particles (VFX Engine) ---
  const [fxActive, setFxActive] = useState(false);
  const [fxShape, setFxShape] = useState('AOE');
  const [fxStyle, setFxStyle] = useState('fire');
  const [showFXPanel, setShowFXPanel] = useState(false);

  // --- Structural Refs ---
  const chatContainerRef = useRef(null);
  const lastStateVersion = useRef(0);
  const playersRef = useRef(players);

  // --- Refs for reconnect and state request guards ---
  const hasConnectedWithRole = useRef(null);
  const hasRequestedInitialState = useRef(false);

  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  // --- Death Save Trigger Setup ---
  const handleDeathSaveTrigger = (tokenId, tokenName) => {
    setDeathSaveData({ tokenId, tokenName });
  };

  /* ==========================================
     ROUTE DETECTOR: SRD DATABASE EDITOR
     ========================================== */
  if (window.location.pathname === '/srd-manager') {
    return (
      <SRDProvider>
        <SRDManager />
      </SRDProvider>
    );
  }
  if (window.location.pathname === '/character-sheet') {
    return <CharacterSheetWindow />;
  }

  /* ==========================================
     INITIAL SESSION VERIFICATION (Auto-Login)
     ========================================== */
  useEffect(() => {
    const token = localStorage.getItem('vtt_session_token');
    if (token) {
      fetch(`${SERVER_URL}/api/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      })
        .then((res) => res.json())
        .then((data) => {
            // Do not let a response for an older token erase a newer login.
            if (localStorage.getItem('vtt_session_token') !== token) return;
            if (data.success && data.user) {
            setCurrentUser(data.user);
            setName(data.user.username || '');
            localStorage.setItem('vtt_user_name', data.user.username || '');
            localStorage.setItem('vtt_name', data.user.username || '');
            // A cached character id can belong to a different account. Force
            // character selection so the server remains the source of truth.
            if (data.user.role === 'DM') {
              localStorage.setItem('vtt_role', 'DM');
              localStorage.setItem('vtt_user_role', 'DM');
              setRoleState('DM');
            } else {
              localStorage.removeItem('vtt_role');
              localStorage.removeItem('vtt_user_role');
              setRoleState(null);
            }
          } else {
            clearIdentityStorage();
            setCurrentUser(null);
            setSelectedCharacter(null);
            setRoleState(null);
          }
          setAuthChecked(true);
        })
        .catch(() => {
          if (localStorage.getItem('vtt_session_token') !== token) return;
          clearIdentityStorage();
          setCurrentUser(null);
          setSelectedCharacter(null);
          setRoleState(null);
          setAuthChecked(true);
        });
    } else {
      setAuthChecked(true);
    }
  }, []);

  /* ==========================================
     SOCKET CONNECTION LIFE-CYCLE ENGINE
     ========================================== */
  useEffect(() => {
    // Never connect while the persisted session is still being verified.
    // Otherwise a stale cached role can race verification and become a guest.
    if (!authChecked) {
      if (socket.connected) socket.disconnect();
      return;
    }
    if (!role && !currentUser) {
      if (socket.connected) socket.disconnect();
      return;
    }
    if (role === 'DM' && !currentUser) {
      console.warn('[VTT-System] DM connection blocked: account session was not verified.');
      if (socket.connected) socket.disconnect();
      return;
    }
    if (currentUser && !localStorage.getItem('vtt_session_token')) {
      console.warn('[VTT-System] Account connection blocked: session token is missing.');
      if (socket.connected) socket.disconnect();
      return;
    }

    const currentUserId = currentUser?.userId || getOrGenerateUserId();
    const currentName = selectedCharacter?.data?.name || name || currentUser?.username || 'Adventurer';

    // Build the auth object for the handshake
    const auth = {
      userId: currentUserId,
      characterId: selectedCharacter?.id || null,
      role: currentUser?.role || role,
      name: currentName,
      roomCode: localStorage.getItem('vtt_room_code') || '',
      sessionToken: getSessionToken()
    };

    // Identity key to detect when role/character changes
    const identityKey = `${currentUser?.role || role}-${selectedCharacter?.id || 'none'}`;

    // ─── Socket Listeners ──────────────────────────────────────────────────

    const handleSyncCharacterData = (data) => {
      if (data && data.name) {
        localStorage.setItem('tome_data', JSON.stringify(data));
        localStorage.setItem('vtt_name', data.name);
        setName(data.name);
        setSelectedCharacter(prev => prev ? { ...prev, name: data.name, data } : { id: `char_${currentUserId}`, name: data.name, data });
      }
    };

    // ⭐️ Defensive Map Parser: Handles string URLs, object payloads, and Cloudflare/Local origins cleanly
    const parseMapState = (state) => {
      if (!state) return;

      const rawMap = state.currentMap ?? state.mapUrl ?? state.map;
      if (!rawMap) return;

      let folderName = state.currentMapFolder || '';
      let rawUrl = '';

      if (typeof rawMap === 'string') {
        rawUrl = rawMap;
        if (!folderName) {
          const parts = rawMap.split('/');
          folderName = parts[3] || 'Scene';
        }
      } else if (typeof rawMap === 'object' && rawMap !== null) {
        rawUrl = rawMap.url || rawMap.mapUrl || rawMap.thumbnail || rawMap.path || '';
        folderName = folderName || rawMap.name || rawMap.folderName || 'Scene';
      }

      if (rawUrl && typeof rawUrl === 'string') {
        const fullMapUrl = (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://') && !rawUrl.startsWith('blob:') && !rawUrl.startsWith('data:'))
          ? `${SERVER_URL}${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`
          : rawUrl;

        setActiveMap({
          name: decodeURIComponent(folderName || 'Scene'),
          url: fullMapUrl
        });
      }
    };

    const handleInitState = (state) => {
      console.log('[App] init_state received:', state);
      if (!state) return;

      setPlayers(state.players || []);
      setChat(state.chatLogs || []);
      if (state.weather !== undefined) setWeather(state.weather);
      if (state.dayNight !== undefined) setDayNight(state.dayNight);
      if (state.music !== undefined) setMusic(state.music);
      
      parseMapState(state);

      // If returning player has server data but local storage is empty, restore it
      if (Array.isArray(state.players) && role === 'Player') {
        const me = state.players.find(p => p.userId === currentUserId);
        if (me?.characterData && me.characterData.name) {
          const local = JSON.parse(localStorage.getItem('tome_data') || '{}');
          if (!local || !local.name) {
            localStorage.setItem('tome_data', JSON.stringify(me.characterData));
            setName(me.characterData.name);
          }
        } else if (!me?.characterData || Object.keys(me.characterData).length === 0) {
          // Server has no sheet for us yet (fresh character, or reconnect after
          // a vault race). Push the locally-held sheet once so presence, roster
          // cards, and the vault all reflect the active character immediately.
          try {
            const local = JSON.parse(localStorage.getItem('tome_data') || 'null');
            if (local && local.name) {
              const charId = selectedCharacter?.id || local.id || null;
              socket.emit('sync_character_data', { ...local, ...(charId ? { id: charId } : {}) });
            }
          } catch (e) { /* malformed local sheet — ignore */ }
        }
      }

      if (state._version !== undefined) {
        lastStateVersion.current = state._version;
      }
      setIsSynced(true);
    };

    const handlePlayerListUpdate = (list) => {
      if (Array.isArray(list)) {
        setPlayers(list);
      }
    };
    
    const handleNewChat = (entry) => {
      setChat(prev => [...prev, entry]);
      const type = entry.type || 'global';
      soundSynthesizer.playChatMessage(type);
    };

    // ⭐️ Non-blocking state updates
    const handleStateUpdate = (state) => {
      if (!state) return;

      if (state._version !== undefined) {
        lastStateVersion.current = state._version;
      }

      parseMapState(state);

      if (state.players) setPlayers(state.players);
      if (state.chatLogs) setChat(state.chatLogs);
      if (state.weather !== undefined) setWeather(state.weather);
      if (state.dayNight !== undefined) setDayNight(state.dayNight);
      if (state.music !== undefined) setMusic(state.music);
      
      setIsSynced(true);
    };

    // ─── Targeted Socket Handlers for Instant UI Reactions ───
    const handleMapChanged = (payload) => {
      if (!payload) return;

      if (payload.state) {
        parseMapState(payload.state);
      } else {
        const mapName = typeof payload === 'string' ? payload : (payload.mapName || payload.name || 'Scene');
        const rawUrl = typeof payload === 'string' ? payload : (payload.mapUrl || payload.url || '');

        if (rawUrl && typeof rawUrl === 'string') {
          const fullMapUrl = (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://') && !rawUrl.startsWith('blob:') && !rawUrl.startsWith('data:'))
            ? `${SERVER_URL}${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`
            : rawUrl;

          setActiveMap({
            name: decodeURIComponent(mapName),
            url: fullMapUrl
          });
        }
      }

      if (payload.version) {
        lastStateVersion.current = payload.version;
      }
    };

    const handleWeatherUpdated = ({ weather: newWeather, version }) => {
      setWeather(newWeather || null);
      if (version) lastStateVersion.current = version;
    };

    const handleDayNightUpdated = ({ dayNight: newDayNight, version }) => {
      if (newDayNight) setDayNight(newDayNight);
      if (version) lastStateVersion.current = version;
    };

    const handleMusicUpdated = ({ music: newMusic, version }) => {
      if (newMusic) setMusic(newMusic);
      if (version) lastStateVersion.current = version;
    };

    const handleShowHandout = (url) => setActiveHandout(url);
    const handleHideHandout = () => setActiveHandout(null);

    const handleCharacterSheetData = ({ targetUserId, data }) => {
      const player = playersRef.current.find(p => p.userId === targetUserId);
      setViewingCharacter({ userId: targetUserId, data, name: player?.name });
    };

    const handleSystemShockTrigger = (data) => {
      setSystemShockData(data);
    };

    const handleSocketIdentity = (identity) => {
      if (!identity || typeof identity.userId !== 'string') return;
      // Record the server-resolved id for ALL connection types (guests included)
      setSocketUserId(identity.userId);
      if (identity.authenticated) {
        localStorage.setItem('vtt_user_id', identity.userId);
        setCurrentUser(prev => prev
          ? { ...prev, userId: identity.userId, role: identity.role || prev.role }
          : prev);
      } else if (identity.legacyToken) {
        localStorage.setItem('vtt_legacy_session_token', identity.legacyToken);
        localStorage.setItem('vtt_user_id', identity.userId);
      }
      if (!identity.authenticated && identity.role === 'Spectator') {
        setRoleState(null);
        socket.disconnect();
        return;
      }
      if (identity.role && identity.role !== role) {
        setRoleState(identity.role);
        localStorage.setItem('vtt_role', identity.role);
        localStorage.setItem('vtt_user_role', identity.role);
      }
    };

    const handleSocketConnectError = (error) => {
      if (!error?.message || !/session|token|auth/i.test(error.message)) return;
      clearIdentityStorage();
      setCurrentUser(null);
      setSelectedCharacter(null);
      setRoleState(null);
      hasConnectedWithRole.current = null;
      socket.disconnect();
    };

    // ─── Register Socket Listeners ───
    socket.on('sync_character_data', handleSyncCharacterData);
    socket.on('init_state', handleInitState);
    socket.on('state_update', handleStateUpdate);
    socket.on('player_list_update', handlePlayerListUpdate);
    socket.on('new_chat', handleNewChat);
    socket.on('map_changed', handleMapChanged);
    socket.on('weather_updated', handleWeatherUpdated);
    socket.on('day_night_updated', handleDayNightUpdated);
    socket.on('music_updated', handleMusicUpdated);
    socket.on('show_handout', handleShowHandout);
    socket.on('hide_handout', handleHideHandout);
    socket.on('character_sheet_data', handleCharacterSheetData);
    socket.on('system_shock_trigger', handleSystemShockTrigger);
    socket.on('socket_identity', handleSocketIdentity);
    socket.on('connect_error', handleSocketConnectError);

    // Reconnect only after listeners are installed, so the authoritative
    // identity and initial state cannot race the React effect.
    if (hasConnectedWithRole.current !== identityKey) {
      if (socket.connected) socket.disconnect();
      socket.auth = auth;
      socket.connect();
      hasConnectedWithRole.current = identityKey;
      hasRequestedInitialState.current = false;
    }

    // ⭐️ Request full state and roster only once per session
    if (!hasRequestedInitialState.current) {
      if (socket.connected) {
        socket.emit('request_full_state');
        socket.emit('request_player_list');
      } else {
        socket.once('connect', () => {
          socket.emit('request_full_state');
          socket.emit('request_player_list');
        });
      }
      hasRequestedInitialState.current = true;
    }

    return () => {
      socket.off('sync_character_data', handleSyncCharacterData);
      socket.off('init_state', handleInitState);
      socket.off('state_update', handleStateUpdate);
      socket.off('player_list_update', handlePlayerListUpdate);
      socket.off('new_chat', handleNewChat);
      socket.off('map_changed', handleMapChanged);
      socket.off('weather_updated', handleWeatherUpdated);
      socket.off('day_night_updated', handleDayNightUpdated);
      socket.off('music_updated', handleMusicUpdated);
      socket.off('show_handout', handleShowHandout);
      socket.off('hide_handout', handleHideHandout);
      socket.off('character_sheet_data', handleCharacterSheetData);
      socket.off('system_shock_trigger', handleSystemShockTrigger);
      socket.off('socket_identity', handleSocketIdentity);
      socket.off('connect_error', handleSocketConnectError);
    };
  }, [role, selectedCharacter, currentUser, name]);

  // Auto‑scroll chat to bottom when new message arrives
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chat]);

  // Helper to determine if the content is a video
  const isVideo = (url) => {
    if (!url) return false;
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov'];
    return videoExtensions.some(ext => url.toLowerCase().endsWith(ext));
  };

  /* ==========================================
     WORKSPACE & CANVAS TOOLBAR INTERFACES
     ========================================== */
  const handleToolChange = (newTool) => {
    setTool(newTool);
    if (newTool === 'stamps') {
      setShowStampPicker(true);
    } else {
      // When switching away from stamps, close the picker and cancel any pending placement
      setShowStampPicker(false);
      setPlacingStamp(null);
    }

    // Clear Shape Tool if we switch tools via toolbar
    if (newTool !== 'shape') {
      setShapeActive(false);
      setShowShapePanel(false);
    }
    
    // Clear FX Tool if we switch tools via toolbar
    if (newTool !== 'fx') {
      setFxActive(false);
      setShowFXPanel(false);
    }
  };

  // Called when a stamp is selected from the library
  const handleStampSelect = (stampData) => {
    setPlacingStamp(stampData);
    setShowStampPicker(false);
  };

  // FX: Toggle FX tool and panel
  const toggleFX = () => {
    soundSynthesizer.playUIClick();
    const newActive = !fxActive;
    setFxActive(newActive);
    setShowFXPanel(newActive);
    if (newActive) {
      setTool('fx');       
      if (shapeActive) {
        setShapeActive(false);
        setShowShapePanel(false);
      }
    } else {
      setTool('pan');      
    }
  };

  // Shape Tool: Toggle shape tool and panel
  const toggleShape = () => {
    soundSynthesizer.playUIClick();
    const newActive = !shapeActive;
    setShapeActive(newActive);
    setShowShapePanel(newActive);
    if (newActive) {
      setTool('shape');  // Switch to shape tool
      if (fxActive) {
        setFxActive(false);
        setShowFXPanel(false);
      }
    } else {
      setTool('pan');    // Revert to pan
    }
  };

  // ─── Full Logout & Role/Character Switch Handler ───
  const handleLogout = () => {
    const sessionToken = localStorage.getItem('vtt_session_token');
    const finishLogout = () => {
      clearIdentityStorage();
      setCurrentUser(null);
      setSelectedCharacter(null);
      setRoleState(null);
      hasConnectedWithRole.current = null;
      hasRequestedInitialState.current = false;
      socket.disconnect();
    };

    if (socket.connected) {
      socket.emit('player_logout', (response) => {
        if (sessionToken && response?.success) {
          fetch(`${SERVER_URL}/api/auth/logout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: sessionToken })
          }).catch(() => {});
        }
        finishLogout();
      });
    } else {
      if (sessionToken) {
        fetch(`${SERVER_URL}/api/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: sessionToken })
        }).catch(() => {});
      }
      finishLogout();
    }
  };

  // ─── Switch Character (players, in-session) ───
  // Drops the active character and returns to the Stage 2 selection gate
  // WITHOUT wiping the session: account players keep their login (they land
  // on the authenticated vault), Quick Play visitors land on the device vault.
  const handleChangeCharacter = () => {
    soundSynthesizer.playUIClick();
    // Gracefully leave the table presence-wise; the gate will reconnect once
    // a character is chosen (identityKey changes → fresh socket auth).
    try { if (socket.connected) socket.emit('player_logout'); } catch (e) { /* noop */ }
    localStorage.removeItem('vtt_active_character_id');
    localStorage.removeItem('tome_data');
    setSelectedCharacter(null);
    hasConnectedWithRole.current = null;
    hasRequestedInitialState.current = false;
    if (socket.connected) socket.disconnect();
  };

  /* ==========================================
     STAGE 1 GATE: USER LOGIN SCREEN
     ========================================== */
  if (!authChecked) {
    return (
      <div className="h-screen w-screen bg-bgDark flex items-center justify-center text-accentGold text-sm animate-pulse">
        Initializing Tabletop Environment...
      </div>
    );
  }

  if (!role && !currentUser) {
    return (
      <LoginScreen
        name={name}
        setName={(val) => { 
          setName(val); 
          localStorage.setItem('vtt_name', val); 
          localStorage.setItem('vtt_user_name', val);
        }}
        onJoinAsPlayer={(code) => { 
          localStorage.setItem('vtt_room_code', code || ''); 
          localStorage.setItem('vtt_role', 'Player'); 
          localStorage.setItem('vtt_user_role', 'Player');
          setRoleState('Player');
        }}
        onAuthSuccess={(user, code) => {
          setCurrentUser(user);
          setName(user.username || '');
          localStorage.setItem('vtt_user_name', user.username || '');
          localStorage.setItem('vtt_name', user.username || '');
          if (user.role === 'DM') {
            localStorage.setItem('vtt_role', 'DM');
            localStorage.setItem('vtt_user_role', 'DM');
            setRoleState('DM');
          } else {
            localStorage.removeItem('vtt_role');
            localStorage.removeItem('vtt_user_role');
            setRoleState(null);
          }
          if (code) localStorage.setItem('vtt_room_code', code);
        }}
        activePlayers={players}
      />
    );
  }

  /* ==========================================
     STAGE 2 GATE: CHARACTER SELECTION SCREEN (Players only)
     ========================================== */
  // Account role is authoritative. Do not let a stale localStorage role route
  // an authenticated DM into the player character vault.
  // Players ALWAYS pass through this gate before entering the table — both
  // account players (server vault) and Quick Play visitors (device vault via
  // x-vtt-user-id). This guarantees everyone gets to pick their character,
  // and can come back here any time via the 🔄 Switch Character button.
  const effectiveRole = currentUser?.role || role;
  if (effectiveRole !== 'DM' && !selectedCharacter && (currentUser || role === 'Player')) {
    return (
      <CharacterSelectScreen
        user={currentUser || { userId: getOrGenerateUserId(), username: name || 'Adventurer' }}
        quickMode={!currentUser}
        defaultName={currentUser ? '' : (name || '')}
        onSelectCharacter={(char) => {
          localStorage.setItem('vtt_active_character_id', char.id);
          localStorage.setItem('tome_data', JSON.stringify(char.data));
          localStorage.setItem('vtt_role', 'Player');
          localStorage.setItem('vtt_name', char.name);
          setSelectedCharacter(char);
          setName(char.name);
          setRoleState('Player');
        }}
        onCreateNew={(newName) => {
          const newId = `char_${Date.now()}`;
          const freshBase = newName || `${currentUser?.username || name || 'Adventurer'}'s Adventurer`;
          const newSheet = { id: newId, name: freshBase, lvl: 1, hpMax: 10, hpCur: 10, ac: 10, speed: 30 };
          localStorage.setItem('vtt_active_character_id', newId);
          localStorage.setItem('tome_data', JSON.stringify(newSheet));
          localStorage.setItem('vtt_role', 'Player');
          localStorage.setItem('vtt_name', newSheet.name);
          setSelectedCharacter({ id: newId, name: newSheet.name, data: newSheet });
          setName(newSheet.name);
          setRoleState('Player');
          // Persist the new character to the vault immediately (account token
          // or device fallback) — the sheet's debounced sync only fires later.
          vaultFetch('/api/characters/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ characterId: newId, sheetData: newSheet })
          }).catch(() => {});
        }}
        onLogout={handleLogout}
      />
    );
  }

  // Current user's persistent UUID for ownership validation
  const userId = currentUser?.userId || getOrGenerateUserId();

  /* ==========================================
     WORKSPACE TEMPLATE LAYOUT ASSEMBLY
     ========================================== */
  return (
    <div className="h-screen flex bg-bgDark text-textLight overflow-hidden">
      {/* Background Audio Thread */}
      <AudioPlayer />
      <PlayerPrompt />
      <CheckPrompt />
      <ConnectionStatus isSynced={isSynced} />
      
      {/* SIDEBAR (RESIZABLE) */}
      <div 
        className="border-r border-borderDark p-3 flex flex-col bg-bgPanel overflow-hidden shrink-0"
        style={{ width: leftPanelWidth }}
      >
        <div className="flex items-end justify-between mb-2">
          <div>
            <p className="text-[9px] text-accentGold uppercase tracking-[0.28em] font-bold">Active Party</p>
          </div>
          <div className="flex items-center gap-2">
            {role === 'Player' && (
              <button
                type="button"
                onClick={handleChangeCharacter}
                className="text-[8px] text-accentGold font-bold border border-accentGold/50 px-1.5 py-0.5 rounded-full hover:bg-accentGold hover:text-black transition-colors"
                title="Switch to a different character"
              >
                🔄 Switch
              </button>
            )}
            {role === 'Player' && (
              <button
                type="button"
                onClick={() => window.open('/character-sheet', '_blank', 'noopener,noreferrer')}
                className="text-[8px] text-accentGold font-bold border border-accentGold/50 px-1.5 py-0.5 rounded-full hover:bg-accentGold hover:text-black"
              >
                Full Sheet
              </button>
            )}
            <span className="text-[8px] text-textMuted font-bold border border-borderDark px-1.5 py-0.5 rounded-full">
              {players.filter(p => p.role === 'Player' && p.status !== 'offline').length} online
            </span>
          </div>
        </div>
        
        {/* Party List */}
        <div className="max-h-56 overflow-y-auto mb-3 scrollbar-hide flex flex-col gap-1">
          {players.filter(p => p.role === 'Player').map(p => (
            <PartyPlayerCard
              key={p.userId}
              player={p}
              isOwn={p.userId === userId}
              showStats={Boolean(p.characterData) && (role === 'DM' || p.userId === userId)}
              onViewSheet={role === 'DM' ? () => socket.emit('request_character_sheet', p.userId) : undefined}
            />
          ))}
        </div>
        
        {/* MODULES (Dice, Tokens, Handouts, Audio) */}
        <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2 scrollbar-hide">
          <DiceTray />
          
          {role === 'DM' && (
            <div className="flex flex-col gap-2">
              <TokenTray placingTokenId={placingTokenId} setPlacingTokenId={setPlacingTokenId} />
              <DMHandouts />
              <DMAudioDeck />
            </div>
          )}
        </div>
        
        {/* CHAT SYSTEM */}
        <div className="mt-4 pt-4 border-t border-borderDark flex flex-col gap-2">
          <div 
            ref={chatContainerRef} 
            style={{ height: chatHeight }}
            className="overflow-y-auto bg-bgCard p-2 text-[11px] rounded border border-borderDark shadow-inner flex flex-col gap-1 scrollbar-hide"
          >
            {chat.map((c, i) => {
              // Styling based on message type
              let msgStyle = "text-textLight";
              let prefix = <b className="text-accentGold">{c.sender}:</b>;
              
              // ★ MODIFICATION: Hide monster HP numbers from players
              let displayMessage = c.message;

              // HP Update Styling
              if (c.metadata?.type === 'hp_update') {
                  const isHeal = c.metadata.isHeal;
                  msgStyle = isHeal ? "text-green-400" : "text-red-400";
                  if (role !== 'DM' && c.metadata.tokenType === 'npc') {
                      const action = isHeal ? 'healed' : 'damaged';
                      displayMessage = `${c.sender} ${action} ${c.metadata.tokenName} for ${c.metadata.change} HP`;
                  }
              }

              // Critical Roll Detection
              if (c.message.includes('CRITICAL FAIL')) {
                  msgStyle = "text-red-300 font-bold bg-red-950/30 px-1 py-0.5 rounded";
                  prefix = <b className="text-red-400 animate-pulse">⚠️ {c.sender}:</b>;
              } else if (c.message.includes('CRITICAL HIT')) {
                  msgStyle = "text-yellow-300 font-bold bg-yellow-950/30 px-1 py-0.5 rounded";
                  prefix = <b className="text-yellow-400 animate-pulse">✨ {c.sender}:</b>;
              }

              // Whisper and party styles (unchanged)
              if (c.type === 'whisper') {
                msgStyle = "text-pink-400 italic";
                prefix = <b>[Whisper from {c.sender}]:</b>;
              } else if (c.type === 'party') {
                msgStyle = "text-blue-400 italic";
                prefix = <b>[Party - {c.sender}]:</b>;
              }

              return (
                <div key={i} className={`break-words ${msgStyle}`}>
                  {prefix} {displayMessage}
                </div>
              );
            })}
          </div>

          {/* Vertical Resize Handle */}
          <div 
            className="h-1 cursor-ns-resize bg-borderDark hover:bg-accentGold transition-colors rounded"
            onMouseDown={startDragChat}
          />

          <input 
            className="p-2 bg-bgCard text-[11px] text-white rounded border border-borderDark focus:outline-none focus:border-accentGold" 
            placeholder="Type... (/w name or /p)" 
            value={msg} 
            onChange={e => setMsg(e.target.value)}
            onKeyDown={e => { 
                if(e.key === 'Enter' && msg.trim()) { 
                    const text = msg.trim();
                    // Whisper Command Parsing
                    if (text.startsWith('/w ') || text.startsWith('/whisper ')) {
                        const parts = text.split(' ');
                        const target = parts[1]; // The name of the player
                        const actualMsg = parts.slice(2).join(' '); // The rest of the message
                        if(target && actualMsg) socket.emit('whisper', { target, message: actualMsg });
                    } 
                    // Party Command Parsing
                    else if (text.startsWith('/p ') || text.startsWith('/party ')) {
                        const actualMsg = text.replace(/^\/p(arty)?\s+/, '');
                        if(actualMsg) socket.emit('party_chat', actualMsg);
                    } 
                    // Normal Chat
                    else {
                        socket.emit('chat_message', text); 
                    }
                    setMsg(''); 
                } 
            }}
          />

          <div className="flex items-center justify-between pt-1">
            <button
              className="text-[9px] text-gray-500 hover:text-accentGold underline transition-colors"
              onClick={handleChangeCharacter}
              title="Return to the character picker without logging out"
            >
              Switch Character
            </button>
            {currentUser && (
              <span className="text-[9px] text-textMuted font-mono">
                👤 {currentUser.username}
              </span>
            )}
          </div>
        </div>
      </div>
      
      {/* Sidebar Resize Handle */}
      <div 
        className="w-1 cursor-ew-resize bg-borderDark hover:bg-accentGold transition-colors shrink-0"
        onMouseDown={startDragLeftPanel}
      />
      
      {/* MAIN TABLETOP AREA */}
      <div className="flex-1 flex flex-col bg-black">
        {/* Initiative Bar */}
        <InitiativeBar role={role} currentUserId={socketUserId || currentUser?.userId || null} />

        {/* Canvas Map fills remaining workspace */}
        <div className="flex-1 relative min-h-0">
          <CanvasMap 
            activeMap={activeMap} 
            role={role} 
            placingTokenId={placingTokenId} 
            setPlacingTokenId={setPlacingTokenId} 
            tool={tool}
            setTool={handleToolChange}
            wallType={wallType}
            showGrid={showGrid}
            setShowGrid={setShowGrid}
            lightRadius={lightRadius}
            setLightRadius={setLightRadius}
            lightColor={lightColor}
            setLightColor={setLightColor}
            placingStamp={placingStamp}
            setPlacingStamp={setPlacingStamp}
            measureActive={measureActive}
            setMeasureActive={setMeasureActive}
            pingActive={pingActive}
            setPingActive={setPingActive}
            stampSize={stampSize}
            setStampSize={setStampSize}
            // FX: Pass FX state
            fxActive={fxActive}
            fxShape={fxShape}
            fxStyle={fxStyle}
            shapeActive={shapeActive}
            shapeType={shapeType}
            shapeColor={shapeColor}
            shapeMode={shapeMode}
            onDeathSaveTrigger={handleDeathSaveTrigger}
            // ★ Pass userId to CanvasMap for ownership checks
            userId={userId}
          />
          <Sidebar 
            role={role} 
            name={name} 
            measureActive={measureActive}
            setMeasureActive={setMeasureActive}
            pingActive={pingActive}
            setPingActive={setPingActive}
            onOpenGear={() => setShowGearModal(true)}
            onOpenStats={() => setShowStatsModal(true)} 
            onToggleFX={toggleFX}
            shapeActive={shapeActive}
            onToggleShape={toggleShape}
          />
        </div>

        {/* Bottom Toolbar (DM controls moved here) */}
        {role === 'DM' && (
          <BottomToolbar
            tool={tool}
            setTool={handleToolChange}
            wallType={wallType}
            setWallType={setWallType}
            showGrid={showGrid}
            setShowGrid={setShowGrid}
            lightRadius={lightRadius}
            setLightRadius={setLightRadius}
            lightColor={lightColor}
            setLightColor={setLightColor}
            onToggleCombat={() => setShowCombatPanel(!showCombatPanel)}
            onToggleCheckRequest={() => setShowCheckPanel(true)}
            onOpenCheckPanel={() => setShowCheckPanel(true)}
            stampSize={stampSize}
            setStampSize={setStampSize}
          />
        )}
      </div>

      {/* ==========================================
         UTILITIES: FULL SCREEN MEDIA HANDOUT MODAL
         ========================================== */}
      {activeHandout && (
        <div className="fixed inset-0 z-[1000] bg-black bg-opacity-90 flex items-center justify-center p-12 animate-in fade-in zoom-in duration-300">
          <div className="relative max-w-5xl w-full flex flex-col items-center">
            <div className="w-full flex justify-center items-center rounded-lg border-2 border-accentGold overflow-hidden bg-bgDark shadow-[0_0_60px_rgba(0,0,0,0.9)]">
              {isVideo(activeHandout) ? (
                <video src={activeHandout} className="max-w-full max-h-[75vh]" controls autoPlay loop />
              ) : (
                <img src={activeHandout} className="max-w-full max-h-[75vh] object-contain" alt="Handout" />
              )}
            </div>
            <button 
              onClick={() => setActiveHandout(null)}
              className="mt-6 bg-accentGold text-black font-bold px-6 py-2 rounded-full shadow-xl hover:bg-yellow-500 transition-all uppercase text-xs tracking-widest"
            >
              Close Handout
            </button>
          </div>
        </div>
      )}

      {/* ==========================================
         SYSTEM MODALS & FLYOUT CONFIGURATION PANELS
         ========================================== */}
      {role === 'DM' && showCombatPanel && (
        <CombatPanel onClose={() => setShowCombatPanel(false)} />
      )}

      {/* Check Request Panel */}
      {role === 'DM' && showCheckPanel && (
        <CheckRequestPanel onClose={() => setShowCheckPanel(false)} players={players} />
      )}

      {/* Stamp Picker */}
      {role === 'DM' && showStampPicker && (
        <StampPicker
          onSelect={handleStampSelect}
          onClose={() => {
            setShowStampPicker(false);
            if (tool === 'stamps') setTool('pan');
          }}
        />
      )}

      {/* DM View Character Sheet Modal */}
      {viewingCharacter && (
        <div className="fixed inset-0 z-[1500] flex items-center justify-center bg-black/70">
          <div className="bg-bgPanel border border-accentGold rounded-xl w-[900px] h-[85vh] shadow-2xl flex flex-col overflow-hidden">
            <DMCharacterViewer
              initialData={viewingCharacter.data}
              targetUserId={viewingCharacter.userId}
              onClose={() => setViewingCharacter(null)}
            />
          </div>
        </div>
      )}

      {/* Gear Modal */}
      {showGearModal && (
        <GearModal 
          role={role}
          onClose={() => setShowGearModal(false)}
        />
      )}

      {/* Unified Character Sheet Modal */}
      {showStatsModal && (
          <div className="fixed inset-0 z-[1100] bg-black/80 flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-bgPanel border border-accentGold rounded-xl w-full max-w-[1260px] h-[92vh] shadow-2xl flex flex-col overflow-hidden">
                  
                  {/* Modal Header */}
                  <header className="bg-bgCard p-4 border-b border-borderDark flex justify-between items-center shrink-0">
                      <div className="flex items-center gap-4 w-full">
                          {/* Character Sheet Title */}
                          <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xl">👤</span>
                              <h2 className="text-accentGold font-extrabold text-lg uppercase tracking-wider">
                                  Character Sheet
                              </h2>
                          </div>
                          
                          {/* Header Integrated Template Dropdown Selector */}
                          <TemplateLibraryDropdown />
                      </div>
                      
                      {/* Close Button */}
                      <button 
                          onClick={() => {
                              soundSynthesizer.playUIClick();
                              setShowStatsModal(false);
                          }} 
                          className="text-textMuted hover:text-white text-2xl px-2 shrink-0 transition-colors"
                      >
                          ✕
                      </button>
                  </header>
                  
                  {/* Character Sheet Scroll View Area */}
                  <div className="flex-1 overflow-y-auto p-5 min-h-0 bg-[#0d0e12]">
                      <CharacterSheet tab="stats" role={role} />
                  </div>
              </div>
          </div>
      )}

      {/* FX Panel */}
      {showFXPanel && (
        <FXPanel
          onClose={() => {
            setShowFXPanel(false);
            setFxActive(false);
          }}
          selectedShape={fxShape}
          selectedStyle={fxStyle}
          onSelectShape={setFxShape}
          onSelectStyle={setFxStyle}
        />
      )}

      {/* Shape Tool Panel */}
      {showShapePanel && (
        <ShapePanel
          onClose={() => {
            setShowShapePanel(false);
            setShapeActive(false);
            setTool('pan');
          }}
          selectedShape={shapeType}
          selectedColor={shapeColor}
          onSelectShape={setShapeType}
          onSelectColor={setShapeColor}
          shapeMode={shapeMode}
          onSelectMode={setShapeMode}
        />
      )}

      {/* System Shock Modal */}
      {systemShockData && (
        <SystemShockModal
          key={systemShockData.tokenId}
          {...systemShockData}
          onClose={() => setSystemShockData(null)}
        />
      )}

      {/* Death Save Modal */}
      {deathSaveData && (
        <DeathSaveModal
          key={deathSaveData.tokenId}
          tokenId={deathSaveData.tokenId}
          tokenName={deathSaveData.tokenName}
          onClose={() => setDeathSaveData(null)}
        />
      )}
    </div>
  );
}

/* ==========================================
   SUB-COMPONENT: TemplateLibraryDropdown
   ========================================== */
function TemplateLibraryDropdown() {
  const [premades, setPremades] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef(null);

  // Close on outside click + Escape — previously the dropdown could only be
  // closed by selecting a template or re-toggling the button.
  useEffect(() => {
    if (!isOpen) return;
    const handleMouseDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Fetch all templates from API on load
  useEffect(() => {
    fetch(`${SERVER_URL}/api/premades`)
      .then(res => res.json())
      .then(data => setPremades(data || []))
      .catch(err => console.error("[Template Library] Error scanning templates:", err));
  }, []);

  const handleSelect = (filename) => {
    fetch(`${SERVER_URL}/api/premades/${filename}`)
      .then(res => res.json())
      .then(charData => {
        const cleanName = filename.replace('.json', '').replace(/[-_]/g, ' ');
        if (window.confirm(`Load template "${charData.name || cleanName}"? This will overwrite your current character data!`)) {
          // Emit CustomEvent to sync data into CharacterSheet.jsx without local state leak
          window.dispatchEvent(new CustomEvent('load-premade', { detail: charData }));
          setIsOpen(false);
        }
      })
      .catch(err => console.error("[Template Loader] Error details:", err));
  };

  return (
    <div className="relative" ref={rootRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-bgPanel border border-borderDark rounded-lg hover:border-accentGold text-accentGold text-xs font-bold uppercase tracking-wider transition-all shadow-sm"
      >
        Template Library <span className="text-[9px] text-textMuted">{isOpen ? '▲' : '▼'}</span>
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-1.5 w-64 bg-bgPanel border border-accentGold/40 rounded-lg shadow-2xl z-50 max-h-60 overflow-y-auto py-1.5 scrollbar-hide">
          <div className="px-3 py-1 text-[8.5px] text-accentGold uppercase font-extrabold tracking-widest border-b border-borderDark/35 mb-1">
            Template Catalog
          </div>
          {premades.length === 0 ? (
            <div className="px-3 py-2 text-[11px] text-textMuted italic">No templates found</div>
          ) : (
            premades.map(filename => {
              const cleanName = filename.replace('.json', '').replace(/[-_]/g, ' ');
              return (
                <button
                  key={filename}
                  onClick={() => handleSelect(filename)}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-bgCard hover:text-accentGold transition-colors truncate font-semibold text-textLight flex items-center gap-2"
                >
                  🛡️ <span className="capitalize">{cleanName}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export default App;