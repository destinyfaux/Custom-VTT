// client/src/config.js
export const SERVER_URL = (() => {
  if (typeof window === 'undefined') return 'http://localhost:3001';

  const configuredUrl = (import.meta.env.VITE_SERVER_URL || '').trim().replace(/\/+$/, '');
  const currentOrigin = window.location.origin;

  // Quick Tunnel hostnames are ephemeral. If the app and configured backend
  // are both tunnel origins, use the current origin so an old .env value
  // cannot send requests to an expired tunnel.
  if (
    configuredUrl &&
    !(
      /^https:\/\/[^/]+\.trycloudflare\.com$/i.test(configuredUrl) &&
      /\.trycloudflare\.com$/i.test(window.location.hostname)
    )
  ) {
    return configuredUrl;
  }

  // Vite proxies API, assets, and Socket.IO to the backend in development.
  if (window.location.port === '5173') {
    return '';
  }

  // When loaded from a tunnel or the production backend, use the active origin.
  return currentOrigin;
})();

console.log('[VTT-System] Target Backend URL:', SERVER_URL);