// client/src/socket.js
import { io } from 'socket.io-client';
import { getOrGenerateUserId, getRole, getUserName } from './auth';
import { SERVER_URL } from './config';

export const socket = io(SERVER_URL, {
  autoConnect: true,
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  auth: (cb) => {
    cb({
      userId: getOrGenerateUserId(),
      name: getUserName(),
      role: getRole(),
      roomCode: localStorage.getItem('vtt_room_code') || ''
    });
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