// server/services/accountManager.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const USERS_FILE = path.resolve(__dirname, '../assets/users_db.json');
const CHARS_FILE = path.resolve(__dirname, '../assets/characters_db.json');

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}

class AccountManager {
  constructor() {
    this.users = this.loadJSON(USERS_FILE, {});
    this.characters = this.loadJSON(CHARS_FILE, {});
    this.sessions = new Map(); // token -> userId
  }

  loadJSON(filepath, fallback) {
    try {
      if (fs.existsSync(filepath)) {
        return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
      }
    } catch (e) {
      console.error(`[AccountManager] Error reading ${filepath}:`, e.message);
    }
    return fallback;
  }

  saveUsers() {
    try {
      const dir = path.dirname(USERS_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(USERS_FILE, JSON.stringify(this.users, null, 2), 'utf-8');
    } catch (e) {
      console.error('[AccountManager] Failed to save users:', e.message);
    }
  }

  saveCharacters() {
    try {
      const dir = path.dirname(CHARS_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(CHARS_FILE, JSON.stringify(this.characters, null, 2), 'utf-8');
    } catch (e) {
      console.error('[AccountManager] Failed to save characters:', e.message);
    }
  }

  register(username, password) {
    const cleanUser = username.trim().toLowerCase();
    if (!cleanUser || !password) {
      return { success: false, error: 'Username and password required.' };
    }
    if (this.users[cleanUser]) {
      return { success: false, error: 'Username is already taken.' };
    }

    const userId = crypto.randomUUID();
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassword(password, salt);

    this.users[cleanUser] = {
      userId,
      username: username.trim(),
      salt,
      hash,
      createdAt: new Date().toISOString()
    };
    this.saveUsers();

    const token = crypto.randomBytes(32).toString('hex');
    this.sessions.set(token, userId);

    return {
      success: true,
      token,
      user: { userId, username: username.trim() }
    };
  }

  login(username, password) {
    const cleanUser = username.trim().toLowerCase();
    const account = this.users[cleanUser];
    if (!account) {
      return { success: false, error: 'Invalid username or password.' };
    }

    const testHash = hashPassword(password, account.salt);
    if (testHash !== account.hash) {
      return { success: false, error: 'Invalid username or password.' };
    }

    const token = crypto.randomBytes(32).toString('hex');
    this.sessions.set(token, account.userId);

    return {
      success: true,
      token,
      user: { userId: account.userId, username: account.username }
    };
  }

  verifySession(token) {
    if (!token) return null;
    const userId = this.sessions.get(token);
    if (!userId) return null;

    const account = Object.values(this.users).find((u) => u.userId === userId);
    return account ? { userId: account.userId, username: account.username } : null;
  }

  getUserCharacters(userId) {
    return Object.values(this.characters).filter((c) => c.ownerId === userId);
  }

  getCharacter(characterId) {
    return this.characters[characterId] || null;
  }

  saveCharacter(userId, characterId, sheetData) {
    const id = characterId || `char_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    this.characters[id] = {
      id,
      ownerId: userId,
      name: sheetData.name || 'Unnamed Adventurer',
      avatarUrl: sheetData.avatarUrl || null,
      data: sheetData,
      updatedAt: new Date().toISOString()
    };
    this.saveCharacters();
    return this.characters[id];
  }

  deleteCharacter(userId, characterId) {
    const char = this.characters[characterId];
    if (char && char.ownerId === userId) {
      delete this.characters[characterId];
      this.saveCharacters();
      return true;
    }
    return false;
  }
}

module.exports = new AccountManager();