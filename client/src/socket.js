// client/src/socket.js
import { io } from 'socket.io-client';
import { getOrGenerateUserId, getRole, getUserName, getSessionToken } from './auth';
import { SERVER_URL } from './config';

export const socket = io(SERVER_URL, {
  autoConnect: false,
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  auth: (cb) => {
    const configuredAuth = socket.auth && typeof socket.auth === 'object' ? socket.auth : {};
    const sessionToken = configuredAuth.sessionToken || getSessionToken();
    const legacyToken = localStorage.getItem('vtt_legacy_session_token') || '';
    const { sessionToken: ignoredSessionToken, token: ignoredToken, ...baseAuth } = configuredAuth;
    const payload = {
      ...baseAuth,
      ...(sessionToken ? { sessionToken } : { userId: baseAuth.userId || getOrGenerateUserId() }),
      ...(sessionToken || !legacyToken ? {} : { legacyToken }),
      name: configuredAuth.name || getUserName(),
      role: configuredAuth.role || getRole(),
      roomCode: configuredAuth.roomCode || localStorage.getItem('vtt_room_code') || ''
    };
    console.log('[VTT-System] Preparing socket handshake:', {
      serverUrl: SERVER_URL || window.location.origin,
      hasSessionToken: Boolean(sessionToken),
      hasLegacyToken: Boolean(payload.legacyToken),
      requestedRole: payload.role,
      userId: payload.userId || null
    });

    cb(payload);
  }
});

// Live Debug Listeners
socket.on('connect', () => {
  console.log('[VTT-System] ✅ Connected to server! ID:', socket.id, '| Role:', getRole(), '| Name:', getUserName());
});

socket.on('connect_error', (err) => {
  console.error('[VTT-System] ❌ Socket connection error:', err.message);
});

socket.on('disconnect', (reason) => {
  console.warn('[VTT-System] ⚠️ Disconnected from server:', reason);
});

export const localSyncEvents = {
  subscribe: () => () => {},
  emit: () => {}
};