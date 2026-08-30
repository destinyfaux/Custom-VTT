/**
 * SRD Monster Save/Load Routes
 *
 * POST /api/srd-monsters/save  — Auto-backups existing file, then overwrites with new data.
 * GET  /api/srd-monsters/load  — Returns the current srd_monsters.json.
 * GET  /api/srd-monsters/backups — Lists available backup files.
 * POST /api/srd-monsters/restore — Restores from a backup file.
 *
 * Mount in server.js:
 *   const srdMonsterRoutes = require('./routes/srdMonsterRoutes');
 *   app.use('/api/srd-monsters', srdMonsterRoutes);
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// ─── Configuration ───────────────────────────────────────────────────────────
// Path to the monster SRD JSON file (relative to project root)
const MONSTER_FILE_PATH = path.resolve(__dirname, '../../client/src/data/srd_monsters.json');
const BACKUP_DIR = path.resolve(__dirname, '../../client/src/data/backups/monsters');

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

/**
 * POST /api/srd-monsters/save
 *
 * Body: The full monster SRD JSON object (must be valid JSON).
 *
 * Steps:
 *   1. Validate the incoming JSON structure (must have 'meta' and 'monsters' keys).
 *   2. Create a timestamped backup of the current srd_monsters.json.
 *   3. Write the new data with pretty formatting (indent=2).
 *   4. Return success response.
 */
router.post('/save', (req, res) => {
  try {
    const data = req.body;

    // ── Basic validation ──
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'Request body must be a JSON object.' });
    }

    if (!data.meta || typeof data.meta !== 'object') {
      return res.status(400).json({ error: 'Monster SRD must contain a "meta" object at the top level.' });
    }

    if (!data.monsters || typeof data.monsters !== 'object') {
      return res.status(400).json({ error: 'Monster SRD must contain a "monsters" object at the top level.' });
    }

    // ── Auto-backup existing file ──
    let backupCreated = false;
    if (fs.existsSync(MONSTER_FILE_PATH)) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `srd_monsters_backup_${timestamp}.json`;
      const backupPath = path.join(BACKUP_DIR, backupFileName);

      try {
        fs.copyFileSync(MONSTER_FILE_PATH, backupPath);
        backupCreated = true;

        // Prune old backups (keep only the last 20)
        const backups = fs.readdirSync(BACKUP_DIR)
          .filter((f) => f.startsWith('srd_monsters_backup_') && f.endsWith('.json'))
          .sort();
        while (backups.length > 20) {
          const oldBackup = backups.shift();
          fs.unlinkSync(path.join(BACKUP_DIR, oldBackup));
        }
      } catch (backupErr) {
        console.warn('⚠️ Monster backup creation failed (saving anyway):', backupErr.message);
      }
    }

    // ── Write new data ──
    const jsonStr = JSON.stringify(data, null, 2);
    fs.writeFileSync(MONSTER_FILE_PATH, jsonStr, 'utf8');

    const monsterCount = Object.keys(data.monsters).length;
    console.log(`✅ Monster SRD saved successfully (${monsterCount} monsters, ${(jsonStr.length / 1024).toFixed(1)} KB)${backupCreated ? ' (backup created)' : ''}`);

    res.json({
      success: true,
      message: `Monster SRD saved successfully (${monsterCount} monsters, ${(jsonStr.length / 1024).toFixed(1)} KB)`,
      backupCreated,
      monsterCount,
      sizeKB: (jsonStr.length / 1024).toFixed(1),
    });
  } catch (err) {
    console.error('❌ Monster SRD save failed:', err);
    res.status(500).json({ error: `Save failed: ${err.message}` });
  }
});

/**
 * GET /api/srd-monsters/load
 *
 * Returns the current srd_monsters.json content.
 */
router.get('/load', (req, res) => {
  try {
    if (!fs.existsSync(MONSTER_FILE_PATH)) {
      return res.status(404).json({ error: 'srd_monsters.json not found.' });
    }

    const raw = fs.readFileSync(MONSTER_FILE_PATH, 'utf8');
    const data = JSON.parse(raw);

    res.json(data);
  } catch (err) {
    console.error('❌ Monster SRD load failed:', err);
    res.status(500).json({ error: `Load failed: ${err.message}` });
  }
});

/**
 * GET /api/srd-monsters/backups
 *
 * Lists available backup files for the monster SRD.
 */
router.get('/backups', (req, res) => {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      return res.json({ backups: [] });
    }

    const files = fs.readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith('srd_monsters_backup_') && f.endsWith('.json'))
      .sort()
      .reverse()
      .map((f) => {
        const stats = fs.statSync(path.join(BACKUP_DIR, f));
        return {
          filename: f,
          sizeKB: (stats.size / 1024).toFixed(1),
          created: stats.mtime.toISOString(),
        };
      });

    res.json({ backups: files });
  } catch (err) {
    res.status(500).json({ error: `Failed to list backups: ${err.message}` });
  }
});

/**
 * POST /api/srd-monsters/restore
 *
 * Restores from a backup file. Body: { filename: "srd_monsters_backup_..." }
 */
router.post('/restore', (req, res) => {
  try {
    const { filename } = req.body;
    if (!filename) return res.status(400).json({ error: 'filename is required.' });

    // Security: only allow restoring from our backup directory, no path traversal
    const safeName = path.basename(filename);
    const backupPath = path.join(BACKUP_DIR, safeName);

    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ error: `Backup "${safeName}" not found.` });
    }

    // Create a backup of current file before restoring
    if (fs.existsSync(MONSTER_FILE_PATH)) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const preRestoreBackup = path.join(BACKUP_DIR, `srd_monsters_pre-restore_${timestamp}.json`);
      fs.copyFileSync(MONSTER_FILE_PATH, preRestoreBackup);
    }

    fs.copyFileSync(backupPath, MONSTER_FILE_PATH);

    res.json({ success: true, message: `Restored from backup "${safeName}"` });
  } catch (err) {
    res.status(500).json({ error: `Restore failed: ${err.message}` });
  }
});

module.exports = router;
