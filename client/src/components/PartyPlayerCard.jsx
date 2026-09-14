// client/src/components/PartyPlayerCard.jsx
// The Active Party roster card. Thin horizontal layout (dimensions preserved
// from the original inline block) with three upgrades:
//   1. Stats (HP/AC/SPD) are flex-based so they grow/shrink with the sidebar.
//   2. Player customization: animated frame FX, background preset, accent
//      color — all driven by characterData (cardFrame / cardBg / nameplateColor).
//   3. Card text truncates gracefully at any panel width.

import { resolveCardFrameClass, resolveCardBgClass } from '../data/cardStyles';

export default function PartyPlayerCard({ player, isOwn, showStats, onViewSheet }) {
  const char = player.characterData || {};
  const accent = char.nameplateColor || '#e6b422';
  const offline = player.status === 'offline';

  const displayName = player.name || char.name || 'Adventurer';
  const subtitle =
    char.name && char.name !== displayName
      ? char.name
      : (char.nameplateTagline || 'Adventurer');

  const hpCur = char.hpCur ?? 0;
  const hpMax = char.hpMax ?? 0;
  const hpRatio = hpMax > 0 ? Math.max(0, Math.min(1, hpCur / hpMax)) : 0;
  const hpColor =
    hpRatio > 0.5 ? '#4ade80' : hpRatio > 0.25 ? '#facc15' : '#f87171';

  return (
    <div
      className={`relative overflow-hidden rounded-lg border border-borderDark/80 shadow-md transition-all duration-200 hover:border-accentGold/60 ${offline ? 'opacity-50' : ''} ${resolveCardFrameClass(char.cardFrame)} ${resolveCardBgClass(char.cardBg)}`}
      style={{ borderLeftColor: accent, borderLeftWidth: '3px' }}
    >
      {/* Frame FX layers render above the background but below content */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-white/[0.05] via-transparent to-black/30" />

      <div className="relative flex items-center gap-2 p-1.5">
        {/* Avatar / Initial */}
        <div
          className="w-10 h-8 rounded-md shrink-0 overflow-hidden border bg-bgPanel flex items-center justify-center shadow-inner"
          style={{ borderColor: `${accent}66` }}
        >
          {char.avatarUrl ? (
            <img src={char.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span
              className="text-sm font-black"
              style={{ color: accent, textShadow: `0 0 8px ${accent}55` }}
            >
              {(displayName).charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        {/* Identity block — flexes with panel width */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="truncate text-[10px] font-black text-white">
              {displayName}
            </span>
            {isOwn && (
              <span
                className="shrink-0 text-[7px] font-black uppercase tracking-wider px-1 rounded-sm"
                style={{ color: accent, border: `1px solid ${accent}55` }}
                title="This is you"
              >
                You
              </span>
            )}
            <span
              className={`h-1.5 w-1.5 rounded-full shrink-0 ${offline ? 'bg-gray-500' : 'bg-emerald-400 shadow-[0_0_7px_rgba(52,211,153,0.8)]'}`}
              title={offline ? 'Offline' : 'Online'}
            />
          </div>
          <div
            className="truncate text-[8px] uppercase tracking-wider font-bold"
            style={{ color: `${accent}cc` }}
          >
            {subtitle}
          </div>
        </div>

        {/* Synced stats — each block flexes evenly and truncates. Visibility
            mirrors the original privacy rule: DM and the card owner only. */}
        {showStats && (
          <div className="flex items-stretch gap-1 shrink-0 w-[38%] max-w-[128px] min-w-[76px]">
            <div className="flex-1 min-w-0 rounded bg-black/30 px-1 py-1 text-center border border-white/5 overflow-hidden">
              <span className="block text-[6.5px] text-textMuted uppercase tracking-widest leading-none">HP</span>
              <strong className="block text-[9px] leading-tight text-white truncate" title={`${hpCur}/${hpMax}`}>
                {hpCur}
                <span className="text-textMuted">/{hpMax}</span>
              </strong>
              <div className="h-[2px] mt-0.5 rounded-full bg-black/50 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${hpRatio * 100}%`, backgroundColor: hpColor }}
                />
              </div>
            </div>
            <div className="flex-1 min-w-0 rounded bg-black/30 px-1 py-1 text-center border border-white/5 overflow-hidden">
              <span className="block text-[6.5px] text-textMuted uppercase tracking-widest leading-none">AC</span>
              <strong className="block text-[9px] leading-tight text-white truncate" title={`Armor Class ${char.ac ?? 0}`}>
                {char.ac ?? 0}
              </strong>
            </div>
            <div className="flex-1 min-w-0 rounded bg-black/30 px-1 py-1 text-center border border-white/5 overflow-hidden">
              <span className="block text-[6.5px] text-textMuted uppercase tracking-widest leading-none">SPD</span>
              <strong className="block text-[9px] leading-tight text-white truncate" title={`Speed ${char.speed || 30} ft`}>
                {char.speed || 30}
              </strong>
            </div>
          </div>
        )}

        {onViewSheet && (
          <button
            className="w-6 h-6 shrink-0 rounded border border-borderDark text-[11px] text-textMuted hover:text-accentGold hover:border-accentGold/60 transition-colors"
            onClick={() => onViewSheet(player.userId)}
            title="View character sheet"
            aria-label={`View ${displayName}'s character sheet`}
          >
            👁
          </button>
        )}
      </div>
    </div>
  );
}
