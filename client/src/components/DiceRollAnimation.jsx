// client/src/components/DiceRollAnimation.jsx
import React, { useEffect, useState, useRef, useMemo } from 'react';
import soundSynthesizer from '../utils/SoundSynthesizer';

/* =========================================================================
   POLYHEDRAL GEOMETRY & FACET RENDERERS
   ========================================================================= */

const DieFaceSVG = ({ sides, value, tier, isRolling }) => {
  // Color palette by tier
  const tierThemes = {
    nat1: {
      primary: '#450a0a',
      secondary: '#1c0404',
      border: '#ef4444',
      accent: '#f87171',
      text: '#fca5a5',
      glow: 'rgba(239, 68, 68, 0.8)',
    },
    low: {
      primary: '#1f242d',
      secondary: '#11141a',
      border: '#64748b',
      accent: '#94a3b8',
      text: '#cbd5e1',
      glow: 'rgba(100, 116, 139, 0.4)',
    },
    mid: {
      primary: '#1c1917',
      secondary: '#0c0a09',
      border: '#d97706',
      accent: '#fbbf24',
      text: '#fef08a',
      glow: 'rgba(217, 119, 6, 0.5)',
    },
    high: {
      primary: '#082f49',
      secondary: '#02131f',
      border: '#38bdf8',
      accent: '#93c5fd',
      text: '#e0f2fe',
      glow: 'rgba(56, 189, 248, 0.7)',
    },
    crit: {
      primary: '#422006',
      secondary: '#1c0e02',
      border: '#fbbf24',
      accent: '#fef08a',
      text: '#ffffff',
      glow: 'rgba(251, 191, 36, 0.95)',
    },
  };

  const theme = isRolling ? tierThemes.mid : tierThemes[tier] || tierThemes.mid;

  // Render SVG outlines and faceted geometry according to polyhedral shape
  const renderGeometry = () => {
    switch (sides) {
      case 4: // Tetrahedron (Triangle)
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-xl">
            <defs>
              <linearGradient id={`g-d4-${value}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={theme.primary} />
                <stop offset="100%" stopColor={theme.secondary} />
              </linearGradient>
            </defs>
            {/* Outer Triangle */}
            <polygon points="50,10 90,82 10,82" fill={`url(#g-d4-${value})`} stroke={theme.border} strokeWidth="3" strokeLinejoin="round" />
            {/* Internal Facet Edges */}
            <line x1="50" y1="10" x2="50" y2="58" stroke={theme.accent} strokeWidth="1.5" strokeOpacity="0.6" />
            <line x1="90" y1="82" x2="50" y2="58" stroke={theme.accent} strokeWidth="1.5" strokeOpacity="0.6" />
            <line x1="10" y1="82" x2="50" y2="58" stroke={theme.accent} strokeWidth="1.5" strokeOpacity="0.6" />
            {/* Inner facet shading */}
            <polygon points="50,10 90,82 50,58" fill="white" fillOpacity="0.04" />
            <polygon points="10,82 50,10 50,58" fill="black" fillOpacity="0.15" />
          </svg>
        );

      case 6: // Cube Face with Beveled Corners & Metallic Rim
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-xl">
            <defs>
              <linearGradient id={`g-d6-${value}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={theme.primary} />
                <stop offset="100%" stopColor={theme.secondary} />
              </linearGradient>
            </defs>
            <rect x="10" y="10" width="80" height="80" rx="14" fill={`url(#g-d6-${value})`} stroke={theme.border} strokeWidth="3.5" />
            {/* Inner beveled border */}
            <rect x="18" y="18" width="64" height="64" rx="8" fill="none" stroke={theme.accent} strokeWidth="1" strokeOpacity="0.4" />
            <line x1="10" y1="10" x2="18" y2="18" stroke={theme.accent} strokeWidth="1.5" strokeOpacity="0.5" />
            <line x1="90" y1="10" x2="82" y2="18" stroke={theme.accent} strokeWidth="1.5" strokeOpacity="0.5" />
            <line x1="90" y1="90" x2="82" y2="82" stroke={theme.accent} strokeWidth="1.5" strokeOpacity="0.5" />
            <line x1="10" y1="90" x2="18" y2="82" stroke={theme.accent} strokeWidth="1.5" strokeOpacity="0.5" />
          </svg>
        );

      case 8: // Octahedron (Diamond / Double Pyramid)
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-xl">
            <defs>
              <linearGradient id={`g-d8-${value}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={theme.primary} />
                <stop offset="100%" stopColor={theme.secondary} />
              </linearGradient>
            </defs>
            <polygon points="50,8 90,50 50,92 10,50" fill={`url(#g-d8-${value})`} stroke={theme.border} strokeWidth="3" strokeLinejoin="round" />
            {/* Facets */}
            <line x1="50" y1="8" x2="50" y2="92" stroke={theme.accent} strokeWidth="1.5" strokeOpacity="0.6" />
            <line x1="10" y1="50" x2="90" y2="50" stroke={theme.accent} strokeWidth="1.5" strokeOpacity="0.6" />
            <polygon points="50,8 90,50 50,50" fill="white" fillOpacity="0.08" />
            <polygon points="10,50 50,50 50,92" fill="black" fillOpacity="0.2" />
          </svg>
        );

      case 10:
      case 100: // Pentagonal Trapezohedron (Kite / Shield Gem)
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-xl">
            <defs>
              <linearGradient id={`g-d10-${value}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={theme.primary} />
                <stop offset="100%" stopColor={theme.secondary} />
              </linearGradient>
            </defs>
            <polygon points="50,6 90,38 74,90 26,90 10,38" fill={`url(#g-d10-${value})`} stroke={theme.border} strokeWidth="3" strokeLinejoin="round" />
            {/* Facet lines meeting at center */}
            <line x1="50" y1="6" x2="50" y2="58" stroke={theme.accent} strokeWidth="1.5" strokeOpacity="0.7" />
            <line x1="90" y1="38" x2="50" y2="58" stroke={theme.accent} strokeWidth="1.5" strokeOpacity="0.7" />
            <line x1="74" y1="90" x2="50" y2="58" stroke={theme.accent} strokeWidth="1.5" strokeOpacity="0.7" />
            <line x1="26" y1="90" x2="50" y2="58" stroke={theme.accent} strokeWidth="1.5" strokeOpacity="0.7" />
            <line x1="10" y1="38" x2="50" y2="58" stroke={theme.accent} strokeWidth="1.5" strokeOpacity="0.7" />
            <polygon points="50,6 90,38 50,58" fill="white" fillOpacity="0.08" />
            <polygon points="26,90 10,38 50,58" fill="black" fillOpacity="0.25" />
          </svg>
        );

      case 12: // Dodecahedron (Pentagon / Hexagonal facets)
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-xl">
            <defs>
              <linearGradient id={`g-d12-${value}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={theme.primary} />
                <stop offset="100%" stopColor={theme.secondary} />
              </linearGradient>
            </defs>
            {/* Outer Decagon / Rounded outline */}
            <polygon points="50,6 88,20 96,60 68,94 32,94 4,60 12,20" fill={`url(#g-d12-${value})`} stroke={theme.border} strokeWidth="3" strokeLinejoin="round" />
            {/* Inner Pentagon */}
            <polygon points="50,26 78,44 67,76 33,76 22,44" fill={theme.secondary} stroke={theme.accent} strokeWidth="1.5" strokeOpacity="0.7" />
            {/* Connecting facet edges */}
            <line x1="50" y1="6" x2="50" y2="26" stroke={theme.accent} strokeWidth="1.5" strokeOpacity="0.6" />
            <line x1="88" y1="20" x2="78" y2="44" stroke={theme.accent} strokeWidth="1.5" strokeOpacity="0.6" />
            <line x1="96" y1="60" x2="78" y2="44" stroke={theme.accent} strokeWidth="1.5" strokeOpacity="0.6" />
            <line x1="68" y1="94" x2="67" y2="76" stroke={theme.accent} strokeWidth="1.5" strokeOpacity="0.6" />
            <line x1="32" y1="94" x2="33" y2="76" stroke={theme.accent} strokeWidth="1.5" strokeOpacity="0.6" />
            <line x1="4" y1="60" x2="22" y2="44" stroke={theme.accent} strokeWidth="1.5" strokeOpacity="0.6" />
            <line x1="12" y1="20" x2="22" y2="44" stroke={theme.accent} strokeWidth="1.5" strokeOpacity="0.6" />
          </svg>
        );

      case 20:
      default: // Icosahedron (20-sided D&D Icon)
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-2xl">
            <defs>
              <linearGradient id={`g-d20-${value}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={theme.primary} />
                <stop offset="100%" stopColor={theme.secondary} />
              </linearGradient>
            </defs>
            {/* Outer Hexagon Base */}
            <polygon points="50,5 92,28 92,72 50,95 8,72 8,28" fill={`url(#g-d20-${value})`} stroke={theme.border} strokeWidth="3" strokeLinejoin="round" />
            {/* Center Dominant Triangle */}
            <polygon points="50,24 82,70 18,70" fill={theme.secondary} stroke={theme.accent} strokeWidth="1.5" strokeOpacity="0.8" />
            {/* Facet Bridges to Outer Hexagon Vertices */}
            <line x1="50" y1="5" x2="50" y2="24" stroke={theme.accent} strokeWidth="1.5" strokeOpacity="0.7" />
            <line x1="92" y1="28" x2="50" y2="24" stroke={theme.accent} strokeWidth="1.5" strokeOpacity="0.7" />
            <line x1="92" y1="28" x2="82" y2="70" stroke={theme.accent} strokeWidth="1.5" strokeOpacity="0.7" />
            <line x1="92" y1="72" x2="82" y2="70" stroke={theme.accent} strokeWidth="1.5" strokeOpacity="0.7" />
            <line x1="50" y1="95" x2="82" y2="70" stroke={theme.accent} strokeWidth="1.5" strokeOpacity="0.7" />
            <line x1="50" y1="95" x2="18" y2="70" stroke={theme.accent} strokeWidth="1.5" strokeOpacity="0.7" />
            <line x1="8" y1="72" x2="18" y2="70" stroke={theme.accent} strokeWidth="1.5" strokeOpacity="0.7" />
            <line x1="8" y1="28" x2="18" y2="70" stroke={theme.accent} strokeWidth="1.5" strokeOpacity="0.7" />
            <line x1="8" y1="28" x2="50" y2="24" stroke={theme.accent} strokeWidth="1.5" strokeOpacity="0.7" />
            {/* Ambient Shading Highlights */}
            <polygon points="50,5 92,28 50,24" fill="white" fillOpacity="0.1" />
            <polygon points="8,72 50,95 18,70" fill="black" fillOpacity="0.3" />
          </svg>
        );
    }
  };

  return (
    <div className="relative w-full h-full flex items-center justify-center select-none">
      {/* Geometry Canvas */}
      {renderGeometry()}

      {/* Numerical Inscription */}
      <div
        className="absolute inset-0 flex items-center justify-center font-black tracking-tight"
        style={{
          color: theme.text,
          textShadow: isRolling
            ? '0 0 8px rgba(255,255,255,0.4)'
            : `0 0 14px ${theme.glow}, 0 2px 4px rgba(0,0,0,0.9)`,
          fontSize: sides >= 100 ? '1.25rem' : sides === 4 ? '1.4rem' : '1.75rem',
          transform: sides === 4 ? 'translateY(4px)' : 'none',
          fontFamily: "'Cinzel', 'Trajan Pro', 'Georgia', serif",
        }}
      >
        {value}
      </div>

      {/* Dynamic Specular Sheen on Max / High rolls */}
      {(tier === 'crit' || tier === 'high') && !isRolling && (
        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-white/20 to-transparent pointer-events-none animate-pulse" />
      )}
    </div>
  );
};

/* =========================================================================
   CANVAS PARTICLE SYSTEM (AAA Impact Sparks & Cursed Embers)
   ========================================================================= */
const ParticleCanvas = ({ activeTier, isLanded }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!isLanded || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = (canvas.width = window.innerWidth);
    const height = (canvas.height = window.innerHeight);

    let particles = [];
    const count = activeTier === 'crit' ? 90 : activeTier === 'nat1' ? 70 : 35;

    const colors =
      activeTier === 'crit'
        ? ['#fde047', '#f59e0b', '#ffffff', '#fbbf24', '#fef08a']
        : activeTier === 'nat1'
        ? ['#ef4444', '#7f1d1d', '#991b1b', '#000000', '#f87171']
        : activeTier === 'high'
        ? ['#38bdf8', '#93c5fd', '#ffffff', '#60a5fa']
        : ['#94a3b8', '#cbd5e1', '#d97706'];

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * (activeTier === 'crit' ? 9 : 6) + 2;
      particles.push({
        x: width / 2,
        y: height / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (activeTier === 'crit' ? 2 : 0),
        radius: Math.random() * (activeTier === 'crit' ? 4.5 : 3) + 1,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
        decay: Math.random() * 0.02 + 0.012,
        gravity: activeTier === 'nat1' ? 0.08 : 0.04,
      });
    }

    let animId;
    const render = () => {
      ctx.clearRect(0, 0, width, height);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.alpha -= p.decay;

        if (p.alpha > 0) {
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.shadowBlur = 10;
          ctx.shadowColor = p.color;
          ctx.fill();
          ctx.restore();
        }
      });

      particles = particles.filter((p) => p.alpha > 0);
      if (particles.length > 0) {
        animId = requestAnimationFrame(render);
      }
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [isLanded, activeTier]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[2010]"
    />
  );
};

/* =========================================================================
   MAIN DICE ROLL COMPONENT
   ========================================================================= */

export default function DiceRollAnimation({ results = [], onComplete, isReviewMode = false }) {
  // If in review mode, immediately start in 'settled' state
  const [phase, setPhase] = useState(isReviewMode ? 'settled' : 'tumble');
  const [displayValues, setDisplayValues] = useState(() => results.map((r) => r.value));
  const [hasImpactSoundPlayed, setHasImpactSoundPlayed] = useState(isReviewMode);

  // Compute roll breakdown analysis
  const rollAnalysis = useMemo(() => {
    let total = 0;
    let hasNat20 = false;
    let hasNat1 = false;
    let hasMaxRoll = false;

    const analyzedDice = results.map((r) => {
      total += r.value;
      const isMax = r.value === r.sides;
      const isMin = r.value === 1;

      if (r.sides === 20 && isMax) hasNat20 = true;
      if (r.sides === 20 && isMin) hasNat1 = true;
      if (isMax) hasMaxRoll = true;

      // Determine Tier
      let tier = 'mid';
      if (r.sides === 20 && isMin) tier = 'nat1';
      else if (isMax) tier = 'crit';
      else {
        const ratio = r.value / r.sides;
        if (ratio <= 0.25) tier = 'low';
        else if (ratio >= 0.75) tier = 'high';
        else tier = 'mid';
      }

      return { ...r, tier, isMax, isMin };
    });

    // Global outcome banner
    let dominantTier = 'mid';
    let bannerTitle = isReviewMode ? 'PREVIOUS ROLL' : 'DICE RESOLVED';
    let bannerColor = 'text-accentGold';

    if (hasNat20) {
      dominantTier = 'crit';
      bannerTitle = isReviewMode ? 'PREVIOUS: ★ CRITICAL HIT! ★' : '★ CRITICAL HIT! ★';
      bannerColor = 'text-yellow-300';
    } else if (hasNat1) {
      dominantTier = 'nat1';
      bannerTitle = isReviewMode ? 'PREVIOUS: ☠ CRITICAL FAIL ☠' : '☠ CRITICAL FAILURE ☠';
      bannerColor = 'text-red-500';
    } else if (hasMaxRoll) {
      dominantTier = 'crit';
      bannerTitle = isReviewMode ? 'PREVIOUS: MAXIMUM ROLL!' : 'MAXIMUM ROLL!';
      bannerColor = 'text-amber-300';
    }

    return { total, analyzedDice, dominantTier, bannerTitle, bannerColor };
  }, [results, isReviewMode]);

  // Dynamic Ticker / Rapid Number Shuffle during flight
  useEffect(() => {
    if (isReviewMode) return;
    let interval;
    if (phase === 'tumble') {
      interval = setInterval(() => {
        setDisplayValues(
          results.map((r) => Math.floor(Math.random() * r.sides) + 1)
        );
      }, 50);
    } else {
      // Snap to final values
      setDisplayValues(results.map((r) => r.value));
    }
    return () => clearInterval(interval);
  }, [phase, results, isReviewMode]);

  // Timeline Controller (Only runs in normal roll animation mode)
  useEffect(() => {
    if (isReviewMode) return;

    const impactTimer = setTimeout(() => {
      setPhase('impact');
    }, 1100);

    // 2. Settled Glow & Fanfare Phase (1.3s - 3.2s)
    const settleTimer = setTimeout(() => {
      setPhase('settled');
    }, 1300);

    // 3. Auto Finish
    const finishTimer = setTimeout(() => {
      onComplete?.();
    }, 3300);

    return () => {
      clearTimeout(impactTimer);
      clearTimeout(settleTimer);
      clearTimeout(finishTimer);
    };
  }, [onComplete, isReviewMode]);

  // Sound triggers on impact
  useEffect(() => {
    if (isReviewMode) return;
    if (phase === 'impact' && !hasImpactSoundPlayed) {
      setHasImpactSoundPlayed(true);
      if (rollAnalysis.dominantTier === 'crit') {
        soundSynthesizer.playCriticalSuccess?.();
      } else if (rollAnalysis.dominantTier === 'nat1') {
        soundSynthesizer.playCriticalFail?.();
      } else {
        soundSynthesizer.playDiceRoll?.();
      }
    }
  }, [phase, hasImpactSoundPlayed, rollAnalysis.dominantTier, isReviewMode]);

  return (
    <div
      onClick={onComplete}
      className={`fixed inset-0 z-[2000] flex flex-col items-center justify-center cursor-pointer transition-all duration-500 ${
        phase === 'impact' ? 'scale-[1.015]' : 'scale-100'
      }`}
      style={{
        background:
          rollAnalysis.dominantTier === 'nat1' && phase !== 'tumble'
            ? 'radial-gradient(circle at center, rgba(69, 10, 10, 0.85) 0%, rgba(10, 0, 0, 0.96) 100%)'
            : rollAnalysis.dominantTier === 'crit' && phase !== 'tumble'
            ? 'radial-gradient(circle at center, rgba(74, 45, 8, 0.88) 0%, rgba(5, 5, 10, 0.95) 100%)'
            : 'radial-gradient(circle at center, rgba(24, 24, 32, 0.85) 0%, rgba(6, 6, 9, 0.95) 100%)',
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* Particle Canvas Behind Dice */}
      <ParticleCanvas
        activeTier={rollAnalysis.dominantTier}
        isLanded={phase !== 'tumble'}
      />

      {/* Review Mode Top Close Button */}
      {isReviewMode && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onComplete?.();
          }}
          className="absolute top-6 right-6 z-[2020] bg-black/60 hover:bg-black/90 border border-white/20 hover:border-accentGold text-textLight hover:text-accentGold text-xs uppercase font-bold px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5 shadow-xl"
        >
          <span>✕</span>
          <span>Close</span>
        </button>
      )}

      {/* Main Container */}
      <div
        className={`w-full max-w-4xl px-4 flex flex-col items-center justify-center select-none ${
          phase === 'impact' ? 'animate-screen-shake' : ''
        }`}
      >
        {/* AAA Title Header Banner */}
        <div className="text-center mb-8 h-12 flex items-center justify-center">
          {phase !== 'tumble' ? (
            <div className="animate-in zoom-in-95 duration-300 flex flex-col items-center">
              <span
                className={`text-2xl sm:text-3xl font-black uppercase tracking-[0.25em] ${rollAnalysis.bannerColor} drop-shadow-[0_0_20px_currentColor]`}
                style={{ fontFamily: "'Cinzel', 'Georgia', serif" }}
              >
                {rollAnalysis.bannerTitle}
              </span>
              <div
                className={`h-0.5 w-32 mt-1 rounded-full ${
                  rollAnalysis.dominantTier === 'crit'
                    ? 'bg-gradient-to-r from-transparent via-yellow-400 to-transparent'
                    : rollAnalysis.dominantTier === 'nat1'
                    ? 'bg-gradient-to-r from-transparent via-red-500 to-transparent'
                    : 'bg-gradient-to-r from-transparent via-accentGold to-transparent'
                }`}
              />
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-accentGold animate-ping" />
              <span className="text-accentGold/80 text-sm font-bold uppercase tracking-[0.3em] animate-pulse">
                Rolling Fate...
              </span>
              <span className="w-2 h-2 rounded-full bg-accentGold animate-ping" />
            </div>
          )}
        </div>

        {/* Dice Arena Grid */}
        <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-10 max-w-3xl">
          {rollAnalysis.analyzedDice.map((die, idx) => {
            const isRolling = phase === 'tumble';
            const currentValue = displayValues[idx] || die.value;

            // Stagger animation delays for natural rolling feel
            const delayOffset = (idx * 0.08).toFixed(2);

            return (
              <div
                key={idx}
                className="relative flex flex-col items-center group"
                style={{ perspective: 1000 }}
              >
                {/* Max Roll Radiance Halo */}
                {die.tier === 'crit' && phase !== 'tumble' && (
                  <div className="absolute -inset-4 rounded-full bg-yellow-400/20 blur-xl animate-pulse pointer-events-none" />
                )}

                {/* Nat 1 Dark Aura */}
                {die.tier === 'nat1' && phase !== 'tumble' && (
                  <div className="absolute -inset-4 rounded-full bg-red-600/30 blur-xl animate-pulse pointer-events-none" />
                )}

                {/* 3D Die Container */}
                <div
                  className={`w-24 h-24 sm:w-28 sm:h-28 transition-transform duration-300 ${
                    isRolling ? 'animate-tumble-3d' : isReviewMode ? '' : 'animate-slam-down'
                  }`}
                  style={{
                    animationDelay: `${delayOffset}s`,
                    transformStyle: 'preserve-3d',
                  }}
                >
                  <DieFaceSVG
                    sides={die.sides}
                    value={currentValue}
                    tier={die.tier}
                    isRolling={isRolling}
                  />
                </div>

                {/* Die Type Badge */}
                <div className="mt-3 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-black/60 border border-white/10 shadow-md">
                  <span className="text-[10px] font-bold tracking-wider text-textMuted uppercase">
                    d{die.sides}
                  </span>
                  {phase !== 'tumble' && die.isMax && (
                    <span className="text-[9px] text-yellow-400 font-extrabold">★ MAX</span>
                  )}
                  {phase !== 'tumble' && die.isMin && (
                    <span className="text-[9px] text-red-400 font-extrabold">✕ MIN</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Total Outcome Card */}
        {phase !== 'tumble' && (
          <div className="mt-10 animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col items-center">
            <div className="px-6 py-2 rounded-xl bg-bgCard/90 border border-borderDark shadow-2xl backdrop-blur-md flex items-center gap-4">
              <span className="text-xs uppercase tracking-widest text-textMuted font-bold">
                Total Score
              </span>
              <span
                className={`text-3xl font-black ${rollAnalysis.bannerColor} drop-shadow-md`}
              >
                {rollAnalysis.total}
              </span>
            </div>
            <span className="text-[10px] text-textMuted/60 mt-3 uppercase tracking-widest">
              {isReviewMode ? 'Click anywhere or press close' : 'Click anywhere to dismiss'}
            </span>
          </div>
        )}
      </div>

      {/* AAA Custom Animation Styles */}
      <style>{`
        @keyframes tumble-3d {
          0% {
            transform: translateY(-80px) rotateX(0deg) rotateY(0deg) rotateZ(0deg) scale(0.8);
          }
          30% {
            transform: translateY(-20px) rotateX(360deg) rotateY(180deg) rotateZ(90deg) scale(1.1);
          }
          60% {
            transform: translateY(-50px) rotateX(720deg) rotateY(540deg) rotateZ(270deg) scale(1.15);
          }
          85% {
            transform: translateY(0px) rotateX(1080deg) rotateY(720deg) rotateZ(360deg) scale(0.95);
          }
          100% {
            transform: translateY(-10px) rotateX(1260deg) rotateY(900deg) rotateZ(450deg) scale(1.05);
          }
        }

        @keyframes slam-down {
          0% {
            transform: translateY(-30px) scale(1.2) rotate(-15deg);
            filter: brightness(1.6);
          }
          60% {
            transform: translateY(6px) scale(0.88, 1.12) rotate(4deg);
          }
          80% {
            transform: translateY(-4px) scale(1.05, 0.95) rotate(-2deg);
          }
          100% {
            transform: translateY(0) scale(1) rotate(0deg);
            filter: brightness(1);
          }
        }

        @keyframes screen-shake {
          0% { transform: translate(0, 0); }
          20% { transform: translate(-3px, 4px) rotate(-0.5deg); }
          40% { transform: translate(3px, -3px) rotate(0.5deg); }
          60% { transform: translate(-2px, 2px); }
          80% { transform: translate(2px, -1px); }
          100% { transform: translate(0, 0); }
        }

        .animate-tumble-3d {
          animation: tumble-3d 1.1s cubic-bezier(0.25, 1, 0.5, 1) infinite;
        }

        .animate-slam-down {
          animation: slam-down 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }

        .animate-screen-shake {
          animation: screen-shake 0.35s ease-out;
        }
      `}</style>
    </div>
  );
}