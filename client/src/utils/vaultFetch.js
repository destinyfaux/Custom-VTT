// client/src/utils/vaultFetch.js
// Shared fetch helper for the character vault API. Account sessions use their
// Bearer token; Quick Play visitors fall back to their device userId header
// (the server's resolveVaultOwner mirrors this contract and maps it to the
// same guest_<deviceId> identity the socket handshake assigns).
import { SERVER_URL } from '../config';
import { getOrGenerateUserId } from '../auth';

export function vaultFetch(path, options = {}) {
  const token = localStorage.getItem('vtt_session_token');
  const baseUrl = (SERVER_URL || '').replace(/\/+$/, '');
  const headers = { ...(options.headers || {}) };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  } else {
    headers['x-vtt-user-id'] = getOrGenerateUserId();
  }
  return fetch(`${baseUrl}${path}`, { ...options, headers });
}
