// server/services/accountManager.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const USERS_FILE = path.resolve(__dirname, '../assets/users_db.json');
const CHARS_FILE = path.resolve(__dirname, '../assets/characters_db.json');
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days session lifespan
const AVATARS_DIR = path.resolve(__dirname, '../assets/avatars');

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function safeTimingCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

class AccountManager {
  constructor() {
    this.users = this.loadJSON(USERS_FILE, {});
    this.characters = this.loadJSON(CHARS_FILE, {});
    this.sessions = new Map(); // token -> { userId, expiresAt }

    // Debounced asynchronous file flusher for high-frequency character sheet syncs
    this.saveCharactersDebounced = this.createDebouncedSave(CHARS_FILE, () => this.characters);
    this.saveUsersDebounced = this.createDebouncedSave(USERS_FILE, () => this.users);
    this.migrateEmbeddedAvatars();

    // Periodic sweep for expired sessions (every 30 minutes)
    this.sessionCleanupInterval = setInterval(() => this.pruneExpiredSessions(), 30 * 60 * 1000);
    if (this.sessionCleanupInterval.unref) this.sessionCleanupInterval.unref();
  }

  migrateEmbeddedAvatars() {
    let changed = false;
    for (const character of Object.values(this.characters)) {
      const avatar = character?.data?.avatarUrl || character?.avatarUrl;
      if (!this.isEmbeddedImage(avatar)) continue;
      const storedUrl = this.storeAvatarDataUrl(avatar, character.ownerId, character.id);
      if (!storedUrl) continue;
      character.avatarUrl = storedUrl;
      if (character.data) character.data = { ...character.data, avatarUrl: storedUrl };
      changed = true;
    }
    if (changed) this.saveCharacters(true);
  }

  isEmbeddedImage(value) {
    return typeof value === 'string' && /^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(value);
  }

  storeAvatarDataUrl(dataUrl, ownerId, characterId) {
    if (typeof dataUrl !== 'string' || dataUrl.length > 7 * 1024 * 1024) return null;
    const match = typeof dataUrl === 'string'
      ? dataUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,([\s\S]+)$/i)
      : null;
    if (!match || !ownerId || !characterId) return null;
    const buffer = Buffer.from(match[2], 'base64');
    if (!buffer.length || buffer.length > 5 * 1024 * 1024) return null;
    const extension = match[1].toLowerCase().replace('jpeg', 'jpg').split('/')[1];
    fs.mkdirSync(AVATARS_DIR, { recursive: true });
    const filename = `${ownerId}-${characterId}.${extension}`.replace(/[^a-zA-Z0-9._-]/g, '_');
    fs.writeFileSync(path.join(AVATARS_DIR, filename), buffer);
    return `/assets/avatars/${filename}`;
  }

  saveAvatar(userId, characterId, dataUrl) {
    if (!userId || !characterId || !this.isEmbeddedImage(dataUrl)) return null;
    return this.storeAvatarDataUrl(dataUrl, userId, characterId);
  }

  loadJSON(filepath, fallback) {
    try {
      if (fs.existsSync(filepath)) {
        const raw = fs.readFileSync(filepath, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error(`[AccountManager ERROR] Error reading ${filepath}:`, e.message);
    }
    return fallback;
  }

  createDebouncedSave(filepath, getDataFn, delay = 400) {
    let timeoutId = null;

    const flush = async () => {
      try {
        const dir = path.dirname(filepath);
        if (!fs.existsSync(dir)) await fs.promises.mkdir(dir, { recursive: true });
        const data = getDataFn();
        await fs.promises.writeFile(filepath, JSON.stringify(data, null, 2), 'utf-8');
      } catch (err) {
        console.error(`[AccountManager ERROR] Failed to write ${filepath}:`, err.message);
      }
    };

    const trigger = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        flush();
        timeoutId = null;
      }, delay);
    };

    trigger.flushSync = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      try {
        const dir = path.dirname(filepath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(filepath, JSON.stringify(getDataFn(), null, 2), 'utf-8');
      } catch (err) {
        console.error(`[AccountManager ERROR] Synchronous flush failed for ${filepath}:`, err.message);
      }
    };

    return trigger;
  }

  saveUsers(immediate = false) {
    if (immediate) {
      this.saveUsersDebounced.flushSync();
    } else {
      this.saveUsersDebounced();
    }
  }

  saveCharacters(immediate = false) {
    if (immediate) {
      this.saveCharactersDebounced.flushSync();
    } else {
      this.saveCharactersDebounced();
    }
  }

  pruneExpiredSessions() {
    const now = Date.now();
    for (const [token, session] of this.sessions.entries()) {
      if (session.expiresAt && now > session.expiresAt) {
        this.sessions.delete(token);
      }
    }
  }

  register(username, password, role = 'Player') {
    const cleanUser = (username || '').trim().toLowerCase();
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
      role: role === 'DM' ? 'DM' : 'Player',
      salt,
      hash,
      createdAt: new Date().toISOString()
    };
    this.saveUsers(true);

    const token = crypto.randomBytes(32).toString('hex');
    this.sessions.set(token, {
      userId,
      expiresAt: Date.now() + SESSION_TTL_MS
    });

    return {
      success: true,
      token,
      user: { userId, username: username.trim(), role: this.users[cleanUser].role }
    };
  }

  login(username, password) {
    const cleanUser = (username || '').trim().toLowerCase();
    const account = this.users[cleanUser];
    if (!account) {
      return { success: false, error: 'Invalid username or password.' };
    }

    const testHash = hashPassword(password, account.salt);
    if (!safeTimingCompare(testHash, account.hash)) {
      return { success: false, error: 'Invalid username or password.' };
    }

    const token = crypto.randomBytes(32).toString('hex');
    this.sessions.set(token, {
      userId: account.userId,
      expiresAt: Date.now() + SESSION_TTL_MS
    });

    return {
      success: true,
      token,
      user: { userId: account.userId, username: account.username, role: account.role || 'Player' }
    };
  }

  verifySession(token) {
    if (!token || typeof token !== 'string') return null;
    const session = this.sessions.get(token);
    if (!session) return null;

    if (session.expiresAt && Date.now() > session.expiresAt) {
      this.sessions.delete(token);
      return null;
    }

    const account = Object.values(this.users).find((u) => u.userId === session.userId);
    return account ? {
      userId: account.userId,
      username: account.username,
      role: account.role || 'Player'
    } : null;
  }

  destroySession(token) {
    if (token && this.sessions.has(token)) {
      this.sessions.delete(token);
      return true;
    }
    return false;
  }

  getUserCharacters(userId) {
    if (!userId) return [];
    return Object.values(this.characters).filter((c) => c.ownerId === userId);
  }

  getCharacter(characterId) {
    if (!characterId) return null;
    return this.characters[characterId] || null;
  }

  getUserCharacter(userId, characterId) {
    if (!userId || !characterId) return null;
    const character = this.getCharacter(characterId);
    return character && character.ownerId === userId ? character : null;
  }

  saveCharacter(userId, characterId, sheetData) {
    if (!userId || !sheetData || typeof sheetData !== 'object') return null;

    const id = characterId || sheetData.id || `char_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    
    // Ownership protection: If character already exists, ensure the requester is the owner
    const existing = this.characters[id];
    if (existing && existing.ownerId !== userId) {
      console.warn(`[AccountManager] Unauthorized save attempt on character ${id} by user ${userId}`);
      return null;
    }

    // Ensure sheetData internally keeps track of its canonical id
    if (!sheetData.id) {
      sheetData.id = id;
    }

    const compactSheet = { ...sheetData };
    if (this.isEmbeddedImage(compactSheet.avatarUrl)) {
      compactSheet.avatarUrl = this.storeAvatarDataUrl(compactSheet.avatarUrl, userId, id);
    }
    this.characters[id] = {
      id,
      ownerId: userId,
      name: sheetData.name || existing?.name || 'Unnamed Adventurer',
      avatarUrl: compactSheet.avatarUrl || existing?.avatarUrl || null,
      data: compactSheet,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.saveCharacters(false);
    return this.characters[id];
  }

  deleteCharacter(userId, characterId) {
    if (!userId || !characterId) return false;
    const char = this.characters[characterId];
    if (char && char.ownerId === userId) {
      delete this.characters[characterId];
      this.saveCharacters(true);
      return true;
    }
    return false;
  }
}

module.exports = new AccountManager();