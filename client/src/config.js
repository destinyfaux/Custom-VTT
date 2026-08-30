// client/src/config.js
export const SERVER_URL = (() => {
  if (typeof window === 'undefined') return 'http://localhost:3001';

  // If running locally in Vite development mode (e.g. localhost:5173)
  if (window.location.port === '5173') {
    return `${window.location.protocol}//${window.location.hostname}:3001`;
  }

  // When loaded via Cloudflare Tunnel, LAN IP, or built SPA, always use the active browser origin
  return window.location.origin;
})();

console.log('[VTT-System] Target Backend URL:', SERVER_URL);