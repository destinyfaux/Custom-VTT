/**
 * SRD Save/Load Routes
 *
 * POST /api/srd/save  — Auto-backups the existing file, then overwrites with new data.
 * GET  /api/srd/load  — Returns the current srd_data.json.
 *
 * These routes are designed to be mounted in your server.js:
 *   const srdRoutes = require('./routes/srdRoutes');
 *   app.use('/api/srd', srdRoutes);
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// ─── Configuration ───────────────────────────────────────────────────────────
// Adjust this path if your SRD file is located elsewhere.
// Relative to project root (where server.js lives).
const SRD_FILE_PATH = path.resolve(__dirname, '../../client/src/data/srd_data.json');
const BACKUP_DIR = path.resolve(__dirname, '../../client/src/data/backups');

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

/**
 * POST /api/srd/save
 *
 * Body: The full SRD JSON object (must be valid JSON).
 *
 * Steps:
 *   1. Validate the incoming JSON structure (must have top-level 'meta' key).
 *   2. Create a timestamped backup of the current srd_data.json.
 *   3. Write the new data to srd_data.json with pretty formatting (indent=2).
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
      return res.status(400).json({ error: 'SRD must contain a "meta" object at the top level.' });
    }

    // ── Validate critical top-level keys exist ──
    const requiredKeys = ['races', 'classes', 'backgrounds', 'feats', 'spells', 'equipment'];
    const missingKeys = requiredKeys.filter((k) => !data.hasOwnProperty(k));
    if (missingKeys.length > 0) {
      return res.status(400).json({
        error: `SRD is missing required top-level keys: ${missingKeys.join(', ')}`,
      });
    }

    // ── Auto-backup existing file ──
    let backupCreated = false;
    if (fs.existsSync(SRD_FILE_PATH)) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `srd_data_backup_${timestamp}.json`;
      const backupPath = path.join(BACKUP_DIR, backupFileName);

      try {
        fs.copyFileSync(SRD_FILE_PATH, backupPath);
        backupCreated = true;

        // Prune old backups (keep only the last 20)
        const backups = fs.readdirSync(BACKUP_DIR)
          .filter((f) => f.startsWith('srd_data_backup_') && f.endsWith('.json'))
          .sort();
        while (backups.length > 20) {
          const oldBackup = backups.shift();
          fs.unlinkSync(path.join(BACKUP_DIR, oldBackup));
        }
      } catch (backupErr) {
        console.warn('⚠️ Backup creation failed (saving anyway):', backupErr.message);
      }
    }

    // ── Write new data ──
    // Use 2-space indent for readability (matches the prettified format)
    const jsonStr = JSON.stringify(data, null, 2);
    fs.writeFileSync(SRD_FILE_PATH, jsonStr, 'utf8');

    console.log(`✅ SRD saved successfully (${(jsonStr.length / 1024).toFixed(1)} KB)${backupCreated ? ' (backup created)' : ''}`);

    res.json({
      success: true,
      message: `SRD saved successfully (${(jsonStr.length / 1024).toFixed(1)} KB)`,
      backupCreated,
      sizeKB: (jsonStr.length / 1024).toFixed(1),
    });
  } catch (err) {
    console.error('❌ SRD save failed:', err);
    res.status(500).json({ error: `Save failed: ${err.message}` });
  }
});

/**
 * GET /api/srd/load
 *
 * Returns the current srd_data.json content.
 */
router.get('/load', (req, res) => {
  try {
    if (!fs.existsSync(SRD_FILE_PATH)) {
      return res.status(404).json({ error: 'srd_data.json not found.' });
    }

    const raw = fs.readFileSync(SRD_FILE_PATH, 'utf8');
    const data = JSON.parse(raw);

    res.json(data);
  } catch (err) {
    console.error('❌ SRD load failed:', err);
    res.status(500).json({ error: `Load failed: ${err.message}` });
  }
});

/**
 * GET /api/srd/backups
 *
 * Lists available backup files.
 */
router.get('/backups', (req, res) => {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      return res.json({ backups: [] });
    }

    const files = fs.readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith('srd_data_backup_') && f.endsWith('.json'))
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
 * POST /api/srd/restore
 *
 * Restores from a backup file. Body: { filename: "srd_data_backup_2026-05-06T12-00-00-000Z.json" }
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
    if (fs.existsSync(SRD_FILE_PATH)) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const preRestoreBackup = path.join(BACKUP_DIR, `srd_data_pre-restore_${timestamp}.json`);
      fs.copyFileSync(SRD_FILE_PATH, preRestoreBackup);
    }

    fs.copyFileSync(backupPath, SRD_FILE_PATH);

    res.json({ success: true, message: `Restored from backup "${safeName}"` });
  } catch (err) {
    res.status(500).json({ error: `Restore failed: ${err.message}` });
  }
});

module.exports = router;
