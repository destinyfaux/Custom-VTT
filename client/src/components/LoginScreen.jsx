// client/src/components/LoginScreen.jsx
import { useState, useEffect, useRef } from 'react';
import { SERVER_URL } from '../config';
import soundSynthesizer from '../utils/SoundSynthesizer';

const VERSION = '6.1';
const BUILD_DATE = '2026-06-11';

export default function LoginScreen({
  name,
  setName,
  onJoinAsPlayer,
  onAuthSuccess, // Called when account login/register succeeds
  activePlayers, // Real-time player presence list from server
}) {
  const [backgroundUrl, setBackgroundUrl] = useState(null);
  const [showChangelog, setShowChangelog] = useState(false);
  const [changelogContent, setChangelogContent] = useState('');
  const [loadingChangelog, setLoadingChangelog] = useState(false);
  const [roomCode, setRoomCode] = useState(localStorage.getItem('vtt_room_code') || '');

  // Auth Mode State: 'quick' | 'login' | 'register'
  const [authMode, setAuthMode] = useState('quick');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [dmSetupSecret, setDmSetupSecret] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [dmRegistrationEnabled, setDmRegistrationEnabled] = useState(false);

  // Strict Login Theme Music State (from /assets/login/)
  const [themeUrl, setThemeUrl] = useState(null);
  const [isPlayingMusic, setIsPlayingMusic] = useState(
    () => localStorage.getItem('vtt_theme_enabled') === 'true'
  );
  const [musicVolume, setMusicVolume] = useState(
    () => parseFloat(localStorage.getItem('vtt_theme_volume') || '0.35')
  );
  const [showMusicControls, setShowMusicControls] = useState(false);
  const audioRef = useRef(null);

  // Global user gesture listener to unlock Web Audio context on first click/touch
  useEffect(() => {
    const handleFirstGesture = () => {
      soundSynthesizer.unlock();
      if (audioRef.current && localStorage.getItem('vtt_theme_enabled') === 'true') {
        audioRef.current.play().then(() => setIsPlayingMusic(true)).catch(() => {});
      }
    };
    window.addEventListener('click', handleFirstGesture, { once: true });
    window.addEventListener('keydown', handleFirstGesture, { once: true });
    return () => {
      window.removeEventListener('click', handleFirstGesture);
      window.removeEventListener('keydown', handleFirstGesture);
    };
  }, []);

  // Fetch Background, Auth Config, and Strict Login Theme
  useEffect(() => {
    const baseUrl = (SERVER_URL || '').replace(/\/+$/, '');

    fetch(`${baseUrl}/api/login-background`)
      .then((res) => res.json())
      .then((data) => setBackgroundUrl(data.url))
      .catch(() => setBackgroundUrl(null));

    fetch(`${baseUrl}/api/auth/config`)
      .then((res) => res.json())
      .then((data) => setDmRegistrationEnabled(Boolean(data.dmRegistrationEnabled)))
      .catch(() => setDmRegistrationEnabled(false));

    // Fetch strict login theme from server/assets/login/
    fetch(`${baseUrl}/api/login-theme`)
      .then((res) => res.json())
      .then((data) => {
        if (data.url) {
          setThemeUrl(`${baseUrl}${data.url}`);
        } else {
          setThemeUrl(null);
        }
      })
      .catch(() => setThemeUrl(null));
  }, []);

  // Theme Audio Playback Synchronization
  useEffect(() => {
    if (!audioRef.current || !themeUrl) return;
    audioRef.current.volume = musicVolume;
    if (isPlayingMusic) {
      audioRef.current.play().catch(() => {
        // Autoplay policy waiting for user interaction
      });
    } else {
      audioRef.current.pause();
    }
  }, [isPlayingMusic, musicVolume, themeUrl]);

  const toggleMusic = () => {
    soundSynthesizer.unlock();
    soundSynthesizer.playUIClick();
    const nextState = !isPlayingMusic;
    setIsPlayingMusic(nextState);
    localStorage.setItem('vtt_theme_enabled', String(nextState));
  };

  const handleVolumeChange = (e) => {
    const vol = parseFloat(e.target.value);
    setMusicVolume(vol);
    localStorage.setItem('vtt_theme_volume', String(vol));
    if (audioRef.current) {
      audioRef.current.volume = vol;
    }
  };

  const loadChangelog = async () => {
    setLoadingChangelog(true);
    try {
      const baseUrl = (SERVER_URL || '').replace(/\/+$/, '');
      const res = await fetch(`${baseUrl}/api/changelog`);
      const text = await res.text();
      setChangelogContent(text);
    } catch (err) {
      console.error('Failed to load changelog:', err);
      setChangelogContent('Unable to load changelog. Please check the server connection.');
    } finally {
      setLoadingChangelog(false);
    }
  };

  const handleShowChangelog = () => {
    soundSynthesizer.unlock();
    soundSynthesizer.playUIClick();
    if (!changelogContent) loadChangelog();
    setShowChangelog(true);
  };

  const handleModeChange = (mode) => {
    soundSynthesizer.unlock();
    soundSynthesizer.playUIClick();
    setAuthMode(mode);
    setAuthError('');
  };

  // Account Login / Register Handler
  const handleAccountAuth = async (e) => {
    e.preventDefault();
    soundSynthesizer.unlock();
    soundSynthesizer.playUIClick();
    setAuthError('');
    setAuthLoading(true);

    const endpoint = authMode === 'register' ? '/api/auth/register' : '/api/auth/login';
    const baseUrl = (SERVER_URL || '').replace(/\/+$/, '');

    try {
      const res = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          ...(authMode === 'register' && dmSetupSecret ? { setupSecret: dmSetupSecret } : {})
        }),
      });
      const data = await res.json();
      setAuthLoading(false);

      if (!res.ok || !data.success) {
        soundSynthesizer.playCriticalFail();
        setAuthError(data.error || 'Authentication failed. Please check credentials.');
        return;
      }
      if (!data.token || !data.user?.userId || !data.user?.role) {
        soundSynthesizer.playCriticalFail();
        setAuthError('Server returned an incomplete account session. Please restart the server and try again.');
        return;
      }

      // Fanfare on successful authentication
      soundSynthesizer.playLevelUp();

      // Store persistent session
      localStorage.setItem('vtt_session_token', data.token);
      localStorage.setItem('vtt_user_id', data.user.userId);
      localStorage.setItem('vtt_username', data.user.username);
      localStorage.removeItem('vtt_legacy_session_token');
      localStorage.setItem('vtt_role', data.user.role);
      localStorage.setItem('vtt_user_role', data.user.role);
      if (roomCode) localStorage.setItem('vtt_room_code', roomCode);

      if (onAuthSuccess) {
        onAuthSuccess(data.user, roomCode);
        window.location.reload();
      } else {
        onJoinAsPlayer(roomCode);
      }
    } catch (err) {
      setAuthLoading(false);
      soundSynthesizer.playCriticalFail();
      setAuthError('Cannot reach server. Please check the network connection.');
    }
  };

  const handleQuickJoinPlayer = () => {
    soundSynthesizer.unlock();
    soundSynthesizer.playLevelUp();
    onJoinAsPlayer(roomCode);
  };

  const isVideo = backgroundUrl && /\.(mp4|webm|mov)$/i.test(backgroundUrl);
  const baseUrl = (SERVER_URL || '').replace(/\/+$/, '');

  return (
    <div className="h-screen w-screen relative bg-bgDark overflow-hidden select-none">
      {/* Theme Audio Element (renders only if a valid theme file was found in /assets/login/) */}
      {themeUrl && (
        <audio
          ref={audioRef}
          src={themeUrl}
          loop
          preload="auto"
        />
      )}

      {/* Floating Theme Music Controller Widget */}
      {themeUrl && (
        <div className="absolute top-4 right-4 z-40 flex items-center gap-2 bg-[#12141a]/85 backdrop-blur-md border border-accentGold/40 rounded-full px-3 py-1.5 shadow-xl transition-all hover:border-accentGold">
          <button
            type="button"
            onClick={toggleMusic}
            title={isPlayingMusic ? 'Mute Theme Music' : 'Play Theme Music'}
            className="text-sm text-accentGold hover:scale-110 transition-transform focus:outline-none flex items-center gap-1.5"
          >
            <span>{isPlayingMusic ? '🔊' : '🔇'}</span>
            <span className="text-[10px] font-bold tracking-wider uppercase hidden sm:inline text-textLight">
              {isPlayingMusic ? 'Music On' : 'Music Off'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowMusicControls(!showMusicControls)}
            className="text-textMuted hover:text-white text-xs px-1"
            title="Volume Settings"
          >
            ⚙️
          </button>

          {showMusicControls && (
            <div className="flex items-center gap-2 pl-2 border-l border-borderDark/60 animate-in fade-in">
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={musicVolume}
                onChange={handleVolumeChange}
                className="w-16 accent-accentGold cursor-pointer h-1.5 rounded-lg bg-bgPanel"
                title={`Volume: ${Math.round(musicVolume * 100)}%`}
              />
              <span className="text-[9px] font-mono text-textMuted w-6 text-right">
                {Math.round(musicVolume * 100)}%
              </span>
            </div>
          )}
        </div>
      )}

      {/* Background Media */}
      {backgroundUrl ? (
        isVideo ? (
          <video
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          >
            <source src={`${baseUrl}${backgroundUrl}`} type="video/mp4" />
          </video>
        ) : (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${baseUrl}${backgroundUrl})` }}
          />
        )
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#0b0c10] via-[#1f2833] to-[#0b0c10]" />
      )}

      {/* Darkened Atmosphere Overlay */}
      <div className="absolute inset-0 bg-black/65 backdrop-blur-[2px]" />

      {/* Centered Main Portal */}
      <div className="absolute inset-0 flex items-center justify-center p-4 overflow-y-auto">
        <div className="relative bg-[#12141a]/95 backdrop-blur-xl border border-accentGold/35 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] w-full max-w-lg p-8 flex flex-col items-center space-y-5 animate-in zoom-in duration-300">
          
          {/* Header Title & Version */}
          <div className="flex flex-col items-center space-y-1 text-center">
            <h1 className="text-accentGold text-3xl font-extrabold tracking-widest drop-shadow-[0_2px_10px_rgba(230,180,34,0.3)]">
              CUSTOM VTT
            </h1>
            <div className="text-[10px] uppercase font-bold tracking-widest text-textMuted flex items-center gap-2">
              <span>v{VERSION}</span>
              <span className="text-accentGold/60">•</span>
              <span>{BUILD_DATE}</span>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex w-full bg-black/40 border border-borderDark/80 rounded-xl p-1 shadow-inner">
            <button
              type="button"
              onClick={() => handleModeChange('quick')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                authMode === 'quick'
                  ? 'bg-accentGold text-black shadow-md'
                  : 'text-textMuted hover:text-white'
              }`}
            >
              🎲 Quick Play
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('login')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                authMode === 'login'
                  ? 'bg-accentGold text-black shadow-md'
                  : 'text-textMuted hover:text-white'
              }`}
            >
              🔑 Account Login
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('register')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                authMode === 'register'
                  ? 'bg-accentGold text-black shadow-md'
                  : 'text-textMuted hover:text-white'
              }`}
            >
              📜 Register
            </button>
          </div>

          {/* Error Banner */}
          {authError && (
            <div className="w-full text-center text-xs text-red-400 bg-red-950/40 border border-red-800/60 p-2.5 rounded-xl animate-in fade-in">
              {authError}
            </div>
          )}

          {/* MODE A: Quick Play (Original Single-Click Flow) */}
          {authMode === 'quick' && (
            <div className="w-full space-y-4">
              <div className="space-y-3">
                <input
                  className="login-input w-full p-3 bg-bgCard/80 border border-borderDark rounded-xl text-white outline-none focus:border-accentGold transition-all text-xs placeholder-textMuted shadow-inner"
                  placeholder="Enter your character name, adventurer..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <input
                  className="login-input w-full p-3 bg-bgCard/80 border border-borderDark rounded-xl text-white outline-none focus:border-accentGold transition-all text-xs placeholder-textMuted shadow-inner"
                  placeholder="Room Code (leave blank if none)"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value)}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex w-full gap-3 pt-1">
                <button
                  type="button"
                  className="flex-1 bg-accentGold text-black font-extrabold py-3 rounded-xl hover:bg-yellow-500 transition-all uppercase tracking-wider text-xs shadow-lg hover:shadow-[0_0_15px_rgba(230,180,34,0.4)]"
                  onClick={handleQuickJoinPlayer}
                >
                  Join as Player
                </button>
                <button
                  type="button"
                  className="flex-1 bg-borderDark/80 border border-white/10 text-white font-extrabold py-3 rounded-xl hover:bg-gray-700 hover:border-accentGold/50 transition-all uppercase tracking-wider text-xs shadow-lg"
                  onClick={() => handleModeChange('login')}
                >
                  Join as DM
                </button>
              </div>
            </div>
          )}

          {/* MODE B & C: Account Vault Login / Registration */}
          {(authMode === 'login' || authMode === 'register') && (
            <form onSubmit={handleAccountAuth} className="w-full space-y-3">
              <input
                className="login-input w-full p-3 bg-bgCard/80 border border-borderDark rounded-xl text-white outline-none focus:border-accentGold transition-all text-xs placeholder-textMuted shadow-inner"
                placeholder="Account Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
              <input
                type="password"
                className="login-input w-full p-3 bg-bgCard/80 border border-borderDark rounded-xl text-white outline-none focus:border-accentGold transition-all text-xs placeholder-textMuted shadow-inner"
                placeholder="Account Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <input
                className="login-input w-full p-3 bg-bgCard/80 border border-borderDark rounded-xl text-white outline-none focus:border-accentGold transition-all text-xs placeholder-textMuted shadow-inner"
                placeholder="Room Code (optional)"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
              />
              {authMode === 'register' && (
                <>
                  <input
                    type="password"
                    className="login-input w-full p-3 bg-bgCard/80 border border-borderDark rounded-xl text-white outline-none focus:border-accentGold transition-all text-xs placeholder-textMuted shadow-inner"
                    placeholder="DM setup key (host only, optional)"
                    value={dmSetupSecret}
                    onChange={(e) => setDmSetupSecret(e.target.value)}
                    autoComplete="off"
                  />
                  <p className="text-[10px] text-textMuted text-center">
                    {dmRegistrationEnabled
                      ? 'Enter the private host DM setup key to create a DM account.'
                      : 'DM registration is disabled. The host must configure a setup key or designate this username in server/.host.env.'}
                  </p>
                </>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full bg-accentGold text-black font-extrabold py-3 rounded-xl hover:bg-yellow-500 transition-all uppercase tracking-wider text-xs shadow-lg"
              >
                {authLoading
                  ? 'Signing In...'
                  : authMode === 'register'
                  ? dmRegistrationEnabled && dmSetupSecret
                    ? 'Create DM Account'
                    : 'Create Player Account'
                  : 'Sign In & Enter Table'}
              </button>

              <div className="w-full text-center pt-1">
                <button
                  type="button"
                  onClick={() => handleModeChange('login')}
                  className="text-[11px] text-accentGold/80 hover:text-accentGold hover:underline font-semibold"
                >
                  👑 DM account required — sign in to run the table →
                </button>
              </div>
            </form>
          )}

          {/* Active Players in Session */}
          <div className="flex flex-col items-center gap-1.5 pt-3 w-full border-t border-borderDark/40">
            <div className="flex items-center justify-between w-full px-1">
              <span className="text-[9px] text-accentGold uppercase tracking-widest font-bold opacity-80">
                Active at the Table
              </span>
              <span className="text-[8px] font-bold text-textMuted bg-black/40 border border-borderDark/60 px-1.5 py-0.5 rounded-full">
                {activePlayers?.length || 0} Online
              </span>
            </div>

            <div className="flex flex-wrap justify-center gap-x-2 gap-y-1.5 w-full min-h-[36px] max-h-24 overflow-y-auto p-1">
              {activePlayers && activePlayers.length > 0 ? (
                activePlayers.map((p) => (
                  <div
                    key={p.userId || p.name}
                    className="flex items-center gap-2 bg-bgCard/80 px-2.5 py-1 rounded-full border border-borderDark/60 shadow-sm"
                  >
                    <div
                      className={`w-2 h-2 rounded-full ${
                        p.role === 'DM'
                          ? 'bg-accentGold ring-2 ring-yellow-400/30'
                          : 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]'
                      }`}
                    />
                    <span
                      className={`text-[11px] font-semibold ${
                        p.role === 'DM' ? 'text-accentGold font-bold' : 'text-white'
                      }`}
                    >
                      {p.name} {p.role === 'DM' && '(DM)'}
                    </span>
                  </div>
                ))
              ) : (
                <span className="text-[11px] text-textMuted italic flex items-center justify-center h-8">
                  Table is currently clear. Be the first to join.
                </span>
              )}
            </div>
          </div>

          {/* Footer Tools */}
          <button
            type="button"
            onClick={handleShowChangelog}
            className="text-[11px] text-textMuted hover:text-accentGold transition-colors tracking-wide underline pt-1"
          >
            What's New? (Changelog)
          </button>
        </div>
      </div>

      {/* Changelog Modal */}
      {showChangelog && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#12141a] border border-accentGold/50 rounded-2xl shadow-2xl max-w-lg w-full p-6 animate-in zoom-in duration-200 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-borderDark/60 pb-3 mb-3">
              <h2 className="text-accentGold font-extrabold text-base tracking-wider uppercase">
                System Changelog
              </h2>
              <span className="text-[10px] text-textMuted font-mono">v{VERSION}</span>
            </div>

            <div className="text-textLight text-xs space-y-2 overflow-y-auto pr-2 font-mono flex-1 leading-relaxed">
              {loadingChangelog ? (
                <p className="text-accentGold animate-pulse">Loading patch notes...</p>
              ) : (
                changelogContent.split('\n').map((line, idx) => {
                  if (line.startsWith('###')) {
                    return (
                      <h3
                        key={idx}
                        className="font-bold text-accentGold mt-3 mb-1 text-xs border-b border-borderDark/30 pb-0.5"
                      >
                        {line.replace('###', '').trim()}
                      </h3>
                    );
                  }
                  if (line.trim().startsWith('-')) {
                    return (
                      <div key={idx} className="ml-2 flex items-start gap-1.5 text-textLight">
                        <span className="text-accentGold">•</span>
                        <span>{line.substring(1).trim()}</span>
                      </div>
                    );
                  }
                  if (line.trim() === '') return <div key={idx} className="h-1" />;
                  return <div key={idx}>{line}</div>;
                })
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                soundSynthesizer.playUIClick();
                setShowChangelog(false);
              }}
              className="mt-4 w-full bg-accentGold text-black font-extrabold py-2.5 rounded-xl text-xs uppercase tracking-wider hover:bg-yellow-500 transition-all shadow-md"
            >
              Return to Table
            </button>
          </div>
        </div>
      )}
    </div>
  );
}