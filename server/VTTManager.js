// server/VTTManager.js
const fs = require('fs');
const path = require('path');
const https = require('https');

// Grid size used for token placement offset (matches client)
const GRID_SIZE = 70;

class VTTManager {
    constructor() {
        this.dm = null;
        this.players = new Map(); // userId -> player object
        this.chatLogs = [];
        this.mapData = {}; 
        this.currentMapFolder = null;
        this.stateVersion = 0;

        // Debounced non-blocking file saver
        this.saveMapDataDebounced = this.createDebouncedSave();

        this.state = {
            currentMap: null,
            walls: [],
            lights: [],
            players: [],
            tokens: [],
            chatLogs: [],
            stamps: [],
            notes: [],
            shapes: [],
            audio: { music: { track: null, volume: 0.25, isPlaying: false } },
            initiative: [],
            currentTurn: null,
            hiddenCatalogItems: [],
            discordWebhookUrl: '',
            dayNight: {
                mode: 'off',
                dayColor: '#312515',
                dayOpacity: 0.15,
                nightColor: '#0a1428',
                nightOpacity: 0.55,
                duskColor: '#3c2552',
                duskOpacity: 0.25
            },
            weather: {
                type: null,
                volume: 0.5,
                isPlaying: false,
                lightningEnabled: false
            }
        };

        this.initiativeList = [];
        this.currentTurnIndex = -1;

        // Tunable network settings
        this.networkSettings = {
            pingTimeout: 60000,
            pingInterval: 25000,
            maxHttpBufferSize: 1e8,
            versionGapThreshold: 5
        };

        // Server settings paths
        this.serverSettingsPath = path.resolve(__dirname, 'assets/server_settings.json');
        this.hiddenItemsPath = path.resolve(__dirname, 'assets/hidden_items.json');

        this.loadServerSettings();
        this.loadHiddenCatalogItems();
    }

    // ─── STATE VERSIONING & HELPERS ─────────────────────────────────────────

    incrementStateVersion() {
        this.stateVersion++;
        return this.stateVersion;
    }

    isFiniteNumber(value) {
        return typeof value === 'number' && Number.isFinite(value);
    }

    getSafeMaxHp(token) {
        const parsed = Number(token?.hpMax ?? 10);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
    }

    normalizeTokenSize(sizeValue) {
        if (typeof sizeValue === 'number' && Number.isFinite(sizeValue) && sizeValue > 0) {
            return sizeValue;
        }
        if (typeof sizeValue === 'string') {
            switch (sizeValue.toLowerCase()) {
                case 'tiny': return 0.5;
                case 'small': return 0.75;
                case 'medium': return 1;
                case 'large': return 2;
                case 'huge': return 3;
                default: return 1;
            }
        }
        return 1;
    }

    createDebouncedSave() {
        let timeoutId = null;

        const run = () => {
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                this.flushMapData().catch((err) => {
                    console.error('[VTT-System ERROR] Failed to flush map data:', err);
                });
                timeoutId = null;
            }, 500);
        };

        run.flush = () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            this.flushMapData().catch((err) => {
                console.error('[VTT-System ERROR] Failed to flush map data:', err);
            });
        };

        return run;
    }

    async flushMapData() {
        if (!this.currentMapFolder) return;

        const dataPath = path.resolve(__dirname, 'assets/maps', this.currentMapFolder, 'data.json');
        const data = {
            walls: this.mapData[this.currentMapFolder]?.walls || [],
            lights: this.mapData[this.currentMapFolder]?.lights || [],
            notes: this.mapData[this.currentMapFolder]?.notes || [],
            tokens: this.state.tokens.map(t => ({ ...t })), // Retains all tokens (placed and tray)
            stamps: this.mapData[this.currentMapFolder]?.stamps || [],
            shapes: this.mapData[this.currentMapFolder]?.shapes || []
        };

        try {
            const assetsDir = path.dirname(dataPath);
            if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });
            await fs.promises.writeFile(dataPath, JSON.stringify(data, null, 2), 'utf-8');
        } catch (err) {
            console.error(`[VTT-System ERROR] Failed to save map data:`, err);
        }
    }

    saveMapData() {
        this.saveMapDataDebounced();
    }

    async saveSession() {
        if (!this.currentMapFolder) return;

        if (!this.mapData[this.currentMapFolder]) {
            this.mapData[this.currentMapFolder] = {};
        }
        this.mapData[this.currentMapFolder].tokens = this.state.tokens.map(t => ({ ...t }));
        this.mapData[this.currentMapFolder].stamps = [...this.state.stamps];
        this.mapData[this.currentMapFolder].shapes = [...this.state.shapes];
        this.saveMapDataDebounced.flush();
        console.log(`[VTT-System] Session saved for map '${this.currentMapFolder}'.`);
        this.incrementStateVersion();
    }

    // ─── CONFIGURATION & SERVER SETTINGS ─────────────────────────────────────

    loadServerSettings() {
        if (fs.existsSync(this.serverSettingsPath)) {
            try {
                const settings = JSON.parse(fs.readFileSync(this.serverSettingsPath, 'utf-8'));
                this.state.discordWebhookUrl = settings.discordWebhookUrl || '';
                console.log(`[VTT-System] Discord Webhook loaded.`);
            } catch (err) {
                console.error(`[VTT-System ERROR] Failed to parse server_settings.json:`, err);
                this.state.discordWebhookUrl = '';
            }
        } else {
            this.saveServerSettings();
        }
    }

    saveServerSettings() {
        try {
            const assetsDir = path.dirname(this.serverSettingsPath);
            if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });
            fs.writeFileSync(this.serverSettingsPath, JSON.stringify({
                discordWebhookUrl: this.state.discordWebhookUrl
            }, null, 2));
        } catch (err) {
            console.error(`[VTT-System ERROR] Failed to write server_settings.json:`, err);
        }
    }

    loadHiddenCatalogItems() {
        if (fs.existsSync(this.hiddenItemsPath)) {
            try {
                this.state.hiddenCatalogItems = JSON.parse(fs.readFileSync(this.hiddenItemsPath, 'utf-8'));
                console.log(`[VTT-System] Loaded ${this.state.hiddenCatalogItems.length} hidden catalog items.`);
            } catch (err) {
                console.error(`[VTT-System ERROR] Failed to parse hidden_items.json:`, err);
                this.state.hiddenCatalogItems = [];
            }
        } else {
            this.state.hiddenCatalogItems = [];
        }
    }

    async toggleCatalogItemHidden(itemName) {
        if (!this.state.hiddenCatalogItems) this.state.hiddenCatalogItems = [];

        const idx = this.state.hiddenCatalogItems.indexOf(itemName);
        if (idx === -1) {
            this.state.hiddenCatalogItems.push(itemName);
        } else {
            this.state.hiddenCatalogItems.splice(idx, 1);
        }

        try {
            const assetsDir = path.dirname(this.hiddenItemsPath);
            if (!fs.existsSync(assetsDir)) {
                await fs.promises.mkdir(assetsDir, { recursive: true });
            }
            await fs.promises.writeFile(
                this.hiddenItemsPath,
                JSON.stringify(this.state.hiddenCatalogItems, null, 2),
                'utf-8'
            );
        } catch (err) {
            console.error(`[VTT-System ERROR] Failed to write hidden_items.json:`, err);
        }

        this.incrementStateVersion();
    }

    setDiscordWebhook(url) {
        this.state.discordWebhookUrl = (url || '').trim();
        this.saveServerSettings();
        this.incrementStateVersion();
    }

    sendDiscordMessage(sender, message) {
        const webhookUrl = this.state.discordWebhookUrl;
        if (!webhookUrl || !webhookUrl.startsWith('https://discord.com/api/webhooks/')) return;

        try {
            // Format for Discord: trim length to 2000 chars (Discord max)
            const cleanMessage = String(message).slice(0, 1990);
            let cleanSender = (sender || 'VTT System').slice(0, 75);
            if (['discord', 'clyde', 'everyone', 'here'].includes(cleanSender.toLowerCase())) {
                cleanSender = `VTT - ${cleanSender}`;
            }

            const payload = JSON.stringify({ username: cleanSender, content: cleanMessage });
            const parsedUrl = new URL(webhookUrl);
            const req = https.request({
                hostname: parsedUrl.hostname,
                path: parsedUrl.pathname + parsedUrl.search,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload)
                }
            }, (res) => {
                if (res.statusCode < 200 || res.statusCode >= 300) {
                    console.warn(`[Discord Webhook] Status ${res.statusCode}`);
                }
            });

            req.on('error', (err) => console.error(`[Discord Webhook Error]:`, err.message));
            req.write(payload);
            req.end();
        } catch (err) {
            console.error(`[Discord Webhook Error]:`, err.message);
        }
    }

    // --- DAY / NIGHT LIGHTING CONTROL ---

    setDayNight(data) {
        this.state.dayNight = { ...(this.state.dayNight || {}), ...data };
        this.incrementStateVersion();
    }

    // Network settings methods
    updateNetworkSettings(settings) {
        if (settings.pingTimeout !== undefined) this.networkSettings.pingTimeout = settings.pingTimeout;
        if (settings.pingInterval !== undefined) this.networkSettings.pingInterval = settings.pingInterval;
        if (settings.maxHttpBufferSize !== undefined) this.networkSettings.maxHttpBufferSize = settings.maxHttpBufferSize;
        if (settings.versionGapThreshold !== undefined) this.networkSettings.versionGapThreshold = settings.versionGapThreshold;
        this.incrementStateVersion();
    }

    getNetworkSettings() {
        return { ...this.networkSettings };
    }

    setMusic(track, volume, isPlaying) {
        this.state.audio.music = { track, volume, isPlaying };
        this.incrementStateVersion();
    }

    setWeather(type, volume, isPlaying, lightningEnabled = false) {
        this.state.weather = { type, volume, isPlaying, lightningEnabled };
        this.incrementStateVersion();
    }

    // ─── MAP & SCENE RESTORATION ────────────────────────────────────────────

    restoreTokens(savedTokens = []) {
        savedTokens.forEach(saved => {
            if (!saved) return;
            if (saved.type === 'player') {
                let existing = this.state.tokens.find(t => t.id === saved.id || (t.type === 'player' && (t.ownerId === saved.ownerId || t.name === saved.name)));
                if (existing) {
                    existing.x = saved.x;
                    existing.y = saved.y;
                    existing.isPlaced = saved.isPlaced !== undefined ? saved.isPlaced : true;
                    existing.conditions = saved.conditions || [];
                    existing.hidden = saved.hidden || false;
                    existing.timesDowned = saved.timesDowned || 0;
                    existing.deathSaveSuccesses = saved.deathSaveSuccesses || 0;
                    existing.deathSaveFailures = saved.deathSaveFailures || 0;
                    existing.isStable = saved.isStable || false;
                    existing.isDead = saved.isDead || false;
                    existing.wounds = saved.wounds || [];
                    existing.woundCount = saved.wounds ? saved.wounds.length : (saved.woundCount || 0);
                } else {
                    // Retain saved player token even if player is offline
                    this.state.tokens.push({
                        id: saved.id,
                        ownerId: saved.ownerId || saved.id,
                        type: 'player',
                        name: saved.name || 'Player',
                        avatarUrl: saved.avatarUrl || null,
                        hpCur: saved.hpCur ?? 10,
                        hpMax: saved.hpMax || 10,
                        ac: saved.ac ?? 10,
                        x: saved.x || 0,
                        y: saved.y || 0,
                        isPlaced: saved.isPlaced !== undefined ? saved.isPlaced : true,
                        size: this.normalizeTokenSize(saved.size || 1),
                        conditions: saved.conditions || [],
                        hidden: saved.hidden || false,
                        timesDowned: saved.timesDowned || 0,
                        deathSaveSuccesses: saved.deathSaveSuccesses || 0,
                        deathSaveFailures: saved.deathSaveFailures || 0,
                        isStable: saved.isStable || false,
                        isDead: saved.isDead || false,
                        wounds: saved.wounds || [],
                        woundCount: saved.wounds ? saved.wounds.length : (saved.woundCount || 0)
                    });
                }
            } else if (saved.type === 'npc') {
                // Try to find existing NPC token (unlikely unless already in state)
                let npc = this.state.tokens.find(t => t.id === saved.id);
                if (!npc) {
                    // Create a new NPC token with all saved properties
                    npc = {
                        id: saved.id,
                        ownerId: saved.ownerId || 'DM',
                        type: 'npc',
                        name: saved.name || 'Monster',
                        avatarUrl: saved.avatarUrl || null,
                        hpCur: saved.hpCur ?? saved.hpMax ?? 10,
                        hpMax: saved.hpMax || 10,
                        ac: saved.ac ?? 10,
                        x: saved.x,
                        y: saved.y,
                        isPlaced: saved.isPlaced !== undefined ? saved.isPlaced : true,
                        size: this.normalizeTokenSize(saved.size || 1),
                        conditions: saved.conditions || [],
                        hidden: saved.hidden || false,
                        monsterData: saved.monsterData || null,
                        timesDowned: saved.timesDowned || 0,
                        deathSaveSuccesses: saved.deathSaveSuccesses || 0,
                        deathSaveFailures: saved.deathSaveFailures || 0,
                        isStable: saved.isStable || false,
                        isDead: saved.isDead || false,
                        wounds: saved.wounds || [],
                        woundCount: saved.wounds ? saved.wounds.length : (saved.woundCount || 0)
                    };
                    this.state.tokens.push(npc);
                } else {
                    Object.assign(npc, saved, { isPlaced: saved.isPlaced !== undefined ? saved.isPlaced : true });
                }
            }
        });
    }

    // Now accepts both the folder name (for saving) and the image path (for clients)
    setMap(mapName, mapImagePath) {
        this.state.currentMap = mapImagePath;
        this.currentMapFolder = mapName;

        // CRITICAL: When the map changes, recall all tokens to the tray
        this.state.tokens.forEach(token => {
            token.isPlaced = false;
            token.x = 0;
            token.y = 0;
        });

        // Clear ephemeral map elements
        this.state.stamps = [];
        this.state.notes = [];
        this.state.shapes = [];

        const dataPath = path.resolve(__dirname, 'assets/maps', mapName, 'data.json');

        // If we haven't loaded this map into memory yet, read it from the file
        if (!this.mapData[mapName]) {
            if (fs.existsSync(dataPath)) {
                try {
                    const rawData = fs.readFileSync(dataPath, 'utf-8');
                    const parsed = JSON.parse(rawData);
                    // Load into the new structural format
                    this.mapData[mapName] = {
                        walls: parsed.walls || [],
                        lights: parsed.lights || [],
                        notes: parsed.notes || [],
                        tokens: parsed.tokens || [],
                        stamps: parsed.stamps || [],
                        shapes: parsed.shapes || []
                    };
                    console.log(`[VTT-System] Loaded existing data.json for scene ${mapName}`);
                } catch (err) {
                    console.error(`[VTT-System ERROR] Could not parse data.json for ${mapName}:`, err);
                    this.mapData[mapName] = { walls: [], lights: [], notes: [], tokens: [], stamps: [], shapes: [] };
                }
            } else {
                this.mapData[mapName] = { walls: [], lights: [], notes: [], tokens: [], stamps: [], shapes: [] };
            }
        }

        this.state.walls = this.mapData[mapName].walls || [];
        this.state.lights = this.mapData[mapName].lights || [];
        this.state.notes = this.mapData[mapName].notes || [];
        this.state.shapes = this.mapData[mapName].shapes || [];
        this.state.stamps = [...(this.mapData[mapName].stamps || [])];

        this.restoreTokens(this.mapData[mapName].tokens || []);
        this.incrementStateVersion();
    }

    // ─── USER REGISTRATION & PRESENCE (ELIMINATES GHOST PLAYERS) ──────────

    registerUser(userId, socketId, role, name, characterId = null) {
        if (!userId || !socketId) return;

        // ⭐️ STRICT ROLE CHECK: Only 'DM' and 'Player' are allowed onto the table.
        // Spectators, guests, or unauthenticated login screen connections are IGNORED.
        if (role !== 'DM' && role !== 'Player') {
            return;
        }

        const displayName = name || 'Adventurer';

        if (role === 'DM') {
            this.dm = { userId, socketId, name: displayName };
            
            // Clean up any accidental player registration or tokens if DM previously had player role
            this.players.delete(userId);
            this.state.tokens = this.state.tokens.filter(t => !(t.type === 'player' && (t.id === userId || t.ownerId === userId)));
            this.state.players = Array.from(this.players.values());
        } else if (role === 'Player') {
            if (this.dm && this.dm.userId === userId) {
                this.dm = null;
            }

            const existingPlayer = this.players.get(userId);
            const charData = existingPlayer?.characterData || {};

            // If there is already an entry with the same userId but a different socketId, update it.
            if (existingPlayer) {
                existingPlayer.socketId = socketId;
                existingPlayer.status = 'online';
                existingPlayer.name = charData.name || displayName;
                this.players.set(userId, existingPlayer);
            } else {
                this.players.set(userId, {
                    userId,
                    characterId: characterId || null,
                    name: charData.name || displayName,
                    socketId,
                    status: 'online',
                    characterData: charData
                });
            }

            this.state.players = Array.from(this.players.values());
            this.upsertPlayerToken(userId, { name: charData.name || displayName, ...charData });
        }

        this.incrementStateVersion();

        const roleBadge = role === 'DM' ? '👑 Dungeon Master' : '🎲 Player';
        const partyCount = this.players.size + (this.dm ? 1 : 0);
        this.sendDiscordMessage('VTT Presence', `🟢 **${displayName}** (${roleBadge}) joined the table. (Active: ${partyCount})`);
    }

    handleUserLogout(userId) {
        if (!userId) return null;
        let loggedOutUser = null;
        if (this.dm && this.dm.userId === userId) {
            loggedOutUser = { name: this.dm.name, role: 'DM' };
            this.dm = null;
        }
        if (this.players.has(userId)) {
            const player = this.players.get(userId);
            loggedOutUser = { name: player.name, role: 'Player' };
            this.players.delete(userId);
            this.state.players = Array.from(this.players.values());
            this.state.tokens = this.state.tokens.filter(t => !(t.type === 'player' && (t.id === userId || t.ownerId === userId)));
        }
        if (loggedOutUser) {
            this.incrementStateVersion();
            const roleBadge = loggedOutUser.role === 'DM' ? '👑 Dungeon Master' : '🎲 Player';
            const onlineCount = Array.from(this.players.values()).filter(p => p.status === 'online').length + (this.dm ? 1 : 0);
            this.sendDiscordMessage('VTT Presence', `🚪 **${loggedOutUser.name}** (${roleBadge}) logged out. (Active: ${onlineCount})`);
        }
        return loggedOutUser;
    }

    handleUserDisconnect(socketId) {
        if (!socketId) return;

        let found = false;

        // Check DM
        if (this.dm && this.dm.socketId === socketId) {
            // DM disconnected – we keep the dm object but null out socketId so they can reconnect later.
            this.dm.socketId = null;
            found = true;
        }

        // Check Players
        for (const [userId, player] of this.players.entries()) {
            if (player.socketId === socketId) {
                player.socketId = null;
                player.status = 'offline';
                this.players.set(userId, player);
                found = true;
                break;
            }
        }

        if (found) {
            this.state.players = Array.from(this.players.values());
            this.incrementStateVersion();
            // Do NOT remove token – keep it on the board for reconnects.
        }
    }

    updatePlayerData(userId, data = {}) {
        let player = this.players.get(userId);
        if (!player) {
            player = {
                userId,
                name: data.name || 'Adventurer',
                socketId: null,
                status: 'online',
                characterData: {}
            };
            this.players.set(userId, player);
        }

        player.characterData = { ...(player.characterData || {}), ...data };
        if (data.name) player.name = data.name;
        this.players.set(userId, player);
        this.state.players = Array.from(this.players.values());
        this.upsertPlayerToken(userId, player.characterData);
    }

    // ─── TOKEN ENGINE ─────────────────────────────────────────────────────

    upsertPlayerToken(userId, charData = {}) {
        let token = this.state.tokens.find(t => t.id === userId || (t.type === 'player' && t.ownerId === userId));
        const maxHp = Number(charData.hpMax || 10);
        const curHp = charData.hpCur !== undefined ? Number(charData.hpCur) : maxHp;
        const acVal = charData.ac !== undefined ? Number(charData.ac) : 10;

        if (!token) {
            // New Token (Starts in Tray)
            token = {
                id: userId,
                ownerId: userId,
                type: 'player',
                name: charData.name || 'Player',
                avatarUrl: charData.avatarUrl || null,
                hpCur: curHp,
                hpMax: maxHp,
                ac: acVal,
                x: 0,
                y: 0,
                isPlaced: false,
                size: 1,
                conditions: [],
                hidden: false,
                timesDowned: Number(charData.timesDowned || 0),
                deathSaveSuccesses: Number(charData.deathSaveSuccesses || 0),
                deathSaveFailures: Number(charData.deathSaveFailures || 0),
                isStable: Boolean(charData.isStable),
                isDead: Boolean(charData.isDead),
                wounds: charData.wounds || [],
                woundCount: Array.isArray(charData.wounds) ? charData.wounds.length : Number(charData.woundCount || 0)
            };
            this.state.tokens.push(token);
        } else {
            // Update existing token visuals/stats from sheet
            token.name = charData.name || token.name;
            token.avatarUrl = charData.avatarUrl || token.avatarUrl;
            token.hpCur = charData.hpCur !== undefined ? Number(charData.hpCur) : token.hpCur;
            token.hpMax = charData.hpMax !== undefined ? Number(charData.hpMax) : token.hpMax;
            token.ac = charData.ac !== undefined ? Number(charData.ac) : token.ac;
            token.timesDowned = charData.timesDowned !== undefined ? Number(charData.timesDowned) : token.timesDowned;
            token.deathSaveSuccesses = charData.deathSaveSuccesses !== undefined ? Number(charData.deathSaveSuccesses) : token.deathSaveSuccesses;
            token.deathSaveFailures = charData.deathSaveFailures !== undefined ? Number(charData.deathSaveFailures) : token.deathSaveFailures;
            token.isStable = charData.isStable !== undefined ? Boolean(charData.isStable) : token.isStable;
            token.isDead = charData.isDead !== undefined ? Boolean(charData.isDead) : token.isDead;
            token.wounds = charData.wounds || token.wounds || [];
            token.woundCount = Array.isArray(token.wounds) ? token.wounds.length : (token.woundCount || 0);
        }

        this.incrementStateVersion();
        return token;
    }

    addNPCToken(name, avatarUrl, hp, ac, monsterData = null, size = 1, ownerId = 'DM') {
        const npcId = 'npc_' + Date.now() + Math.random().toString(36).substr(2, 5);
        const safeHp = Number(hp) > 0 ? Number(hp) : 10;

        const token = {
            id: npcId,
            ownerId: ownerId || 'DM',
            type: 'npc',
            name: name || 'Monster',
            avatarUrl: avatarUrl || null,
            hpCur: safeHp,
            hpMax: safeHp,
            ac: Number(ac) >= 0 ? Number(ac) : 10,
            x: 0,
            y: 0,
            isPlaced: false,
            size: this.normalizeTokenSize(size ?? monsterData?.size ?? 1),
            conditions: [],
            hidden: false,
            monsterData: monsterData,
            timesDowned: 0,
            deathSaveSuccesses: 0,
            deathSaveFailures: 0,
            isStable: false,
            isDead: false,
            wounds: [],
            woundCount: 0
        };

        this.state.tokens.push(token);
        this.incrementStateVersion();
        return token;
    }

    addNPCTokenBatch(creatures = []) {
        if (!Array.isArray(creatures) || creatures.length === 0) return [];

        const created = [];
        for (const creature of creatures) {
            if (!creature || typeof creature !== 'object') continue;
            const sizeValue = creature.size ?? creature.monsterData?.size ?? 1;
            const token = this.addNPCToken(
                creature.name,
                creature.avatarUrl || null,
                Number(creature.hp) || 10,
                Number(creature.ac) || 10,
                creature.monsterData || null,
                sizeValue,
                creature.ownerId || 'DM'
            );
            if (token) created.push(token);
        }

        return created;
    }

    moveToken(tokenId, x, y, userId) {
        const token = this.state.tokens.find(t => t.id === tokenId);
        if (!token) return false;

        const numX = Number(x);
        const numY = Number(y);
        if (!this.isFiniteNumber(numX) || !this.isFiniteNumber(numY)) {
            return false;
        }

        const isOwner = token.ownerId === userId;
        const isAdmin = this.isDM(userId);

        if (isAdmin || (isOwner && token.isPlaced)) {
            token.x = numX;
            token.y = numY;
            if (isAdmin) token.isPlaced = true;
            return true;
        }

        return false;
    }

    // RECALL: Used by Eraser and Map Changes to send tokens back to Tray
    removeToken(tokenId) {
        const token = this.state.tokens.find(t => t.id === tokenId);
        if (!token) return false;

        // Both Players and NPCs now return to tray
        token.isPlaced = false;
        token.x = 0;
        token.y = 0;
        console.log(`[VTT-System] Recalled ${token.name} (${token.type}) to tray.`);
        this.incrementStateVersion();
        return true;
    }

    // PERMANENT DELETE: Used for NPCs only via the Tray "X" button
    deleteToken(tokenId) {
        const token = this.state.tokens.find(t => t.id === tokenId);
        if (!token) return false;

        if (token.type === 'npc') {
            this.state.tokens = this.state.tokens.filter(t => t.id !== tokenId);
            console.log(`[VTT-System] Permanently deleted NPC: ${token.name}`);
            this.incrementStateVersion();
            return true;
        }
        return false;
    }

    deleteTokenBatch(tokenIds = []) {
        if (!Array.isArray(tokenIds) || tokenIds.length === 0) return 0;

        const validIds = new Set(tokenIds.filter(Boolean));
        if (validIds.size === 0) return 0;

        const previousLength = this.state.tokens.length;
        this.state.tokens = this.state.tokens.filter(token => {
            if (token.type !== 'npc') return true;
            return !validIds.has(token.id);
        });

        const deletedCount = previousLength - this.state.tokens.length;
        if (deletedCount > 0) this.incrementStateVersion();
        return deletedCount;
    }

    adjustTokenHP(tokenId, amount, isHeal) {
        const token = this.state.tokens.find(t => t.id === tokenId);
        if (!token) return null;

        const numericAmount = Number(amount);
        if (!this.isFiniteNumber(numericAmount) || numericAmount <= 0 || numericAmount > 9999 || typeof isHeal !== 'boolean') {
            return null;
        }

        const maxHp = this.getSafeMaxHp(token);
        token.hpMax = maxHp;
        const oldHp = Number(token.hpCur ?? 0);
        const delta = isHeal ? numericAmount : -numericAmount;
        token.hpCur = Math.min(maxHp, Math.max(0, oldHp + delta));

        const wasDowned = oldHp > 0 && token.hpCur <= 0;
        this.incrementStateVersion();

        return { token, oldHp, newHp: token.hpCur, wasDowned };
    }

    // CONDITION MANAGEMENT
    toggleCondition(tokenId, conditionName) {
        const token = this.state.tokens.find(t => t.id === tokenId);
        if (!token) return false;
        if (!Array.isArray(token.conditions)) token.conditions = [];
        const idx = token.conditions.indexOf(conditionName);
        if (idx === -1) token.conditions.push(conditionName);
        else token.conditions.splice(idx, 1);
        this.incrementStateVersion();
        return true;
    }

    clearConditions(tokenId) {
        const token = this.state.tokens.find(t => t.id === tokenId);
        if (!token) return false;
        token.conditions = [];
        this.incrementStateVersion();
        return true;
    }

    // HIDE / REVEAL
    toggleTokenHidden(tokenId) {
        const token = this.state.tokens.find(t => t.id === tokenId);
        if (!token) return false;
        token.hidden = !token.hidden;
        this.incrementStateVersion();
        return token.hidden;
    }

    // ─── STAMPS, LIGHTS, WALLS, SHAPES, NOTES ─────────────────────────────

    addLight(lightData) {
        if (!this.currentMapFolder) return null;
        const newLight = {
            id: 'light_' + Date.now() + Math.random().toString(36).substr(2, 5),
            ...lightData
        };
        if (!this.mapData[this.currentMapFolder]) {
            this.mapData[this.currentMapFolder] = { walls: [], lights: [], notes: [], stamps: [], shapes: [], tokens: [] };
        }
        this.mapData[this.currentMapFolder].lights.push(newLight);
        this.state.lights = this.mapData[this.currentMapFolder].lights;
        this.saveMapData();
        this.incrementStateVersion();
        return newLight;
    }

    removeLight(lightId) {
        if (!this.currentMapFolder || !this.mapData[this.currentMapFolder]) return false;
        this.mapData[this.currentMapFolder].lights = this.mapData[this.currentMapFolder].lights.filter(l => l.id !== lightId);
        this.state.lights = this.mapData[this.currentMapFolder].lights;
        this.saveMapData();
        this.incrementStateVersion();
        return true;
    }

    addStamp(stampData) {
        const stamp = {
            id: 'stamp_' + Date.now() + Math.random().toString(36).substr(2, 5),
            url: stampData.url,
            x: Number(stampData.x) || 0,
            y: Number(stampData.y) || 0,
            width: Number(stampData.width) || 64,
            height: Number(stampData.height) || 64,
            hidden: false
        };

        this.state.stamps.push(stamp);
        if (this.currentMapFolder) {
            if (!this.mapData[this.currentMapFolder]) {
                this.mapData[this.currentMapFolder] = { walls: [], lights: [], notes: [], tokens: [], stamps: [], shapes: [] };
            }
            this.mapData[this.currentMapFolder].stamps = [...this.state.stamps];
            this.saveMapData();
        }

        this.incrementStateVersion();
        return stamp;
    }

    removeStamp(stampId) {
        this.state.stamps = this.state.stamps.filter(s => s.id !== stampId);
        if (this.currentMapFolder && this.mapData[this.currentMapFolder]) {
            this.mapData[this.currentMapFolder].stamps = [...this.state.stamps];
            this.saveMapData();
        }
        this.incrementStateVersion();
        return true;
    }

    toggleStampHidden(stampId) {
        const stamp = this.state.stamps.find(s => s.id === stampId);
        if (!stamp) return false;

        stamp.hidden = !stamp.hidden;
        if (this.currentMapFolder && this.mapData[this.currentMapFolder]) {
            this.mapData[this.currentMapFolder].stamps = [...this.state.stamps];
            this.saveMapData();
        }

        this.incrementStateVersion();
        return stamp.hidden;
    }

    // --- SHAPE ENGINE ---
    addShape(shapeData) {
        if (!this.currentMapFolder) return null;

        // Check if we already hit the limit or have map initialization safety
        if (!this.mapData[this.currentMapFolder]) {
            this.mapData[this.currentMapFolder] = { walls: [], lights: [], notes: [], tokens: [], stamps: [], shapes: [] };
        }
        if (!this.mapData[this.currentMapFolder].shapes) {
            this.mapData[this.currentMapFolder].shapes = [];
        }

        // Limit checking: enforce a max of 3 shapes per player (DMs are exempt)
        const currentShapes = this.mapData[this.currentMapFolder].shapes;
        const playerShapesCount = currentShapes.filter(s => s.ownerId === shapeData.ownerId).length;
        if (!this.isDM(shapeData.ownerId) && playerShapesCount >= 3) {
            return null; // Denied on server level
        }

        const shape = {
            id: 'shape_' + Date.now() + Math.random().toString(36).substr(2, 5),
            ...shapeData
        };

        this.mapData[this.currentMapFolder].shapes.push(shape);
        this.state.shapes = this.mapData[this.currentMapFolder].shapes;

        this.saveMapData();
        this.incrementStateVersion();
        return shape;
    }

    removeShape(shapeId, userId) {
        if (!this.currentMapFolder || !this.mapData[this.currentMapFolder]?.shapes) return false;

        const shape = this.mapData[this.currentMapFolder].shapes.find(s => s.id === shapeId);
        if (!shape) return false;

        // DM can delete anything, players can only delete their own
        if (shape.ownerId !== userId && !this.isDM(userId)) {
            return false;
        }

        this.mapData[this.currentMapFolder].shapes = this.mapData[this.currentMapFolder].shapes.filter(s => s.id !== shapeId);
        this.state.shapes = this.mapData[this.currentMapFolder].shapes;

        this.saveMapData();
        this.incrementStateVersion();
        return true;
    }

    clearUserShapes(userId) {
        if (!this.currentMapFolder || !this.mapData[this.currentMapFolder]?.shapes) return false;

        // DM clears ALL shapes on the board, players only clear their own
        if (this.isDM(userId)) {
            this.mapData[this.currentMapFolder].shapes = [];
        } else {
            this.mapData[this.currentMapFolder].shapes = this.mapData[this.currentMapFolder].shapes.filter(s => s.ownerId !== userId);
        }

        this.state.shapes = this.mapData[this.currentMapFolder].shapes;
        this.saveMapData();
        this.incrementStateVersion();
        return true;
    }

    // Move a shape (DM can move any, players can only move their own)
    updateShapePosition(shapeId, x, y, endX, endY, userId) {
        if (!this.currentMapFolder || !this.mapData[this.currentMapFolder]?.shapes) return false;

        const shape = this.mapData[this.currentMapFolder].shapes.find(s => s.id === shapeId);
        if (!shape) return false;

        // DM can move anything, players can only move their own shapes
        if (shape.ownerId !== userId && !this.isDM(userId)) {
            return false;
        }

        shape.x = x;
        shape.y = y;
        shape.endX = endX;
        shape.endY = endY;

        this.state.shapes = this.mapData[this.currentMapFolder].shapes;
        this.saveMapData();
        this.incrementStateVersion();
        return true;
    }

    // UPDATED NOTE ENGINE (no collapsed)
    addNote(text, x, y) {
        if (!this.currentMapFolder) return null;

        const note = {
            id: 'note_' + Date.now() + Math.random().toString(36).substr(2, 5),
            x: Number(x) || 0,
            y: Number(y) || 0,
            text: text || ''
        };

        if (!this.mapData[this.currentMapFolder]) {
            this.mapData[this.currentMapFolder] = { walls: [], lights: [], notes: [], tokens: [], stamps: [], shapes: [] };
        }

        this.mapData[this.currentMapFolder].notes.push(note);
        this.state.notes = this.mapData[this.currentMapFolder].notes;

        this.saveMapData();
        this.incrementStateVersion();
        return note;
    }

    updateNote(noteId, { text }) {
        if (!this.currentMapFolder || !this.mapData[this.currentMapFolder]?.notes) return false;

        const notes = this.mapData[this.currentMapFolder].notes;
        const note = notes.find(n => n.id === noteId);
        if (!note) return false;

        if (text !== undefined) note.text = text;
        this.state.notes = notes;

        this.saveMapData();
        this.incrementStateVersion();
        return true;
    }

    removeNote(noteId) {
        if (!this.currentMapFolder || !this.mapData[this.currentMapFolder]?.notes) return false;

        this.mapData[this.currentMapFolder].notes = this.mapData[this.currentMapFolder].notes.filter(n => n.id !== noteId);
        this.state.notes = this.mapData[this.currentMapFolder].notes;

        this.saveMapData();
        this.incrementStateVersion();
        return true;
    }

    addWalls(newWalls = []) {
        if (!this.currentMapFolder || !Array.isArray(newWalls) || newWalls.length === 0) return [];

        const wallsWithIds = newWalls.map(w => ({
            id: 'wall_' + Date.now() + Math.random().toString(36).substr(2, 9),
            ...w
        }));

        if (!this.mapData[this.currentMapFolder]) {
            this.mapData[this.currentMapFolder] = { walls: [], lights: [], notes: [], tokens: [], stamps: [], shapes: [] };
        }

        this.mapData[this.currentMapFolder].walls.push(...wallsWithIds);
        this.state.walls = this.mapData[this.currentMapFolder].walls;

        this.saveMapData();
        this.incrementStateVersion();
        return wallsWithIds;
    }

    removeWallById(wallId) {
        if (!this.currentMapFolder || !this.mapData[this.currentMapFolder]?.walls) return false;

        this.mapData[this.currentMapFolder].walls = this.mapData[this.currentMapFolder].walls.filter(w => w.id !== wallId);
        this.state.walls = this.mapData[this.currentMapFolder].walls;

        this.saveMapData();
        this.incrementStateVersion();
        return true;
    }

    // Centrally processes all chat messages & pushes to Discord
    addChatMessage(sender, message, metadata = null) {
        const entry = { sender, message, timestamp: Date.now() };
        if (metadata) entry.metadata = metadata;

        this.chatLogs.push(entry);
        this.state.chatLogs = this.chatLogs;
        if (this.chatLogs.length > 50) this.chatLogs.shift();

        // Push to Discord Webhook
        this.sendDiscordMessage(sender, message);

        return entry;
    }

    isDM(userId) {
        return Boolean(this.dm && this.dm.userId === userId);
    }

    getGameState() {
        return {
            ...this.state,
            currentMap: this.state.currentMap,
            currentMapFolder: this.currentMapFolder,
            mapUrl: this.state.currentMap,
            _version: this.stateVersion,
            _versionGapThreshold: this.networkSettings.versionGapThreshold
        };
    }

    // --- INITIATIVE TRACKING METHODS ---

    // Called when DM starts combat – sorts the combatants and sets the order
    setInitiativeOrder(combatants) {
        if (!Array.isArray(combatants)) return;

        this.initiativeList = combatants.sort((a, b) => b.initiative - a.initiative);
        // Reset to first turn
        this.currentTurnIndex = 0;
        // Update the state that goes to all clients
        this.state.initiative = [...this.initiativeList];
        this.state.currentTurn = this.getActiveCombatantId();
        this.incrementStateVersion();
    }

    // Advance to the next combatant in the order
    advanceTurn() {
        if (this.initiativeList.length === 0) return;
        this.currentTurnIndex = (this.currentTurnIndex + 1) % this.initiativeList.length;
        this.state.currentTurn = this.getActiveCombatantId();
        // Optionally, you might want to update movementUsed = 0 for the new active token.
        // For now, the state reflects who is active.
        // The initiative list itself doesn't change.
        this.state.initiative = [...this.initiativeList];
        this.incrementStateVersion();
    }

    // Return the id of the token whose turn it is (or null)
    getActiveCombatantId() {
        if (this.currentTurnIndex === -1 || !this.initiativeList[this.currentTurnIndex]) return null;
        return this.initiativeList[this.currentTurnIndex].id;
    }

    // Completely reset initiative (e.g., end combat)
    resetInitiative() {
        this.initiativeList = [];
        this.currentTurnIndex = -1;
        this.state.initiative = [];
        this.state.currentTurn = null;
        this.incrementStateVersion();
    }

    // --- DEATH SAVE & EXCESSIVE DAMAGE RESET METHODS ---

    resetDeathSaves(tokenId) {
        const token = this.state.tokens.find(t => t.id === tokenId);
        if (token) {
            token.deathSaveSuccesses = 0;
            token.deathSaveFailures = 0;
            token.isStable = false;
            token.isDead = false;
            this.incrementStateVersion();
            return true;
        }
        return false;
    }

    resetTimesDowned(tokenId) {
        const token = this.state.tokens.find(t => t.id === tokenId);
        if (token) {
            token.timesDowned = 0;
            this.incrementStateVersion();
            return true;
        }
        return false;
    }

    handleDeathSave(tokenId, success, roll) {
        const token = this.state.tokens.find(t => t.id === tokenId);
        if (!token || token.isDead) return null;

        // Nat 20 immediately regains 1 HP and wakes up, resetting the track
        if (roll === 20) {
            token.hpCur = 1;
            token.deathSaveSuccesses = 0;
            token.deathSaveFailures = 0;
            token.isStable = false;
            token.isDead = false;
            if (token.conditions) {
                token.conditions = token.conditions.filter(c => c !== 'Dead');
            }
            this.incrementStateVersion();
            return { healed: true, hpCur: 1, successes: 0, failures: 0, stable: false, dead: false };
        }

        // Nat 1 counts as two failures
        if (roll === 1) {
            token.deathSaveFailures = (token.deathSaveFailures || 0) + 2;
        } else if (success) {
            token.deathSaveSuccesses = (token.deathSaveSuccesses || 0) + 1;
            if (token.deathSaveSuccesses >= 3) token.isStable = true;
        } else {
            token.deathSaveFailures = (token.deathSaveFailures || 0) + 1;
        }

        // Check for death (Failures + Wounds >= 3)
        const wounds = Array.isArray(token.wounds) ? token.wounds.length : (token.woundCount || 0);
        const totalFailures = token.deathSaveFailures + wounds;
        if (totalFailures >= 3) {
            token.isDead = true;
            token.hpCur = 0;
            if (!token.conditions) token.conditions = [];
            if (!token.conditions.includes('Dead')) token.conditions.push('Dead');
        }

        this.incrementStateVersion();
        return {
            death: token.isDead || false,
            successes: token.deathSaveSuccesses,
            failures: token.deathSaveFailures,
            stable: token.isStable,
            dead: token.isDead
        };
    }

    // ─── PLAYER-OWNED COMPANIONS & MOUNT SPAWNING ───────────────────────────

    getPlayerTokenPosition(userId) {
        const playerToken = this.state.tokens.find(
            t => t.type === 'player' && t.ownerId === userId && t.isPlaced
        );
        return playerToken ? { x: playerToken.x, y: playerToken.y } : null;
    }

    /**
     * Spawns a token owned by the given user, placing it near the player's own token.
     * Returns the created token object, or null if player token not found.
     */
    spawnOwnedToken(userId, { name, avatarUrl, hp, ac, monsterData, size = 1 }) {
        const pos = this.getPlayerTokenPosition(userId);
        if (!pos) {
            console.warn(`[VTT-System] Cannot spawn minion for ${userId}: player token not placed on active map.`);
            return null;
        }
        // Place token to the right of the player token (offset by 2 grid cells)
        const x = pos.x + GRID_SIZE * 2;
        const y = pos.y;
        const safeHp = Number(hp) > 0 ? Number(hp) : 10;

        const token = {
            id: 'owned_' + Date.now() + Math.random().toString(36).substr(2, 5),
            ownerId: userId,
            type: 'npc',
            name: name || 'Companion',
            avatarUrl: avatarUrl || null,
            hpCur: safeHp,
            hpMax: safeHp,
            ac: Number(ac) >= 0 ? Number(ac) : 10,
            x,
            y,
            isPlaced: true,
            size: this.normalizeTokenSize(size ?? monsterData?.size ?? 1),
            conditions: [],
            hidden: false,
            monsterData: monsterData || null,
            timesDowned: 0,
            deathSaveSuccesses: 0,
            deathSaveFailures: 0,
            isStable: false,
            isDead: false,
            wounds: [],
            woundCount: 0
        };

        this.state.tokens.push(token);
        this.incrementStateVersion();
        console.log(`[VTT-System] Spawned companion token '${token.name}' for player ID ${userId}`);
        return token;
    }
}

const singleton = new VTTManager();
module.exports = singleton;
module.exports.VTTManager = VTTManager;