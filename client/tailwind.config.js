// client/tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bgDark: 'var(--color-bg-dark)',
        bgPanel: 'var(--color-bg-panel)',
        bgCard: 'var(--color-bg-card)',
        borderDark: 'var(--color-border-dark)',
        accentGold: 'var(--color-accent-gold)',
        textLight: 'var(--color-text-light)',
        textMuted: 'var(--color-text-muted)',

        // SRD Manager palette
        srd: {
          50: '#f0f4ff',
          100: '#dbe4ff',
          200: '#bac8ff',
          300: '#91a7ff',
          400: '#748ffc',
          500: '#5c7cfa',
          600: '#4c6ef5',
          700: '#4263eb',
          800: '#3b5bdb',
          900: '#364fc7',
        },
        dnd: {
          dark: '#1a1a2e',
          mid: '#16213e',
          accent: '#e94560',
          gold: '#f0c040',
          parchment: '#f5f0e8',
        },
      },
    },
  },
  plugins: [],
};