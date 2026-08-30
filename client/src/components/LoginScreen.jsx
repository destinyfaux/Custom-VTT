// client/src/components/LoginScreen.jsx
import { useState, useEffect } from 'react';
import { SERVER_URL } from '../config';

const VERSION = '6.1';
const BUILD_DATE = '2026-06-11';

export default function LoginScreen({
  name,
  setName,
  onJoinAsPlayer,
  onJoinAsDM,
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
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    fetch(`${SERVER_URL}/api/login-background`)
      .then((res) => res.json())
      .then((data) => setBackgroundUrl(data.url))
      .catch(() => setBackgroundUrl(null));
  }, []);

  const loadChangelog = async () => {
    setLoadingChangelog(true);
    try {
      const res = await fetch(`${SERVER_URL}/api/changelog`);
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
    if (!changelogContent) loadChangelog();
    setShowChangelog(true);
  };

  // Account Login / Register Handler
  const handleAccountAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    const endpoint = authMode === 'register' ? '/api/auth/register' : '/api/auth/login';

    try {
      const res = await fetch(`${SERVER_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      setAuthLoading(false);

      if (!res.ok || !data.success) {
        setAuthError(data.error || 'Authentication failed. Please check credentials.');
        return;
      }

      // Store persistent session
      localStorage.setItem('vtt_session_token', data.token);
      localStorage.setItem('vtt_user_id', data.user.userId);
      localStorage.setItem('vtt_username', data.user.username);
      if (roomCode) localStorage.setItem('vtt_room_code', roomCode);

      if (onAuthSuccess) {
        onAuthSuccess(data.user, roomCode);
      } else {
        onJoinAsPlayer(roomCode);
      }
    } catch (err) {
      setAuthLoading(false);
      setAuthError('Cannot reach server. Please check the network connection.');
    }
  };

  const isVideo = backgroundUrl && /\.(mp4|webm|mov)$/i.test(backgroundUrl);

  return (
    <div className="h-screen w-screen relative bg-bgDark overflow-hidden select-none">
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
            <source src={`${SERVER_URL}${backgroundUrl}`} type="video/mp4" />
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
              onClick={() => { setAuthMode('quick'); setAuthError(''); }}
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
              onClick={() => { setAuthMode('login'); setAuthError(''); }}
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
              onClick={() => { setAuthMode('register'); setAuthError(''); }}
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
                  className="w-full p-3 bg-bgCard/80 border border-borderDark rounded-xl text-white outline-none focus:border-accentGold transition-all text-xs placeholder-textMuted shadow-inner"
                  placeholder="Enter your character name, adventurer..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <input
                  className="w-full p-3 bg-bgCard/80 border border-borderDark rounded-xl text-white outline-none focus:border-accentGold transition-all text-xs placeholder-textMuted shadow-inner"
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
                  onClick={() => onJoinAsPlayer(roomCode)}
                >
                  Join as Player
                </button>
                <button
                  type="button"
                  className="flex-1 bg-borderDark/80 border border-white/10 text-white font-extrabold py-3 rounded-xl hover:bg-gray-700 hover:border-accentGold/50 transition-all uppercase tracking-wider text-xs shadow-lg"
                  onClick={() => onJoinAsDM(roomCode)}
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
                className="w-full p-3 bg-bgCard/80 border border-borderDark rounded-xl text-white outline-none focus:border-accentGold transition-all text-xs placeholder-textMuted shadow-inner"
                placeholder="Account Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
              <input
                type="password"
                className="w-full p-3 bg-bgCard/80 border border-borderDark rounded-xl text-white outline-none focus:border-accentGold transition-all text-xs placeholder-textMuted shadow-inner"
                placeholder="Account Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <input
                className="w-full p-3 bg-bgCard/80 border border-borderDark rounded-xl text-white outline-none focus:border-accentGold transition-all text-xs placeholder-textMuted shadow-inner"
                placeholder="Room Code (optional)"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
              />

              <button
                type="submit"
                disabled={authLoading}
                className="w-full bg-accentGold text-black font-extrabold py-3 rounded-xl hover:bg-yellow-500 transition-all uppercase tracking-wider text-xs shadow-lg"
              >
                {authLoading
                  ? 'Accessing Server Vault...'
                  : authMode === 'register'
                  ? 'Create Vault Account'
                  : 'Unlock Characters & Connect'}
              </button>

              <div className="w-full text-center pt-1">
                <button
                  type="button"
                  onClick={() => onJoinAsDM(roomCode)}
                  className="text-[11px] text-accentGold/80 hover:text-accentGold hover:underline font-semibold"
                >
                  👑 Running the Table? Direct DM Entry →
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
              onClick={() => setShowChangelog(false)}
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