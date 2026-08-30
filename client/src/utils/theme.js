// client/src/utils/theme.js

const THEME_STORAGE_KEY = 'vtt_ui_theme';

export const themeDefinitions = {
  default: {
    label: 'Default',
    bgDark: 'rgb(var(--color-bg-dark) / <alpha-value>)',
    bgPanel: 'rgb(var(--color-bg-panel) / <alpha-value>)',
    bgCard: 'rgb(var(--color-bg-card) / <alpha-value>)',
    borderDark: 'rgb(var(--color-border-dark) / <alpha-value>)',
    textLight: 'rgb(var(--color-text-light) / <alpha-value>)',
    textMuted: 'rgb(var(--color-text-muted) / <alpha-value>)',
    accentGold: 'rgb(var(--color-accent-gold) / <alpha-value>)',
  },
  light: {
    label: '📜 Parchment',
    bgDark: 'rgb(var(--color-bg-dark-light) / <alpha-value>)',
    bgPanel: 'rgb(var(--color-bg-panel-light) / <alpha-value>)',
    bgCard: 'rgb(var(--color-bg-card-light) / <alpha-value>)',
    borderDark: 'rgb(var(--color-border-dark-light) / <alpha-value>)',
    textLight: 'rgb(var(--color-text-light-light) / <alpha-value>)',
    textMuted: 'rgb(var(--color-text-muted-light) / <alpha-value>)',
    accentGold: 'rgb(var(--color-accent-gold-light) / <alpha-value>)',
  },
  map: {
    label: '🌲 Map',
    bgDark: 'rgb(var(--color-bg-dark-map) / <alpha-value>)',
    bgPanel: 'rgb(var(--color-bg-panel-map) / <alpha-value>)',
    bgCard: 'rgb(var(--color-bg-card-map) / <alpha-value>)',
    borderDark: 'rgb(var(--color-border-dark-map) / <alpha-value>)',
    textLight: 'rgb(var(--color-text-light-map) / <alpha-value>)',
    textMuted: 'rgb(var(--color-text-muted-map) / <alpha-value>)',
    accentGold: 'rgb(var(--color-accent-gold-map) / <alpha-value>)',
  },
  ominous: {
    label: '🩸 Gloom',
    bgDark: 'rgb(var(--color-bg-dark-ominous) / <alpha-value>)',
    bgPanel: 'rgb(var(--color-bg-panel-ominous) / <alpha-value>)',
    bgCard: 'rgb(var(--color-bg-card-ominous) / <alpha-value>)',
    borderDark: 'rgb(var(--color-border-dark-ominous) / <alpha-value>)',
    textLight: 'rgb(var(--color-text-light-ominous) / <alpha-value>)',
    textMuted: 'rgb(var(--color-text-muted-ominous) / <alpha-value>)',
    accentGold: 'rgb(var(--color-accent-gold-ominous) / <alpha-value>)',
  },
  cute: {
    label: '🌸 Cute',
    bgDark: 'rgb(var(--color-bg-dark-cute) / <alpha-value>)',
    bgPanel: 'rgb(var(--color-bg-panel-cute) / <alpha-value>)',
    bgCard: 'rgb(var(--color-bg-card-cute) / <alpha-value>)',
    borderDark: 'rgb(var(--color-border-dark-cute) / <alpha-value>)',
    textLight: 'rgb(var(--color-text-light-cute) / <alpha-value>)',
    textMuted: 'rgb(var(--color-text-muted-cute) / <alpha-value>)',
    accentGold: 'rgb(var(--color-accent-gold-cute) / <alpha-value>)',
  },
  arcane: {
    label: '🌌 Arcane',
    bgDark: 'rgb(var(--color-bg-dark-arcane) / <alpha-value>)',
    bgPanel: 'rgb(var(--color-bg-panel-arcane) / <alpha-value>)',
    bgCard: 'rgb(var(--color-bg-card-arcane) / <alpha-value>)',
    borderDark: 'rgb(var(--color-border-dark-arcane) / <alpha-value>)',
    textLight: 'rgb(var(--color-text-light-arcane) / <alpha-value>)',
    textMuted: 'rgb(var(--color-text-muted-arcane) / <alpha-value>)',
    accentGold: 'rgb(var(--color-accent-gold-arcane) / <alpha-value>)',
  },
  forge: {
    label: '🔥 Forge',
    bgDark: 'rgb(var(--color-bg-dark-forge) / <alpha-value>)',
    bgPanel: 'rgb(var(--color-bg-panel-forge) / <alpha-value>)',
    bgCard: 'rgb(var(--color-bg-card-forge) / <alpha-value>)',
    borderDark: 'rgb(var(--color-border-dark-forge) / <alpha-value>)',
    textLight: 'rgb(var(--color-text-light-forge) / <alpha-value>)',
    textMuted: 'rgb(var(--color-text-muted-forge) / <alpha-value>)',
    accentGold: 'rgb(var(--color-accent-gold-forge) / <alpha-value>)',
  },
  cyber: {
    label: '⚡ Cyber',
    bgDark: 'rgb(var(--color-bg-dark-cyber) / <alpha-value>)',
    bgPanel: 'rgb(var(--color-bg-panel-cyber) / <alpha-value>)',
    bgCard: 'rgb(var(--color-bg-card-cyber) / <alpha-value>)',
    borderDark: 'rgb(var(--color-border-dark-cyber) / <alpha-value>)',
    textLight: 'rgb(var(--color-text-light-cyber) / <alpha-value>)',
    textMuted: 'rgb(var(--color-text-muted-cyber) / <alpha-value>)',
    accentGold: 'rgb(var(--color-accent-gold-cyber) / <alpha-value>)',
  },
  abyss: {
    label: '🌊 Abyss',
    bgDark: 'rgb(var(--color-bg-dark-abyss) / <alpha-value>)',
    bgPanel: 'rgb(var(--color-bg-panel-abyss) / <alpha-value>)',
    bgCard: 'rgb(var(--color-bg-card-abyss) / <alpha-value>)',
    borderDark: 'rgb(var(--color-border-dark-abyss) / <alpha-value>)',
    textLight: 'rgb(var(--color-text-light-abyss) / <alpha-value>)',
    textMuted: 'rgb(var(--color-text-muted-abyss) / <alpha-value>)',
    accentGold: 'rgb(var(--color-accent-gold-abyss) / <alpha-value>)',
  },
};

const aliases = {
  dark: 'default',
  light: 'light',
  parchment: 'light',
  map: 'map',
  forest: 'map',
  ominous: 'ominous',
  gloom: 'ominous',
  blood: 'ominous',
  cute: 'cute',
  pastel: 'cute',
  sakura: 'cute',
  pink: 'cute',
  arcane: 'arcane',
  astral: 'arcane',
  cosmic: 'arcane',
  magic: 'arcane',
  forge: 'forge',
  ember: 'forge',
  lava: 'forge',
  fire: 'forge',
  cyber: 'cyber',
  neon: 'cyber',
  synthwave: 'cyber',
  abyss: 'abyss',
  ocean: 'abyss',
  sea: 'abyss',
  teal: 'abyss',
};

export function resolveThemeName(theme) {
  const normalized = String(theme || 'default').toLowerCase();
  return aliases[normalized] || (themeDefinitions[normalized] ? normalized : 'default');
}

export function getThemePalette(theme) {
  return themeDefinitions[resolveThemeName(theme)] || themeDefinitions.default;
}

export function applyTheme(theme) {
  const resolvedTheme = resolveThemeName(theme);

  if (typeof document !== 'undefined') {
    if (resolvedTheme === 'default') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', resolvedTheme);
    }
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(THEME_STORAGE_KEY, resolvedTheme);
  }

  return resolvedTheme;
}

export function initializeTheme() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return 'default';
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY) || 'default';
  return applyTheme(storedTheme);
}

export function getStoredTheme() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return 'default';
  }

  return resolveThemeName(window.localStorage.getItem(THEME_STORAGE_KEY) || 'default');
}

export function getThemeOptions() {
  return Object.entries(themeDefinitions).map(([value, config]) => ({
    value,
    label: config.label,
  }));
}
