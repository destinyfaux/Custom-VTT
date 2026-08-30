// server/server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const VTTManager = require('./VTTManager');
const accountManager = require('./services/accountManager');
const srdRoutes = require('./routes/srdRoutes');
const srdMonsterRoutes = require('./routes/srdMonsterRoutes');
const { 
  findAvailablePort, 
  getPublicIp, 
  startCloudflareTunnel, 
  stopCloudflareTunnel, 
  writeClientEnvFile, 
  writeRuntimeState 
} = require('./portUtils');

const app = express();

// Enable permissive CORS for all incoming origins & credentials
app.use(cors({
  origin: true,
  credentials: true
}));

// Parse JSON bodies - needed for SRD save routes and payload transfers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ─── SRD Manager API Routes ───
app.use('/api/srd', srdRoutes);
app.use('/api/srd-monsters', srdMonsterRoutes);

// ─── Static Game Assets ───
// express.static natively supports HTTP 206 Range Requests (necessary for audio buffering)
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// ─── Static Frontend SPA Serving (client/dist) ───
const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath));
}

// Serve the changelog markdown file
app.get('/api/changelog', (req, res) => {
    const changelogPath = path.join(__dirname, 'assets', 'changelog.md');
    if (!fs.existsSync(changelogPath)) {
        return res.status(404).send('Changelog file not found');
    }
    res.sendFile(changelogPath);
});

// ─── AUTHENTICATION & ACCOUNT VAULT API ROUTES ─────────────────────────────

app.post('/api/auth/register', (req, res) => {
    try {
        const { username, password } = req.body || {};
        if (!username || !password) {
            return res.status(400).json({ success: false, error: 'Username and password are required.' });
        }
        const result = accountManager.register(username, password);
        if (!result.success) {
            return res.status(400).json(result);
        }
        res.json(result);
    } catch (err) {
        console.error('[Server Auth ERROR] Registration exception:', err);
        res.status(500).json({ success: false, error: 'Internal server error during registration.' });
    }
});

app.post('/api/auth/login', (req, res) => {
    try {
        const { username, password } = req.body || {};
        if (!username || !password) {
            return res.status(400).json({ success: false, error: 'Username and password are required.' });
        }
        const result = accountManager.login(username, password);
        if (!result.success) {
            return res.status(401).json(result);
        }
        res.json(result);
    } catch (err) {
        console.error('[Server Auth ERROR] Login exception:', err);
        res.status(500).json({ success: false, error: 'Internal server error during login.' });
    }
});

app.post('/api/auth/verify', (req, res) => {
    try {
        const { token } = req.body || {};
        if (!token) {
            return res.status(401).json({ success: false, error: 'Token missing.' });
        }
        const user = accountManager.verifySession(token);
        if (!user) {
            return res.status(401).json({ success: false, error: 'Invalid or expired session token.' });
        }
        res.json({ success: true, user });
    } catch (err) {
        console.error('[Server Auth ERROR] Verify session exception:', err);
        res.status(500).json({ success: false, error: 'Internal server error verifying token.' });
    }
});

// ─── CHARACTER VAULT API ROUTES ────────────────────────────────────────────

app.get('/api/characters', (req, res) => {
    try {
        const authHeader = req.headers.authorization || '';
        const token = authHeader.replace(/^Bearer\s+/i, '').trim();
        const user = accountManager.verifySession(token);
        if (!user) {
            return res.status(401).json({ error: 'Unauthorized. Invalid session token.' });
        }

        const characters = accountManager.getUserCharacters(user.userId);
        res.json(characters);
    } catch (err) {
        console.error('[Server Vault ERROR] Fetch characters exception:', err);
        res.status(500).json({ error: 'Failed to retrieve character vault.' });
    }
});

app.post('/api/characters/save', (req, res) => {
    try {
        const authHeader = req.headers.authorization || '';
        const token = authHeader.replace(/^Bearer\s+/i, '').trim();
        const user = accountManager.verifySession(token);
        if (!user) {
            return res.status(401).json({ error: 'Unauthorized. Invalid session token.' });
        }

        const { characterId, sheetData } = req.body || {};
        if (!sheetData || typeof sheetData !== 'object') {
            return res.status(400).json({ error: 'Invalid or empty sheet data payload.' });
        }

        const saved = accountManager.saveCharacter(user.userId, characterId, sheetData);
        res.json({ success: true, character: saved });
    } catch (err) {
        console.error('[Server Vault ERROR] Save character exception:', err);
        res.status(500).json({ error: 'Failed to save character to server vault.' });
    }
});

app.delete('/api/characters/:id', (req, res) => {
    try {
        const authHeader = req.headers.authorization || '';
        const token = authHeader.replace(/^Bearer\s+/i, '').trim();
        const user = accountManager.verifySession(token);
        if (!user) {
            return res.status(401).json({ success: false, error: 'Unauthorized.' });
        }

        const deleted = accountManager.deleteCharacter(user.userId, req.params.id);
        if (!deleted) {
            return res.status(404).json({ success: false, error: 'Character not found or unauthorized.' });
        }

        // If that character's token was on the table, clean it up
        VTTManager.state.tokens = VTTManager.state.tokens.filter(t => t.id !== req.params.id && t.characterId !== req.params.id);
        io.emit('token_deleted', { tokenId: req.params.id, version: VTTManager.stateVersion });
        io.emit('state_update', VTTManager.getGameState());

        res.json({ success: true });
    } catch (err) {
        console.error('[Server Vault ERROR] Delete character exception:', err);
        res.status(500).json({ success: false, error: 'Failed to delete character.' });
    }
});

const server = http.createServer(app);

// ─── Rate Limit Store ──────────────────────────────────────────────────────
const rateLimitStore = new Map();

// ─── Socket.IO Setup ──────────────────────────────────────────────────────
const io = new Server(server, {
  transports: ['websocket', 'polling'],
  perMessageDeflate: {
    threshold: 1024,
    zlibDeflateOptions: { level: 6 },
  },
  cors: {
    origin: (origin, callback) => callback(null, true),
    credentials: true,
    methods: ["GET", "POST"]
  },
  maxHttpBufferSize: VTTManager.getNetworkSettings().maxHttpBufferSize,
  pingTimeout: VTTManager.getNetworkSettings().pingTimeout,
  pingInterval: VTTManager.getNetworkSettings().pingInterval,
});

// ─── Middleware: Rate Limiting ────────────────────────────────────────────
io.use((socket, next) => {
  socket.checkRateLimit = (limit = 30, windowMs = 1000) => {
    const now = Date.now();
    const record = rateLimitStore.get(socket.id) || { count: 0, resetTime: now + windowMs };

    if (now > record.resetTime) {
      record.count = 0;
      record.resetTime = now + windowMs;
    }

    record.count += 1;
    rateLimitStore.set(socket.id, record);

    if (record.count > limit) {
      socket.emit('error_response', { message: 'Rate limit exceeded. Please slow down.' });
      return false;
    }

    return true;
  };

  socket.on('disconnect', () => {
    rateLimitStore.delete(socket.id);
  });

  next();
});

// ─── Validation Helpers ──────────────────────────────────────────────────
const validateFinitePoint = (value) => typeof value === 'number' && Number.isFinite(value);

const validateLightData = (lightData) => {
    if (!lightData || typeof lightData !== 'object') return false;
    return (
        validateFinitePoint(lightData.x) &&
        validateFinitePoint(lightData.y) &&
        validateFinitePoint(lightData.radius) &&
        lightData.radius > 0 &&
        typeof lightData.color === 'string' && /^#[0-9a-f]{6}$/i.test(lightData.color)
    );
};

const validateWallSegment = (segment) => {
    if (!segment || typeof segment !== 'object') return false;
    return ['x1', 'y1', 'x2', 'y2'].every(key =>
        typeof segment[key] === 'number' && Number.isFinite(segment[key])
    );
};

const validateStampData = (stampData) => {
    if (!stampData || typeof stampData !== 'object') return false;
    return (
        typeof stampData.url === 'string' &&
        validateFinitePoint(stampData.x) &&
        validateFinitePoint(stampData.y) &&
        validateFinitePoint(stampData.width) && stampData.width > 0 &&
        validateFinitePoint(stampData.height) && stampData.height > 0
    );
};

// ─── ASSET HELPERS ───
const getTokenFiles = () => {
    const dir = path.join(__dirname, 'assets', 'tokens');
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        return [];
    }
    return fs.readdirSync(dir).filter(f => 
        ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(path.extname(f).toLowerCase())
    );
};

const getSizeMultiplier = (sizeStr) => {
    switch (sizeStr?.toLowerCase()) {
        case 'tiny': return 0.5;
        case 'small': return 0.75;
        case 'medium': return 1;
        case 'large': return 2;
        case 'huge': return 3;
        default: return 1;
    }
};

const getHandoutFiles = () => {
    const dir = path.join(__dirname, 'assets', 'handouts');
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        return [];
    }
    // Added support for video and animated formats as requested
    const allowed = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.mp4', '.webm', '.mov'];
    return fs.readdirSync(dir).filter(f => 
        allowed.includes(path.extname(f).toLowerCase())
    );
};

// ★ NEW: Stamp file scanner
const getStampFiles = () => {
    const dir = path.join(__dirname, 'assets', 'stamps');
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        return [];
    }
    // Support common image formats, standard animated GIFs, and WebM/MP4 videos [1.1.8]
    const allowed = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.webm', '.mp4'];
    return fs.readdirSync(dir).filter(f => 
        allowed.includes(path.extname(f).toLowerCase())
    );
};

const getMaps = () => {
    // Resolve the directory path defensively
    const mapsDir = path.resolve(__dirname, 'assets', 'maps');

    // Production-ready logging for transparency
    console.log(`[VTT-System] Scanning for maps in: ${mapsDir}`);

    try {
        if (!fs.existsSync(mapsDir)) {
            console.error(`[VTT-System ERROR] Maps directory missing: ${mapsDir}`);
            // Create the directory if it's missing, rather than just failing
            fs.mkdirSync(mapsDir, { recursive: true });
            console.log(`[VTT-System] Created missing maps directory.`);
            return [];
        }

        const files = fs.readdirSync(mapsDir);
        const folders = files.filter(file =>
            fs.statSync(path.join(mapsDir, file)).isDirectory()
        );

        // Return objects with name and thumbnail URL
        return folders.map(folder => {
            const mapFile = findMapFile(folder); // existing helper
            return {
                name: folder,
                thumbnail: mapFile || null
            };
        });

    } catch (err) {
        console.error(`[VTT-System ERROR] Error scanning map directory:`, err);
        return [];
    }
};

// Helper to find the actual map image file (supports multiple formats)
const findMapFile = (mapName) => {
    const mapDir = path.resolve(__dirname, 'assets/maps', mapName);
    if (!fs.existsSync(mapDir)) return null;
    
    const files = fs.readdirSync(mapDir);
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

    // Prioritize main map images, then any valid image format
    const found = files.find(f => {
        const ext = path.extname(f).toLowerCase();
        const base = path.parse(f).name.toLowerCase();
        return imageExtensions.includes(ext) && (base === 'map' || base.startsWith('map'));
    }) || files.find(f => {
        const ext = path.extname(f).toLowerCase();
        const base = path.parse(f).name.toLowerCase();
        return imageExtensions.includes(ext) && !base.includes('thumb') && !base.includes('preview');
    }) || files.find(f => imageExtensions.includes(path.extname(f).toLowerCase()));
    
    return found ? `/assets/maps/${encodeURIComponent(mapName)}/${encodeURIComponent(found)}` : null;
};

const getAudioFiles = (folderName) => {
    // Force absolute path starting from server/assets
    const dir = path.join(__dirname, 'assets', folderName);
    
    if (!fs.existsSync(dir)) {
        console.log(`[VTT-System] Creating missing directory: ${dir}`);
        fs.mkdirSync(dir, { recursive: true });
        return [];
    }

    const files = fs.readdirSync(dir);
    
    // ★ CHANGE: Expanded to support high-efficiency modern audio formats (.webm, .aac, .opus)
    const allowedAudio = ['.mp3', '.ogg', '.wav', '.m4a', '.webm', '.aac', '.opus'];
    const audioFiles = files.filter(f => allowedAudio.includes(path.extname(f).toLowerCase()));
    
    console.log(`[VTT-System] Found ${audioFiles.length} files in ${folderName}:`, audioFiles);
    return audioFiles;
};

// ★ NEW: Premade character sheets
const getPremadeFiles = () => {
    const dir = path.join(__dirname, 'assets', 'premades');
    if (!fs.existsSync(dir)) { 
        fs.mkdirSync(dir, { recursive: true }); 
        return []; 
    }
    return fs.readdirSync(dir).filter(f => f.endsWith('.json'));
};

// ─── Inventory Engine Helper ─────────────────────────────────────────────
function applyInventoryOp(charData, op) {
  const { action, itemId, delta, item, pack, pet, petId, currency, quantity } = op;

  switch (action) {
    case 'addItem':
      if (!item) throw new Error('Missing item data');
      charData.inventory.push(item);
      break;

    case 'addPack':
      if (pack && Array.isArray(pack.contents)) {
        pack.contents.forEach(itemName => {
          const existing = charData.inventory.find(i => i.name === itemName);
          if (existing) {
            existing.quantity = (existing.quantity || 1) + 1;
          } else {
            charData.inventory.push({
              id: 'item_' + Date.now() + Math.random().toString(36).substr(2, 5),
              name: itemName,
              type: 'gear',
              weight: 0,
              quantity: 1,
              equipped: false
            });
          }
        });
      }
      break;

    case 'adjustQuantity':
      if (itemId === undefined || delta === undefined) throw new Error('Missing itemId or delta');
      charData.inventory = charData.inventory
        .map(i => (i.id === itemId ? { ...i, quantity: Math.max(0, (i.quantity || 1) + delta) } : i))
        .filter(i => i.quantity > 0);
      break;

    case 'buyItem':
      if (!item) throw new Error('Missing item data');
      charData.inventory.push({
        id: 'item_' + Date.now() + Math.random().toString(36).substr(2, 5),
        name: item.name,
        type: item.itemType || item.type || 'gear',
        weight: item.weight || 0,
        cost: item.cost || item.value || '—',
        quantity: 1,
        equipped: false,
        damage: item.damage || null,
        damage_type: item.damage_type || null,
        rarity: item.rarity || null,
        magic_damage: item.magic_damage || null,
        magic_damage_type: item.magic_damage_type || null,
        properties: item.properties || null,
        ac: item.ac || null,
        dex_bonus: item.dex_bonus || null,
        max_dex_bonus: item.max_dex_bonus || null,
        ac_bonus: item.ac_bonus || null,
        monsterData: item.monsterData || null
      });
      if (currency) Object.assign(charData, currency);
      break;

    case 'sellItem': {
      if (!itemId) throw new Error('Missing itemId');
      const quantitySold = Number(quantity) || 1;
      const itemIndex = charData.inventory.findIndex(i => i.id === itemId);
      if (itemIndex === -1) throw new Error('Item not found in inventory');

      const currentQty = charData.inventory[itemIndex].quantity || 1;
      if (quantitySold >= currentQty) {
        charData.inventory.splice(itemIndex, 1);
      } else {
        charData.inventory[itemIndex].quantity = currentQty - quantitySold;
      }
      if (currency) Object.assign(charData, currency);
      break;
    }

    case 'removeItem':
      if (!itemId) throw new Error('Missing itemId');
      charData.inventory = charData.inventory.filter(i => i.id !== itemId);
      if (currency) Object.assign(charData, currency);
      break;

    case 'toggleEquip':
      if (!itemId) throw new Error('Missing itemId');
      charData.inventory = charData.inventory.map(i => {
        if (i.id === itemId) {
          if (i.type === 'armor' && !i.equipped) {
            charData.inventory.forEach(a => {
              if (a.type === 'armor' && a.id !== itemId) a.equipped = false;
            });
          }
          return { ...i, equipped: !i.equipped };
        }
        return i;
      });
      break;

    case 'addPet':
      if (!pet) throw new Error('Missing pet data');
      charData.pets.push(pet);
      break;

    case 'adjustPetHP':
      if (petId === undefined || delta === undefined) throw new Error('Missing petId or delta');
      charData.pets = charData.pets.map(p =>
        p.id === petId ? { ...p, hpCur: Math.min(p.hpMax, Math.max(0, p.hpCur + delta)) } : p
      );
      break;

    case 'removePet':
      if (!petId) throw new Error('Missing petId');
      charData.pets = charData.pets.filter(p => p.id !== petId);
      break;

    default:
      throw new Error(`Unknown inventory action: ${action}`);
  }
}

// ─── HTTP API Routes ───

app.get('/api/maps', (req, res) => res.json(getMaps()));
app.get('/api/tokens', (req, res) => res.json(getTokenFiles()));
app.get('/api/handouts', (req, res) => res.json(getHandoutFiles()));
app.get('/api/stamps', (req, res) => res.json(getStampFiles()));

// API Route to dynamically find and stream the table-texture media format
app.get('/api/table-texture', (req, res) => {
    const directoryPath = path.join(__dirname, 'assets');
    const fileNameBase = 'table-texture';

    if (!fs.existsSync(directoryPath)) {
        return res.status(404).send('Assets directory not found');
    }

    fs.readdir(directoryPath, (err, files) => {
        if (err) {
            console.error("[Server] Error scanning assets directory:", err);
            return res.status(500).send('Unable to scan directory');
        }

        // Find the first file that matches the base name 'table-texture' (ignoring casing & extension)
        const matchedFile = files.find(file => 
            path.parse(file).name.toLowerCase() === fileNameBase.toLowerCase()
        );

        if (!matchedFile) {
            // Optional fallback if no custom background texture exists in assets
            const fallbackPath = path.join(directoryPath, 'table-texture.jpg');
            if (fs.existsSync(fallbackPath)) {
                return res.sendFile(fallbackPath);
            }
            return res.status(404).send('Table texture asset not found');
        }

        const fullPath = path.join(directoryPath, matchedFile);
        res.sendFile(fullPath);
    });
});

app.get('/api/audio', (req, res) => {
    res.json({
        music: getAudioFiles('music'),
        sfx: getAudioFiles('sfx')
    });
});

app.get('/api/login-background', (req, res) => {
    const loginDir = path.join(__dirname, 'assets', 'login');
    if (!fs.existsSync(loginDir)) {
        return res.json({ url: null });
    }
    const files = fs.readdirSync(loginDir).filter(f =>
        ['.jpg', '.jpeg', '.png', '.webp', '.mp4', '.webm'].includes(path.extname(f).toLowerCase())
    );
    if (files.length > 0) {
        res.json({ url: `/assets/login/${files[0]}` });
    } else {
        res.json({ url: null });
    }
});

app.get('/api/premades', (req, res) => {
    res.json(getPremadeFiles());
});

app.get('/api/premades/:filename', (req, res) => {
    const filePath = path.join(__dirname, 'assets', 'premades', req.params.filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
    try {
        res.json(JSON.parse(fs.readFileSync(filePath, 'utf-8')));
    } catch (err) {
        res.status(500).json({ error: 'Failed to read premade template' });
    }
});

app.get('/api/monsters', (req, res) => {
    const filePath = path.join(__dirname, '..', 'client', 'src', 'data', 'srd_monsters.json');
    if (!fs.existsSync(filePath)) {
        return res.json({ monsters: {} });
    }
    try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        res.json(parsed || { monsters: {} });
    } catch (err) {
        console.error('Error reading monster SRD:', err);
        res.status(500).json({ monsters: {}, error: 'Failed to load monster data' });
    }
});

// GET endpoint to fetch network settings
app.get('/api/network-settings', (req, res) => {
    res.json(VTTManager.getNetworkSettings());
});

// Weather folder scanner for dynamic weather FX support
app.get('/api/weather', (req, res) => {
    const weatherDir = path.join(__dirname, 'assets', 'weather');
    if (!fs.existsSync(weatherDir)) return res.json([]);
    const folders = fs.readdirSync(weatherDir).filter(f => 
        fs.statSync(path.join(weatherDir, f)).isDirectory()
    );
    res.json(folders);
});

app.get('/api/weather-sound/:type', (req, res) => {
    const weatherDir = path.join(__dirname, 'assets', 'weather', req.params.type);
    if (!fs.existsSync(weatherDir)) {
        return res.status(404).send('Weather directory not found');
    }

    try {
        const files = fs.readdirSync(weatherDir);
        const allowedExtensions = ['.mp3', '.ogg', '.wav', '.webm', '.aac', '.opus', '.m4a'];
        
        const matchedSoundFile = files.find(file => {
            const ext = path.extname(file).toLowerCase();
            const name = path.parse(file).name.toLowerCase();
            return name === 'sound' && allowedExtensions.includes(ext);
        });

        if (matchedSoundFile) {
            // Redirect the browser to the exact static asset file
            res.redirect(`/assets/weather/${req.params.type}/${matchedSoundFile}`);
        } else {
            res.status(404).send('No valid sound file found in this weather directory');
        }
    } catch (err) {
        console.error("[Server] Error resolving weather loop:", err);
        res.status(500).send('Error resolving weather loop file');
    }
});

// ─── SPA Client Routing Catch-All ───
// Placed after all API/asset routes so React frontend receives page navigation requests
if (fs.existsSync(clientDistPath)) {
    app.use((req, res, next) => {
        if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/assets')) {
            return res.sendFile(path.join(clientDistPath, 'index.html'));
        }
        next();
    });
}

// ─── WEBSOCKET AUTHENTICATION MIDDLEWARES ───

io.use((socket, next) => {
    const { userId, role, name, characterId, roomCode } = socket.handshake.auth || {};
    // ⭐ Enhanced logging: show characterId
    console.log(`[VTT-System] 🔌 Handshake: userId=${userId}, role=${role || 'Spectator'}, name="${name || 'Unknown'}", characterId=${characterId || 'none'}`);
    
    if (!userId) {
        console.warn(`[VTT-System] ❌ Handshake rejected: Missing userId`);
        return next(new Error('Invalid user ID'));
    }
    
    socket.auth = { 
        userId, 
        role: role || 'Spectator',   // 👈 Spectator fallback
        name: name || 'Guest',
        characterId: characterId || null,
        roomCode: roomCode || ''
    };
    next();
});

io.use((socket, next) => {
    const { roomCode } = socket.handshake.auth || {};
    if (process.env.VTT_ROOM_CODE && roomCode !== process.env.VTT_ROOM_CODE) {
        console.log(`[VTT-System] ❌ Rejected connection: invalid room code.`);
        return next(new Error('Invalid room code'));
    }
    next();
});

// ─── WEBSOCKET CONNECTION LIFECYCLE ───

io.on('connection', (socket) => {
  const { userId, role, name, characterId } = socket.auth;

  if (!userId) {
    socket.disconnect();
    return;
  }

  // ── Connection Registration ──
  // Only registers if role is 'DM' or 'Player'
  if (role === 'DM' || role === 'Player') {
    VTTManager.registerUser(userId, socket.id, role, name, characterId);
    console.log(`[VTT-System] ${name} (${userId}) connected as ${role}${characterId ? ' with charId='+characterId : ''}`);
  } else {
    console.log(`[VTT-System] 👁️ Spectator connected (Socket ID: ${socket.id})`);
  }

  // Send current game state to connecting client
  socket.emit('init_state', VTTManager.getGameState());

  // Broadcast updated connected player roster
  io.emit('player_list_update', Array.from(VTTManager.players.values()));

  // Broadcast player token ONLY if valid player role
  if (role === 'Player') {
    const playerToken = VTTManager.state.tokens.find(
      t => t.id === userId || (t.ownerId === userId && t.type === 'player')
    );
    if (playerToken) {
      io.emit('token_added', { token: playerToken, version: VTTManager.stateVersion });
    }
  }

  // ── LOAD CHARACTER DATA ──
  if (role === 'Player') {
    const existingPlayer = VTTManager.players.get(userId);
    let charData = null;

    if (existingPlayer?.characterData && Object.keys(existingPlayer.characterData).length > 0) {
      charData = existingPlayer.characterData;
      console.log(`[VTT-System] Loaded cached character data for ${userId}`);
    }
    // 2. Try by characterId
    else if (characterId) {
      const vaultChar = accountManager.getCharacter(characterId);
      if (vaultChar?.data) {
        charData = vaultChar.data;
        VTTManager.updatePlayerData(userId, charData);
        console.log(`[VTT-System] Loaded character from vault for ${userId} (charId: ${characterId})`);
      } else {
        console.log(`[VTT-System] ⚠️ Vault lookup failed for characterId: ${characterId}`);
      }
    } else {
      // Fallback: try to find any character for this user
      const userChars = accountManager.getUserCharacters(userId);
      if (userChars && userChars.length > 0) {
        // Use the first one (or the most recent)
        const firstChar = userChars[0];
        charData = firstChar.data;
        // Also update the player's characterId in memory
        VTTManager.registerUser(userId, socket.id, role, name, firstChar.id);
        console.log(`[VTT-System] Fallback: loaded first character "${firstChar.name}" for ${userId}`);
      } else {
        console.log(`[VTT-System] ⚠️ No characters found in vault for ${userId}`);
      }
    }

    if (charData) {
      socket.emit('sync_character_data', charData);
    } else {
      // If still no data, we'll wait for the client to send it via sync_character_data
      console.log(`[VTT-System] No character data found for ${userId}, waiting for sync from client.`);
    }
  }

  // ─── RESYNC ───
  socket.on('request_full_state', () => {
    console.log(`[VTT-System] Full state resync requested by ${name || userId}`);
    socket.emit('init_state', VTTManager.getGameState());
  });

  // ─── Character Sync Engine ───
  socket.on('sync_character_data', (data) => {
    if (!socket.checkRateLimit(30)) return;
    if (!data || typeof data !== 'object' || !data.name) return;

    const authUserId = socket.auth?.userId || userId;
    const activeCharId = socket.auth?.characterId || data?.id || `char_${authUserId}`;

    console.log(`[VTT-System] sync_character_data received for ${authUserId}, charId=${activeCharId}, name="${data.name}"`);

    try {
      // 1. Persist to Disk Vault (survives restarts, resets, and new domains)
      accountManager.saveCharacter(authUserId, activeCharId, data);

      // 2. Persist to Runtime Memory
      VTTManager.updatePlayerData(authUserId, data);

      // 3. Broadcast to Party and Map
      io.emit('player_list_update', Array.from(VTTManager.players.values()));
      io.emit('state_update', VTTManager.getGameState());
      // Also send the character data back to the client (optional, but ensures consistency)
      socket.emit('sync_character_data', data);
    } catch (err) {
      console.error('[Server Sync ERROR] Error saving synced character sheet:', err);
    }
  });

  // ─── Batch Inventory Updates ───
  socket.on('batch_inventory', (payload, callback) => {
    if (!socket.checkRateLimit(30)) return;
    const { characterId: targetCharId, operations } = payload || {};

    if (!Array.isArray(operations) || operations.length === 0 || operations.length > 50) {
      if (typeof callback === 'function') callback({ success: false, error: 'Invalid operations array' });
      return;
    }

    const isDM = VTTManager.isDM(userId);
    const targetId = targetCharId || userId;

    if (!isDM && targetId !== userId) {
      if (typeof callback === 'function') callback({ success: false, error: 'Unauthorized inventory modification' });
      return;
    }

    const player = VTTManager.players.get(targetId);
    if (!player) {
      if (typeof callback === 'function') callback({ success: false, error: 'Player character record not found' });
      return;
    }

    if (!player.characterData) player.characterData = {};
    player.characterData.inventory = player.characterData.inventory || [];
    player.characterData.pets = player.characterData.pets || [];

    try {
      for (const op of operations) {
        applyInventoryOp(player.characterData, op);
      }

      VTTManager.updatePlayerData(targetId, player.characterData);
      accountManager.saveCharacter(targetId, socket.auth?.characterId, player.characterData);

      io.emit('player_list_update', Array.from(VTTManager.players.values()));
      io.emit('state_update', VTTManager.getGameState());

      if (typeof callback === 'function') callback({ success: true });
    } catch (err) {
      console.error('[Server] batch_inventory error:', err);
      if (typeof callback === 'function') callback({ success: false, error: err.message });
    }
  });

  // ─── Single Item Inventory Update ───
  socket.on('update_inventory', (data, callback) => {
    if (!socket.checkRateLimit(30)) return;
    const targetId = data?.characterId || userId;
    const isDM = VTTManager.isDM(userId);

    if (!isDM && targetId !== userId) {
      if (typeof callback === 'function') callback({ success: false, error: 'Unauthorized inventory modification' });
      return;
    }

    const player = VTTManager.players.get(targetId);
    if (!player) {
      if (typeof callback === 'function') callback({ success: false, error: 'Player not found' });
      return;
    }

    if (!player.characterData) player.characterData = {};
    player.characterData.inventory = player.characterData.inventory || [];
    player.characterData.pets = player.characterData.pets || [];

    try {
      applyInventoryOp(player.characterData, data);
      VTTManager.updatePlayerData(targetId, player.characterData);
      accountManager.saveCharacter(targetId, socket.auth?.characterId, player.characterData);

      io.emit('player_list_update', Array.from(VTTManager.players.values()));
      io.emit('state_update', VTTManager.getGameState());
      if (typeof callback === 'function') callback({ success: true });
    } catch (err) {
      console.error('[Server] update_inventory error:', err);
      if (typeof callback === 'function') callback({ success: false, error: err.message });
    }
  });

  // --- CHAT HANDLING ---
  
  // Standard Global Chat
  socket.on('chat_message', (msg) => {
      if (!socket.checkRateLimit(15)) return;
      if (typeof msg !== 'string' || msg.trim().length === 0 || msg.length > 2000) return;
      const entry = VTTManager.addChatMessage(name, msg);
      io.emit('new_chat', entry);
  });

  socket.on('whisper', ({ target, message }) => {
    if (!socket.checkRateLimit(15)) return;
    if (typeof target !== 'string' || typeof message !== 'string' || message.trim().length === 0 || message.length > 2000) return;
    
    const senderName = socket.auth.name;
    const privateMsg = { sender: senderName, message, type: 'whisper', timestamp: Date.now() };

    let targetSocketId = null;

    for (const [, player] of VTTManager.players.entries()) {
        if (player.name.toLowerCase() === target.toLowerCase()) {
            targetSocketId = player.socketId;
            break;
        }
    }

      // Also check if the DM is the target
      if (!targetSocketId && VTTManager.dm && VTTManager.dm.name.toLowerCase() === target.toLowerCase()) {
          targetSocketId = VTTManager.dm.socketId;
      }

      if (targetSocketId) {
          // Send to target
          io.to(targetSocketId).emit('new_chat', privateMsg);
          // Echo back to sender so they can see what they whispered
          socket.emit('new_chat', { ...privateMsg, sender: `To ${target}` });
      } else {
          // Error message back to sender if target isn't found
          socket.emit('new_chat', { sender: 'System', message: `Player '${target}' not found.`, type: 'global' });
      }
  });

  // Party Chat (Everyone EXCEPT the DM)
  socket.on('party_chat', (message) => {
      if (!socket.checkRateLimit(15)) return;
      if (typeof message !== 'string' || message.trim().length === 0 || message.length > 2000) return;
      if (VTTManager.isDM(userId)) return;

      const senderName = socket.auth.name;
      const partyMsg = { sender: senderName, message, type: 'party', timestamp: Date.now() };

      for (const [, player] of VTTManager.players.entries()) {
          if (player.socketId) io.to(player.socketId).emit('new_chat', partyMsg);
      }
  });

  // ─── Weather & Ambient Light ───
  socket.on('change_weather', ({ type, volume, isPlaying, lightningEnabled }) => {
      if (!VTTManager.isDM(userId)) return;
      VTTManager.setWeather(type, volume, isPlaying, lightningEnabled);
      VTTManager.incrementStateVersion();
      
      const weatherData = VTTManager.state.weather;
      io.emit('weather_updated', { weather: weatherData, version: VTTManager.stateVersion });
      io.emit('state_update', VTTManager.getGameState());
  });

  socket.on('change_day_night', (data) => {
      if (!VTTManager.isDM(userId)) return;
      VTTManager.setDayNight(data);
      VTTManager.incrementStateVersion();

      const dayNightData = VTTManager.state.dayNight;
      io.emit('day_night_updated', { dayNight: dayNightData, version: VTTManager.stateVersion });
      io.emit('state_update', VTTManager.getGameState());
  });

  // ── Discord Webhook ──
  socket.on('update_discord_webhook', (url) => {
      if (!VTTManager.isDM(userId)) return;
      VTTManager.setDiscordWebhook(url);
      io.emit('state_update', VTTManager.getGameState());
  });

  socket.on('test_discord_webhook', () => {
      if (!VTTManager.isDM(userId)) return;
      VTTManager.sendDiscordMessage('VTT System', '🎲 **VTT Webhook Test:** Connected successfully to Discord!');
  });

  // --- PING HANDLING ---
  socket.on('place_ping', (data) => {
      if (!socket.checkRateLimit(10)) return;
      if (!data || !validateFinitePoint(data.x) || !validateFinitePoint(data.y)) return;
      const pingId = Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      io.emit('place_ping', {
            ...data,
          id: pingId
      });
  });

  // --- Spell FX Broadcasting ---
  socket.on('cast_fx', (data) => {
      if (!socket.checkRateLimit(15)) return;
      if (!data || typeof data !== 'object') return;
      const { shape, style, startX, startY, endX, endY } = data;
      if (!shape || !style ||
          !validateFinitePoint(startX) || !validateFinitePoint(startY) ||
          !validateFinitePoint(endX) || !validateFinitePoint(endY) ||
          Number(startX) < -50000 || Number(startY) < -50000 || Number(endX) > 50000 || Number(endY) > 50000) {
          return;
      }
      socket.broadcast.emit('cast_fx', { shape, style, startX, startY, endX, endY });
  });

  // --- TOKEN HANDLING ---
  socket.on('move_token', ({ tokenId, x, y }) => {
      if (!socket.checkRateLimit(60)) return;
      const token = VTTManager.state.tokens.find(t => t.id === tokenId);
      if (!token) return;

      if (VTTManager.isDM(userId) || token.ownerId === userId) {
          socket.broadcast.emit('token_moved', { tokenId, x, y, version: VTTManager.stateVersion });
      }
  });

  socket.on('move_token_final', ({ tokenId, x, y }) => {
      if (!socket.checkRateLimit(20)) return;
      if (typeof tokenId !== 'string' || !validateFinitePoint(Number(x)) || !validateFinitePoint(Number(y))) {
          return socket.emit('error_response', { message: 'Invalid token move coordinates.' });
      }

      const token = VTTManager.state.tokens.find(t => t.id === tokenId);
      if (!token) return;

      if (VTTManager.isDM(userId) || token.ownerId === userId) {
          const moved = VTTManager.moveToken(tokenId, Number(x), Number(y), userId);
          if (!moved) {
              return socket.emit('error_response', { message: 'Unable to place that token.' });
          }
          VTTManager.incrementStateVersion();

          io.emit('token_final_position', {
              tokenId,
              token,
              x: token.x,
              y: token.y,
              isPlaced: true,
              version: VTTManager.stateVersion
          });
      }
  });

  // ─── NPC Spawning & Removal ───
  socket.on('add_npc', ({ name: npcName, avatarUrl, hp, ac, monsterData }) => {
      if (!VTTManager.isDM(userId)) return;
      const sizeMultiplier = getSizeMultiplier(monsterData?.size);
      const newToken = VTTManager.addNPCToken(npcName, avatarUrl, hp, ac, monsterData || null, sizeMultiplier);

      if (newToken) {
          VTTManager.incrementStateVersion();
          io.emit('npc_added', { token: newToken, version: VTTManager.stateVersion });
      }
  });

  socket.on('add_npcs', ({ creatures }) => {
      if (!socket.checkRateLimit(10)) return;
      if (!Array.isArray(creatures) || creatures.length === 0 || creatures.length > 50) {
          return socket.emit('error_response', { message: 'Invalid NPC batch payload.' });
      }
      if (VTTManager.isDM(userId)) {
          const tokens = VTTManager.addNPCTokenBatch(creatures);
          if (tokens.length) {
              VTTManager.incrementStateVersion();
              io.emit('npc_batch_added', { tokens, version: VTTManager.stateVersion });
          }
      }
  });

  // ── Token Removal ──
  socket.on('remove_token', (tokenId) => {
      if (!socket.checkRateLimit(20)) return;
      const token = VTTManager.state.tokens.find(t => t.id === tokenId);
      if (!token) return;
      
      if (VTTManager.isDM(userId) || (token.ownerId === userId && token.type === 'npc')) {
          VTTManager.removeToken(tokenId);
          VTTManager.incrementStateVersion();
          // ⭐️ Emits token_removed (unplaced = true, isPlaced = false)
          io.emit('token_removed', { tokenId, version: VTTManager.stateVersion });
      }
  });

  // PURGE: Deletes NPC from the system entirely
  socket.on('delete_token', (tokenId) => {
      if (VTTManager.isDM(userId)) {
          VTTManager.deleteToken(tokenId); 
          VTTManager.incrementStateVersion();
          io.emit('token_deleted', { tokenId, version: VTTManager.stateVersion });
      }
  });

  socket.on('delete_tokens', ({ tokenIds }) => {
      if (!socket.checkRateLimit(10)) return;
      if (!Array.isArray(tokenIds) || tokenIds.length === 0 || tokenIds.length > 100) {
          return socket.emit('error_response', { message: 'Invalid token batch size.' });
      }
      if (VTTManager.isDM(userId)) {
          const deletedCount = VTTManager.deleteTokenBatch(tokenIds);
          if (deletedCount > 0) {
              VTTManager.incrementStateVersion();
              io.emit('tokens_deleted', { tokenIds, version: VTTManager.stateVersion });
          }
      }
  });

  // ── Token Size & Avatar ──
  socket.on('set_token_size', ({ tokenId, size }) => {
      if (!VTTManager.isDM(userId)) return;
      const token = VTTManager.state.tokens.find(t => t.id === tokenId);
      if (token && Number.isFinite(size) && size > 0) {
          token.size = size;
          VTTManager.incrementStateVersion();
          io.emit('token_size_updated', { tokenId, size, version: VTTManager.stateVersion });
      }
  });

  socket.on('update_token_avatar', ({ tokenId, avatarUrl }) => {
      if (!VTTManager.isDM(userId)) return;
      const token = VTTManager.state.tokens.find(t => t.id === tokenId);
      if (token && typeof avatarUrl === 'string') {
          token.avatarUrl = avatarUrl;
          VTTManager.incrementStateVersion();
          VTTManager.saveMapData();
          io.emit('token_avatar_updated', { tokenId, avatarUrl, version: VTTManager.stateVersion });
      }
  });

  // CONDITION HANDLING
  socket.on('toggle_condition', ({ tokenId, condition }) => {
      if (VTTManager.isDM(userId)) {
          VTTManager.toggleCondition(tokenId, condition);
          io.emit('condition_toggled', { tokenId, condition, version: VTTManager.stateVersion });
      }
  });

  socket.on('clear_conditions', ({ tokenId }) => {
      if (VTTManager.isDM(userId)) {
          VTTManager.clearConditions(tokenId);
          io.emit('conditions_cleared', { tokenId, version: VTTManager.stateVersion });
      }
  });

  // --- HP ADJUSTMENT WITH AUTOMATION ---
  socket.on('update_token_hp', ({ tokenId, amount, isHeal, senderName }) => {
      if (!socket.checkRateLimit(20)) return;

      const token = VTTManager.state.tokens.find(t => t.id === tokenId);
      if (!token) return;

      if (!VTTManager.isDM(userId) && token.ownerId !== userId) {
          return socket.emit('error_response', { message: 'You can only modify your own token HP.' });
      }

      if (typeof tokenId !== 'string' || !Number.isFinite(Number(amount)) || Number(amount) <= 0 || Number(amount) > 9999 || typeof isHeal !== 'boolean') {
          return socket.emit('error_response', { message: 'Invalid HP adjustment payload.' });
      }

      const result = VTTManager.adjustTokenHP(tokenId, Number(amount), isHeal);
      if (result) {
          const { token: updatedToken, oldHp, newHp, wasDowned } = result;
          const action = isHeal ? 'healed' : 'damaged';
          const change = Math.abs(Number(amount));
          const detailedMsg = `${senderName || 'Someone'} ${action} ${updatedToken.name} for ${change} HP (${oldHp} → ${newHp})`;
          
          // Store metadata so non-DM clients can show a simplified version
          const entry = VTTManager.addChatMessage(senderName || 'System', detailedMsg, {
              type: 'hp_update',
              tokenType: updatedToken.type,
              tokenName: updatedToken.name,
              oldHp,
              newHp,
              change,
              isHeal
          });
          
          io.emit('new_chat', entry);

          // Instant death / death save failures when damaged at 0 HP
          if (!isHeal && amount > 0 && oldHp === 0) {
              const maxHp = updatedToken.hpMax || 10;
              
              if (amount >= maxHp) {
                  updatedToken.isDead = true;
                  updatedToken.hpCur = 0;
                  if (!updatedToken.conditions) updatedToken.conditions = [];
                  if (!updatedToken.conditions.includes('Dead')) updatedToken.conditions.push('Dead');
                  
                  const instantMsg = `⚠️ **Instant Death!** ${updatedToken.name} took ${amount} damage while at 0 HP, which equals or exceeds their Max HP (${maxHp})!`;
                  io.emit('new_chat', VTTManager.addChatMessage('System', instantMsg));
              } else {
                  updatedToken.deathSaveFailures = (updatedToken.deathSaveFailures || 0) + 1;
                  const wounds = updatedToken.wounds ? updatedToken.wounds.length : (updatedToken.woundCount || 0);
                  const totalFailures = updatedToken.deathSaveFailures + wounds;
                  
                  let damageMsg = `⚠️ ${updatedToken.name} takes ${amount} damage while at 0 HP! Suffering **1 death save failure** (Failures: ${updatedToken.deathSaveFailures}/3).`;
                  
                  if (totalFailures >= 3) {
                      updatedToken.isDead = true;
                      if (!updatedToken.conditions) updatedToken.conditions = [];
                      if (!updatedToken.conditions.includes('Dead')) updatedToken.conditions.push('Dead');
                      damageMsg += ` — 💀 **DEAD** (Total failures + wounds reached ${totalFailures})`;
                  }
                  
                  io.emit('new_chat', VTTManager.addChatMessage('System', damageMsg));
              }

              if (updatedToken.type === 'player') {
                  const player = VTTManager.players.get(tokenId);
                  if (player && player.characterData) {
                      player.characterData.deathSaveFailures = updatedToken.deathSaveFailures;
                      player.characterData.isDead = updatedToken.isDead;
                      player.characterData.hpCur = updatedToken.hpCur;
                      VTTManager.updatePlayerData(tokenId, player.characterData);
                      accountManager.saveCharacter(tokenId, socket.auth?.characterId, player.characterData);
                      if (player.socketId) io.to(player.socketId).emit('sync_character_data', player.characterData);
                  }
              }
          }

          // If healed above 0, reset death save progress entirely
          if (isHeal && oldHp === 0 && newHp > 0) {
              VTTManager.resetDeathSaves(tokenId);
              updatedToken.isStable = false;
              updatedToken.isDead = false;
              if (updatedToken.conditions) {
                  updatedToken.conditions = updatedToken.conditions.filter(c => c !== 'Dead');
              }
          }

          if (updatedToken.type === 'player') {
              const player = VTTManager.players.get(tokenId);
              if (player && player.characterData) {
                  const updatedData = { 
                      ...player.characterData, 
                      hpCur: updatedToken.hpCur,
                      timesDowned: updatedToken.timesDowned || 0,
                      deathSaveSuccesses: updatedToken.deathSaveSuccesses || 0,
                      deathSaveFailures: updatedToken.deathSaveFailures || 0,
                      isStable: updatedToken.isStable || false,
                      isDead: updatedToken.isDead || false
                  };
                  VTTManager.updatePlayerData(tokenId, updatedData);
                  accountManager.saveCharacter(tokenId, socket.auth?.characterId, updatedData);
                  if (player.socketId) io.to(player.socketId).emit('sync_character_data', updatedData);
              }
          }

          // System Shock Check (Massive or Critical Damage)
          if (!isHeal && amount > 0) {
              const maxHp = updatedToken.hpMax || 10;
              const isMassive = amount >= maxHp / 2;
              const isCritical = amount >= maxHp;
              if (isMassive || isCritical) {
                  let targetSocketId = null;
                  if (updatedToken.type === 'player') {
                      const player = VTTManager.players.get(tokenId);
                      if (player) targetSocketId = player.socketId;
                  } else if (VTTManager.dm) {
                      targetSocketId = VTTManager.dm.socketId;
                  }
                  if (targetSocketId) {
                      io.to(targetSocketId).emit('system_shock_trigger', {
                          tokenId: updatedToken.id,
                          tokenName: updatedToken.name,
                          type: 'massive',
                          isMassive,
                          isCritical,
                          damage: amount,
                          maxHp,
                          hpCur: updatedToken.hpCur,
                          hasCharacterSheet: updatedToken.type === 'player'
                      });
                  }
              }

              // Excessive Damage (times downed) Check
              if (wasDowned) {
                  updatedToken.timesDowned = (updatedToken.timesDowned || 0) + 1;
                  
                  if (updatedToken.type === 'player') {
                      const player = VTTManager.players.get(tokenId);
                      if (player && player.characterData) {
                          player.characterData.timesDowned = updatedToken.timesDowned;
                          VTTManager.updatePlayerData(tokenId, player.characterData);
                          accountManager.saveCharacter(tokenId, socket.auth?.characterId, player.characterData);
                          if (player.socketId) io.to(player.socketId).emit('sync_character_data', player.characterData);
                      }
                  }

                  if (updatedToken.timesDowned >= 3) {
                      const excessiveDc = 15 + (updatedToken.timesDowned - 3) * 3;
                      let targetSocketId = null;
                      if (updatedToken.type === 'player') {
                          const player = VTTManager.players.get(tokenId);
                          if (player) targetSocketId = player.socketId;
                      } else if (VTTManager.dm) {
                          targetSocketId = VTTManager.dm.socketId;
                      }
                      if (targetSocketId) {
                          io.to(targetSocketId).emit('system_shock_trigger', {
                              tokenId: updatedToken.id,
                              tokenName: updatedToken.name,
                              type: 'excessive',
                              excessiveDc,
                              isMassive: false,
                              isCritical: false,
                              hpCur: updatedToken.hpCur,
                              hasCharacterSheet: updatedToken.type === 'player'
                          });
                      }
                  }
              }
          }

          io.emit('player_list_update', Array.from(VTTManager.players.values()));
          VTTManager.incrementStateVersion();
          
          // Emit only the lightweight HP changed event to all players
          io.emit('token_hp_changed', { 
              tokenId, 
              hpCur: updatedToken.hpCur, 
              version: VTTManager.stateVersion 
          });
      }
  });

  // ─── Death Saves ───
  socket.on('death_save_roll', ({ tokenId, roll, success }) => {
      const token = VTTManager.state.tokens.find(t => t.id === tokenId);
      if (!token) return;

      const isOwner = token.ownerId === userId;
      if (!VTTManager.isDM(userId) && !isOwner) return;

      const result = VTTManager.handleDeathSave(tokenId, success, roll);
      if (result) {
          const successes = token.deathSaveSuccesses || 0;
          const failures = token.deathSaveFailures || 0;
          const wounds = token.wounds ? token.wounds.length : (token.woundCount || 0);
          const totalFailures = failures + wounds;

          let entryMessage = "";
          if (roll === 20) {
              entryMessage = `🌟 **Critical Success!** ${token.name} rolled a natural 20 on their Death Save! They immediately regain 1 HP and stand back up!`;
          } else if (roll === 1) {
              entryMessage = `💀 **Critical Failure!** ${token.name} rolled a natural 1 on their Death Save! Suffering **2 failures** (Failures: ${failures}/3, Wounds: ${wounds}).`;
          } else {
              entryMessage = `${token.name} rolled a Death Save: **${success ? 'SUCCESS' : 'FAILURE'}** (Roll: ${roll}, Successes: ${successes}/3, Failures: ${failures}/3, Wounds: ${wounds})`;
          }

          if (result.dead) {
              entryMessage += ` — 💀 **DEAD** (Total failures + wounds reached ${totalFailures})`;
              if (!token.conditions) token.conditions = [];
              if (!token.conditions.includes('Dead')) token.conditions.push('Dead');
          } else if (token.isStable) {
              entryMessage += ` — 💖 **STABLE** (Reached 3 successes)`;
          }

          io.emit('new_chat', VTTManager.addChatMessage('System', entryMessage));

          if (token.type === 'player') {
              const player = VTTManager.players.get(tokenId);
              if (player && player.characterData) {
                  player.characterData.deathSaveSuccesses = successes;
                  player.characterData.deathSaveFailures = failures;
                  player.characterData.isStable = token.isStable;
                  player.characterData.isDead = token.isDead;
                  player.characterData.hpCur = token.hpCur; // Will sync 1 HP on success/rebound or 0 on death
                  VTTManager.updatePlayerData(tokenId, player.characterData);
                  accountManager.saveCharacter(tokenId, socket.auth?.characterId, player.characterData);
                  if (player.socketId) io.to(player.socketId).emit('sync_character_data', player.characterData);
              }
          }

          io.emit('player_list_update', Array.from(VTTManager.players.values()));
          VTTManager.incrementStateVersion();
          io.emit('token_hp_changed', { tokenId, hpCur: token.hpCur, version: VTTManager.stateVersion });
      }
  });

  // --- SHORT & LONG REST EXECUTION ---
  socket.on('take_rest', ({ tokenId, type }) => {
      if (!tokenId || typeof tokenId !== 'string') return;
      if (type !== 'short' && type !== 'long') return;

      const token = VTTManager.state.tokens.find(t => t.id === tokenId);
      if (!token) return;

      if (!VTTManager.isDM(userId) && token.ownerId !== userId) return;

      const success = VTTManager.resetTimesDowned(tokenId);
      if (success) {
          if (token.type === 'player') {
              const player = VTTManager.players.get(tokenId);
              if (player && player.characterData) {
                  player.characterData.timesDowned = 0;
                  player.characterData.deathSaveSuccesses = 0;
                  player.characterData.deathSaveFailures = 0;
                  player.characterData.isStable = false;
                  player.characterData.isDead = false;
                  
                  // --- Server-side Authoritative Hit Dice Recovery Safeguard ---
                  if (type === 'long') {
                      const totalHD = parseInt(player.characterData.lvl) || 1;
                      const spentHD = parseInt(player.characterData.hitDiceSpent || 0);
                      const regainAmount = Math.max(1, Math.floor(totalHD / 2));
                      player.characterData.hitDiceSpent = Math.max(0, spentHD - regainAmount);
                  }
                  
                  VTTManager.updatePlayerData(tokenId, player.characterData);
                  accountManager.saveCharacter(tokenId, socket.auth?.characterId, player.characterData);
                  if (player.socketId) io.to(player.socketId).emit('sync_character_data', player.characterData);
              }
          }

          token.deathSaveSuccesses = 0;
          token.deathSaveFailures = 0;
          token.isStable = false;
          token.isDead = false;
          if (token.conditions) {
              token.conditions = token.conditions.filter(c => c !== 'Dead');
          }

          VTTManager.incrementStateVersion();

          if (type === 'long') {
              token.hpCur = token.hpMax;
              if (token.type === 'player') {
                  const player = VTTManager.players.get(tokenId);
                  if (player && player.characterData) {
                      player.characterData.hpCur = token.hpMax;
                      VTTManager.updatePlayerData(tokenId, player.characterData);
                      accountManager.saveCharacter(tokenId, socket.auth?.characterId, player.characterData);
                      if (player.socketId) io.to(player.socketId).emit('sync_character_data', player.characterData);
                  }
              }
              io.emit('token_hp_changed', { tokenId, hpCur: token.hpMax, version: VTTManager.stateVersion });
          }

          const restName = type === 'long' ? 'Long Rest' : 'Short Rest';
          VTTManager.sendDiscordMessage('VTT System', `🏕️ **${token.name}** finished a **${restName}**.`);

          io.emit('player_list_update', Array.from(VTTManager.players.values()));
      }
  });

  // DM requests to view a player's character sheet
  socket.on('request_character_sheet', (targetUserId) => {
      if (!VTTManager.isDM(userId)) return;
      const player = VTTManager.players.get(targetUserId);
      if (player && player.characterData) {
          socket.emit('character_sheet_data', {
              targetUserId,
              data: player.characterData
          });
      } else {
          socket.emit('character_sheet_data', {
              targetUserId,
              data: null,
              error: 'No character data found for this player.'
          });
      }
  });

  socket.on('save_player_sheet', ({ targetUserId, data }) => {
      if (!VTTManager.isDM(userId)) return;
      const player = VTTManager.players.get(targetUserId);
      if (!player) return;

      VTTManager.updatePlayerData(targetUserId, data);
      accountManager.saveCharacter(targetUserId, null, data);

      if (player.socketId) io.to(player.socketId).emit('sync_character_data', data);
      io.emit('player_list_update', Array.from(VTTManager.players.values()));
      io.emit('state_update', VTTManager.getGameState());
  });

  // ── Handouts ──
  socket.on('push_handout', (url) => {
    if (VTTManager.isDM(userId)) {
        console.log(`[VTT-System] Handout pushed: ${url}`);
        io.emit('show_handout', url);
    }
  });

  socket.on('clear_handout', () => {
    if (VTTManager.isDM(userId)) {
        io.emit('hide_handout');
    }
  });

  // --- MAP & WALL HANDLING ---
  socket.on('add_walls', (wallsArray) => {
      if (!socket.checkRateLimit(20)) return;
      if (!Array.isArray(wallsArray) || wallsArray.length === 0 || wallsArray.length > 100) {
          return socket.emit('error_response', { message: 'Invalid wall batch.' });
      }
      if (VTTManager.isDM(userId)) {
          const validWalls = wallsArray.filter(validateWallSegment);
          if (validWalls.length !== wallsArray.length) {
              return socket.emit('error_response', { message: 'One or more wall segments are invalid.' });
          }
          VTTManager.addWalls(validWalls);
          VTTManager.incrementStateVersion();
          validWalls.forEach(wall => {
              io.emit('wall_added', { wall, version: VTTManager.stateVersion });
          });
      }
  });

  // EXACT WALL ERASURE
  socket.on('erase_wall', (wallId) => {
      if (VTTManager.isDM(userId)) {
          VTTManager.removeWallById(wallId);
          VTTManager.incrementStateVersion();
          io.emit('wall_erased', { wallId, version: VTTManager.stateVersion });
      }
  });

  // --- LIGHT HANDLING ---
  socket.on('add_light', (lightData) => {
      if (!socket.checkRateLimit(20)) return;
      if (!validateLightData(lightData)) {
          return socket.emit('error_response', { message: 'Invalid light payload.' });
      }
      if (VTTManager.isDM(userId)) {
          const newLight = VTTManager.addLight(lightData);
          VTTManager.incrementStateVersion();
          io.emit('light_added', { light: newLight, version: VTTManager.stateVersion });
      }
  });

  socket.on('erase_light', (lightId) => {
      if (VTTManager.isDM(userId)) {
          VTTManager.removeLight(lightId);
          VTTManager.incrementStateVersion();
          io.emit('light_erased', { lightId, version: VTTManager.stateVersion });
      }
  });

  // --- STAMP HANDLING ---
  socket.on('add_stamp', (stampData) => {
      if (!VTTManager.isDM(userId)) return;
      if (!validateStampData(stampData)) {
          return socket.emit('error_response', { message: 'Invalid stamp payload.' });
      }
      const newStamp = VTTManager.addStamp(stampData);
      VTTManager.incrementStateVersion();
      io.emit('stamp_added', { stamp: newStamp, version: VTTManager.stateVersion });
  });

  socket.on('erase_stamp', (stampId) => {
      if (VTTManager.isDM(userId)) {
          VTTManager.removeStamp(stampId);
          VTTManager.incrementStateVersion();
          io.emit('stamp_erased', { stampId, version: VTTManager.stateVersion });
      }
  });

  // --- SHAPE HANDLING ---
  socket.on('add_shape', (shapeData) => {
      if (!shapeData || typeof shapeData !== 'object') return;
      const { type, x, y } = shapeData;
      if (!type || typeof x !== 'number' || typeof y !== 'number') return;
      
      const shape = VTTManager.addShape({ ...shapeData, ownerId: userId });
      if (shape) {
          VTTManager.incrementStateVersion();
          io.emit('shape_added', { shape, version: VTTManager.stateVersion });
      } else {
          // Push a system limit notification back to the client
          socket.emit('new_chat', {
              sender: 'System',
              message: 'Shape limit reached! You are allowed a maximum of 3 shapes. Please delete an existing shape to draw more.',
              type: 'global',
              timestamp: Date.now()
          });
      }
  });

  socket.on('remove_shape', (shapeId) => {
      if (typeof shapeId !== 'string') return;
      const success = VTTManager.removeShape(shapeId, userId);
      if (success) {
          VTTManager.incrementStateVersion();
          io.emit('shape_removed', { shapeId, version: VTTManager.stateVersion });
      }
  });

  socket.on('clear_my_shapes', () => {
      VTTManager.clearUserShapes(userId);
      VTTManager.incrementStateVersion();
      io.emit('shapes_cleared', { userId, version: VTTManager.stateVersion });
  });

  socket.on('move_shape', ({ shapeId, x, y, endX, endY }) => {
      socket.broadcast.emit('shape_moved', { shapeId, x, y, endX, endY });
  });

  socket.on('move_shape_final', ({ shapeId, x, y, endX, endY }) => {
      if (typeof VTTManager.updateShapePosition === 'function') {
          const success = VTTManager.updateShapePosition(shapeId, x, y, endX, endY, userId);
          if (success) {
              VTTManager.incrementStateVersion();
              io.emit('shape_moved_final', { shapeId, x, y, endX, endY, version: VTTManager.stateVersion });
          }
      }
  });

  // --- NOTE HANDLING ---
  socket.on('add_note', ({ x, y, text }) => {
      if (VTTManager.isDM(userId)) {
          if (!validateFinitePoint(x) || !validateFinitePoint(y) || typeof text !== 'string') return;
          VTTManager.addNote(text || '', x, y);
          VTTManager.incrementStateVersion();
          const note = VTTManager.state.notes[VTTManager.state.notes.length - 1];
          io.emit('note_added', { note, version: VTTManager.stateVersion });
      }
  });

  socket.on('update_note', ({ noteId, text, collapsed }) => {
      if (typeof text !== 'string' || text.length > 5000) return;
      if (VTTManager.isDM(userId)) {
          VTTManager.updateNote(noteId, { text, collapsed });
          VTTManager.incrementStateVersion();
          io.emit('note_updated', { noteId, text, collapsed, version: VTTManager.stateVersion });
      }
  });

  socket.on('erase_note', (noteId) => {
      if (VTTManager.isDM(userId)) {
          VTTManager.removeNote(noteId);
          VTTManager.incrementStateVersion();
          io.emit('note_erased', { noteId, version: VTTManager.stateVersion });
      }
  });

  // --- MAP HANDLING ---
  socket.on('change_map', (payload) => {
      if (!VTTManager.isDM(userId)) {
          socket.emit('error', 'DM permissions required.');
          return;
      }

      // Safely extract the map name if an object or string was sent
      const mapName = typeof payload === 'string' ? payload : (payload?.name || payload?.mapName || null);

      if (!mapName) {
          return socket.emit('error', 'Invalid map payload.');
      }

      const mapPath = findMapFile(mapName);
      if (mapPath) {
          VTTManager.setMap(mapName, mapPath);
          const gameState = VTTManager.getGameState();

          // Broadcast both the explicit map_changed event and full state_update
          io.emit('map_changed', { 
              mapName, 
              mapUrl: mapPath, 
              currentMapFolder: mapName,
              version: VTTManager.stateVersion,
              state: gameState 
          });
          io.emit('state_update', gameState); 
          VTTManager.sendDiscordMessage('VTT System', `🗺️ **Map Changed:** Loaded scene **${mapName}**`);
      } else {
          socket.emit('error', `No valid image file found for scene: ${mapName}`);
      }
  });

  // ─── Audio Controls ───
  socket.on('audio_music_update', (data) => {
      if (VTTManager.isDM(userId)) {
          VTTManager.setMusic(data.track, data.volume, data.isPlaying);
          VTTManager.incrementStateVersion();
          
          io.emit('music_updated', { 
              music: { track: data.track, volume: data.volume, isPlaying: data.isPlaying },
              version: VTTManager.stateVersion 
          });
          io.emit('state_update', VTTManager.getGameState());
      }
  });

  socket.on('audio_play_sfx', (data) => {
      if (VTTManager.isDM(userId)) {
          // SFX are transient, broadcast directly to all clients
          io.emit('trigger_sfx', data); 
      }
  });

  socket.on('audio_stop_sfx', () => {
      if (VTTManager.isDM(userId)) {
          io.emit('stop_all_sfx');
      }
  });

  // --- INITIATIVE & COMBAT HANDLING WITH AUTOMATION START HOOKS ---

  socket.on('request_initiative', (tokenIds) => {
        if (!VTTManager.isDM(userId)) return;
        if (!Array.isArray(tokenIds)) return;

      tokenIds.forEach(tid => {
          const token = VTTManager.state.tokens.find(t => t.id === tid);
          if (!token || token.type !== 'player') return;
          
          const targetUserId = token.ownerId || token.id;
          const player = VTTManager.players.get(targetUserId);
          if (player && player.socketId) {
              io.to(player.socketId).emit('initiative_prompt', { tokenId: tid });
          }
      });
  });

  socket.on('submit_initiative', ({ tokenId, roll, bonus }) => {
        const token = VTTManager.state.tokens.find(t => t.id === tokenId);
        if (!token) return;

        const initiative = (Number(roll) || 0) + (Number(bonus) || 0);
        
        let combatant = VTTManager.initiativeList.find(c => c.id === tokenId);
        if (!combatant) {
            combatant = { id: tokenId, name: token.name, initiative, type: token.type };
            VTTManager.initiativeList.push(combatant);
        } else {
            combatant.initiative = initiative;
        }

        VTTManager.state.initiative = [...VTTManager.initiativeList];
        VTTManager.incrementStateVersion();
        
        // Broadcast immediately to update all initiative bars
        io.emit('initiative_update', { initiative: VTTManager.initiativeList, version: VTTManager.stateVersion });
        io.emit('state_update', VTTManager.getGameState());
    });

  socket.on('add_npc_initiative', ({ tokenId, initiative }) => {
        if (!VTTManager.isDM(userId)) return;
        const token = VTTManager.state.tokens.find(t => t.id === tokenId);
        if (!token) return;

        let combatant = VTTManager.initiativeList.find(c => c.id === tokenId);
        if (!combatant) {
            combatant = { id: tokenId, name: token.name, initiative: Number(initiative) || 0, type: token.type };
            VTTManager.initiativeList.push(combatant);
        } else {
            combatant.initiative = Number(initiative) || 0;
        }
        
        VTTManager.state.initiative = [...VTTManager.initiativeList];
        VTTManager.incrementStateVersion();
        
        io.emit('initiative_update', { initiative: VTTManager.initiativeList, version: VTTManager.stateVersion });
        io.emit('state_update', VTTManager.getGameState());
    });

  // DM starts combat – orders the list and sets the first turn
  socket.on('start_combat', () => {
      if (!VTTManager.isDM(userId)) return;
      VTTManager.setInitiativeOrder(VTTManager.initiativeList);
      VTTManager.incrementStateVersion();
      io.emit('combat_started', { 
          initiative: VTTManager.state.initiative, 
          current: VTTManager.state.currentTurn,
          version: VTTManager.stateVersion 
      });

      // Trigger automatic turn_started check for the active participant
      const currentTokenId = VTTManager.state.currentTurn;
      if (currentTokenId) {
          io.emit('turn_started', { tokenId: currentTokenId });
      }

      VTTManager.sendDiscordMessage('VTT System', `⚔️ **Combat Encounter Started!**`);
  });

  // DM advances turn
  socket.on('next_turn', () => {
      if (!VTTManager.isDM(userId)) return;
      VTTManager.advanceTurn();
      VTTManager.incrementStateVersion();
      io.emit('turn_update', { current: VTTManager.state.currentTurn, version: VTTManager.stateVersion });

      // Trigger automatic turn_started check for the new active participant
      const currentTokenId = VTTManager.state.currentTurn;
      if (currentTokenId) {
          io.emit('turn_started', { tokenId: currentTokenId });
      }
  });

  // DM sets precise combat turn
  socket.on('set_turn', (tokenId) => {
      if (!VTTManager.isDM(userId)) return;
      const index = VTTManager.initiativeList.findIndex(c => c.id === tokenId);
      if (index !== -1) {
          VTTManager.currentTurnIndex = index;
          VTTManager.state.currentTurn = tokenId;
          VTTManager.incrementStateVersion();
          io.emit('turn_update', { current: VTTManager.state.currentTurn, version: VTTManager.stateVersion });
          io.emit('turn_started', { tokenId });
      }
  });

  // Reset combat (clears initiative)
  socket.on('reset_combat', () => {
      if (!VTTManager.isDM(userId)) return;
      VTTManager.resetInitiative();
      VTTManager.incrementStateVersion();
      io.emit('combat_reset', { version: VTTManager.stateVersion });
      VTTManager.sendDiscordMessage('VTT System', `🏳️ **Combat Encounter Ended.**`);
  });

  // DM requests skill check
  socket.on('request_check', ({ targetUserId, checkType, skillOrAbility, dc, reason }) => {
      if (!VTTManager.isDM(userId)) return;
      const player = VTTManager.players.get(targetUserId);
      if (!player || !player.socketId) return;
      io.to(player.socketId).emit('check_request', {
          checkType,
          skillOrAbility,
          dc,
          reason,
          requestorName: name      // DM's name
      });
  });

  socket.on('submit_check', ({ targetUserId, checkType, skillOrAbility, dc, roll, bonus, reason }) => {
      const player = VTTManager.players.get(targetUserId);
      if (!player) return;
      const total = (Number(roll) || 0) + (Number(bonus) || 0);
      const success = total >= Number(dc);
      const label = checkType === 'ability' ? `${skillOrAbility} saving throw` : `${skillOrAbility} check`;
      const msg = `${player.name} rolled a ${roll} + ${bonus} = **${total}** vs DC ${dc} (${label})${reason ? ` – ${reason}` : ''} — ${success ? '✅ SUCCESS' : '❌ FAILURE'}`;
      io.emit('new_chat', VTTManager.addChatMessage('System', msg));
  });

  // ─── Administrative & Tool Visibility (DM Option)
  socket.on('toggle_catalog_hidden', (itemName) => {
      if (VTTManager.isDM(userId)) {
          VTTManager.toggleCatalogItemHidden(itemName);
          VTTManager.incrementStateVersion();
          io.emit('catalog_hidden_toggled', { 
              hiddenCatalogItems: VTTManager.state.hiddenCatalogItems, 
              version: VTTManager.stateVersion 
          });
      }
  });

  // Simple ping for latency measurement
  socket.on('ping_req', (start, callback) => {
      if (typeof callback === 'function') callback(Date.now());
  });

  // --- HIDE / REVEAL ---
  socket.on('toggle_token_hidden', (tokenId) => {
      if (!VTTManager.isDM(userId)) return;
      VTTManager.toggleTokenHidden(tokenId);
      VTTManager.incrementStateVersion();
      const token = VTTManager.state.tokens.find(t => t.id === tokenId);
      io.emit('token_hidden_toggled', { 
          tokenId, 
          hidden: token?.hidden, 
          version: VTTManager.stateVersion 
      });
      io.emit('state_update', VTTManager.getGameState());
  });

  socket.on('toggle_stamp_hidden', (stampId) => {
      if (!VTTManager.isDM(userId)) return;
      VTTManager.toggleStampHidden(stampId);
      VTTManager.incrementStateVersion();
      const stamp = VTTManager.state.stamps.find(s => s.id === stampId);
      io.emit('stamp_hidden_toggled', { 
          stampId, 
          hidden: stamp?.hidden, 
          version: VTTManager.stateVersion 
      });
  });

  socket.on('save_session', () => {
      if (!VTTManager.isDM(userId)) return;
      VTTManager.saveSession();
      VTTManager.sendDiscordMessage('VTT System', `💾 **Session Saved** for map \`${VTTManager.currentMapFolder || 'Default'}\``);
  });

  // Socket event for DM to update network settings
  socket.on('update_network_settings', (settings) => {
      if (!VTTManager.isDM(userId) || !settings) return;
      
      // Update VTTManager storage
      VTTManager.updateNetworkSettings(settings);
      
      // Apply live to Socket.IO engine
      if (settings.pingTimeout !== undefined) {
          io.engine.opts.pingTimeout = settings.pingTimeout;
          console.log(`[VTT-System] pingTimeout updated to ${settings.pingTimeout}ms`);
      }
      if (settings.pingInterval !== undefined) {
          io.engine.opts.pingInterval = settings.pingInterval;
          console.log(`[VTT-System] pingInterval updated to ${settings.pingInterval}ms`);
      }
      if (settings.maxHttpBufferSize !== undefined) {
          io.engine.opts.maxHttpBufferSize = settings.maxHttpBufferSize;
          console.log(`[VTT-System] maxHttpBufferSize updated to ${settings.maxHttpBufferSize} bytes`);
      }
      
      // Broadcast updated state so clients know new settings (optional, for UI)
      io.emit('state_update', VTTManager.getGameState());
  });

  socket.on('spawn_owned_token', (data) => {
      if (!socket.checkRateLimit(10)) return;
      const { name: tokenName, avatarUrl, hp, ac, monsterData, size } = data || {};
      if (!tokenName) return;

      const token = VTTManager.spawnOwnedToken(userId, { name: tokenName, avatarUrl, hp, ac, monsterData, size });
      if (token) {
          VTTManager.incrementStateVersion();
          io.emit('token_added', { token, version: VTTManager.stateVersion });
      }
  });

  // ── Request Player List ──
  socket.on('request_player_list', () => {
    const playerRoster = Array.from(VTTManager.players.values()).map(p => ({
        userId: p.userId,
        name: p.name,
        role: p.userId === VTTManager.dm?.userId ? 'DM' : 'player'
    }));
    socket.emit('player_list_update', playerRoster);
  });

  // ── Explicit Player Logout & Character Switch Handler ──
  socket.on('player_logout', (payload, callback) => {
    const targetUserId = payload?.userId || socket.auth?.userId || userId;
    console.log(`[VTT-System] 🚪 Explicit logout requested for: ${targetUserId}`);

    VTTManager.handleUserLogout(targetUserId);

    // Reset socket auth to Spectator so future reconnects don't auto‑join
    socket.auth.role = 'Spectator';
    socket.auth.name = 'Guest';
    socket.auth.characterId = null;

    io.emit('token_removed', { tokenId: targetUserId, version: VTTManager.stateVersion });
    io.emit('player_list_update', Array.from(VTTManager.players.values()));
    io.emit('state_update', VTTManager.getGameState());

    if (typeof callback === 'function') {
        callback({ success: true });
    }
  });

  // ── Disconnect ──
  socket.on('disconnect', () => {
    console.log(`[VTT-System] ${name || 'Unknown'} (${userId}) disconnected`);
    // Clean up socket reference (mark offline, don't remove token)
    VTTManager.handleUserDisconnect(socket.id);
    io.emit('player_list_update', Array.from(VTTManager.players.values()));
  });
});

const DEFAULT_PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || '0.0.0.0';

// Graceful Server Shutdown Handler
const handleGracefulShutdown = (signal) => {
  console.log(`\n[VTT-System] Received ${signal}. Shutting down server...`);
  
  // Cleanly terminate the Cloudflare Tunnel background process
  stopCloudflareTunnel();

  const now = new Date().toLocaleString();
  if (typeof VTTManager.sendDiscordMessage === 'function') {
    VTTManager.sendDiscordMessage('VTT Server', `🛑 **VTT Server is OFFLINE**\n📅 **Closed:** ${now}`);
  }
  setTimeout(() => {
    process.exit(0);
  }, 450);
};

process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));
process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));

async function startServer() {
  const port = await findAvailablePort(DEFAULT_PORT, HOST, 25);
  const publicIp = await getPublicIp();

  server.listen(port, HOST, async () => {
    const now = new Date().toLocaleString();
    console.log(`[VTT-System] Local Server running on http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${port}`);

    // Automatically launch Cloudflare Tunnel to mask the host IP
    const tunnelUrl = await startCloudflareTunnel(port);
    const effectiveUrl = tunnelUrl || `http://${publicIp || 'localhost'}:${port}`;

    const runtimeState = writeRuntimeState(port, HOST, tunnelUrl);
    writeClientEnvFile(port, publicIp, tunnelUrl);

    console.log(`[VTT-System] Runtime state saved to .vtt-runtime.json:`, runtimeState);
    console.log(`[VTT-System] Configured client/.env for VITE_SERVER_URL=${effectiveUrl}`);

    if (typeof VTTManager.sendDiscordMessage === 'function') {
      VTTManager.sendDiscordMessage(
        'VTT Server',
        `🚀 **VTT Server is ONLINE & Ready!**\n📅 **Launched:** ${now}\n🌐 **Address:** \`${effectiveUrl}\`${tunnelUrl ? ' *(🛡️ Protected by Cloudflare Tunnel)*' : ''}`
      );
    }
  });
}

startServer().catch((error) => {
  console.error('[VTT-System] Failed to start server:', error);
  process.exit(1);
});