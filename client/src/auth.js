// client/src/auth.js
import { v4 as uuidv4 } from 'uuid';

export const getOrGenerateUserId = () => {
  let userId = localStorage.getItem('vtt_user_id');
  
  if (!userId) {
    userId = uuidv4();
    localStorage.setItem('vtt_user_id', userId);
  }
  
  return userId;
};

export const getRole = () => {
  const role = localStorage.getItem('vtt_role') || localStorage.getItem('vtt_user_role');
  // A cached DM role is never sufficient to authorize a connection. The
  // server must receive the account session created by the current origin.
  if (role === 'DM' && !getSessionToken()) return null;
  return role === 'Player' || role === 'DM' ? role : null;
};

export const setRole = (role) => {
  localStorage.setItem('vtt_role', role);
  localStorage.setItem('vtt_user_role', role);
};

export const getUserName = () => {
  // Return empty string if no name stored — prevents default "Adventurer"
  return localStorage.getItem('vtt_user_name') || localStorage.getItem('vtt_name') || localStorage.getItem('vtt_username') || '';
};

export const setUserName = (name) => {
  localStorage.setItem('vtt_user_name', name);
  localStorage.setItem('vtt_name', name);
};

export const getSessionToken = () => localStorage.getItem('vtt_session_token') || '';

export const clearIdentityStorage = () => {
  localStorage.removeItem('vtt_session_token');
  localStorage.removeItem('vtt_user_id');
  localStorage.removeItem('vtt_legacy_session_token');
  localStorage.removeItem('vtt_username');
  localStorage.removeItem('vtt_role');
  localStorage.removeItem('vtt_user_role');
  localStorage.removeItem('vtt_active_character_id');
  localStorage.removeItem('tome_data');
};