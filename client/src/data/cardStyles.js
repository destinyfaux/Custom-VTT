// client/src/data/cardStyles.js
// Shared registries for player-card customization. Used by PartyPlayerCard
// (renderer) and AppearanceCard (picker UI) so both always agree on the
// available options. Persisted on characterData as:
//   nameplateColor  – accent color (hex)
//   nameplateTagline – subtitle text
//   cardFrame       – animated border style id (CSS in index.css)
//   cardBg          – background gradient preset id (CSS in index.css)

export const CARD_FRAMES = [
  { id: 'none',    label: 'None',    icon: '⬜', hint: 'Clean and classic' },
  { id: 'flame',   label: 'Flame',   icon: '🔥', hint: 'Living fire' },
  { id: 'frost',   label: 'Frost',   icon: '❄️', hint: 'Rime and ice' },
  { id: 'holy',    label: 'Holy',    icon: '✨', hint: 'Radiant gold' },
  { id: 'storm',   label: 'Storm',   icon: '⚡', hint: 'Crackling lightning' },
  { id: 'arcane',  label: 'Arcane',  icon: '🔮', hint: 'Liquid magic' },
  { id: 'shadow',  label: 'Shadow',  icon: '🌑', hint: 'Smoking dark' },
  { id: 'venom',   label: 'Venom',   icon: '☠️', hint: 'Dripping toxin' },
];

export const CARD_BACKGROUNDS = [
  { id: 'default',   label: 'Standard', swatch: '#1c1f2a' },
  { id: 'ember',     label: 'Ember',    swatch: '#3f1d0b' },
  { id: 'midnight',  label: 'Midnight', swatch: '#1e293b' },
  { id: 'parchment', label: 'Parchment',swatch: '#57452c' },
  { id: 'verdant',   label: 'Verdant',  swatch: '#1d3d28' },
  { id: 'royal',     label: 'Royal',    swatch: '#3b1d5e' },
  { id: 'void',      label: 'Void',     swatch: '#14141f' },
  { id: 'rose',      label: 'Rose',     swatch: '#572035' },
];

export const NAMEPLATE_ACCENTS = [
  { id: 'gold',    label: 'Gilded',  color: '#e6b422' },
  { id: 'crimson', label: 'Crimson', color: '#ef4444' },
  { id: 'verdant', label: 'Verdant', color: '#34d399' },
  { id: 'azure',   label: 'Azure',   color: '#60a5fa' },
  { id: 'violet',  label: 'Violet',  color: '#a78bfa' },
  { id: 'rose',    label: 'Rosé',    color: '#f472b6' },
  { id: 'ember',   label: 'Ember',   color: '#f97316' },
  { id: 'frost',   label: 'Frost',   color: '#67e8f9' },
];

export const resolveCardFrameClass = (frameId) =>
  frameId && frameId !== 'none'
    ? `party-card-frame party-card-frame-frame-${frameId}`
    : '';

export const resolveCardBgClass = (bgId) =>
  `cardbg-${bgId || 'default'}`;
