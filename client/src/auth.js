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
  // Return null (no role) if not explicitly set — prevents ghost "Player"
  return localStorage.getItem('vtt_role') || localStorage.getItem('vtt_user_role') || null;
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