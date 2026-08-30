// server/portUtils.js
const fs = require('fs');
const net = require('net');
const path = require('path');
const https = require('https');
const { spawn } = require('child_process');

let cloudflaredProcess = null;

function isPortAvailable(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const probe = net.createServer();

    probe.once('error', (error) => {
      resolve({ available: false, error });
    });

    probe.once('listening', () => {
      probe.close(() => resolve({ available: true }));
    });

    probe.listen(port, host);
  });
}

async function findAvailablePort(startPort, host = '127.0.0.1', maxAttempts = 25) {
  let port = Number(startPort);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new RangeError(`Invalid port: ${startPort}`);
  }

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const result = await isPortAvailable(port, host);
    if (result.available) {
      return port;
    }
    port += 1;
  }

  throw new Error(`Unable to find an available port starting from ${startPort}`);
}

function getRuntimeStatePath(rootDir = path.resolve(__dirname, '..')) {
  return path.join(rootDir, '.vtt-runtime.json');
}

function readRuntimeState(rootDir = path.resolve(__dirname, '..')) {
  const filePath = getRuntimeStatePath(rootDir);
  if (!fs.existsSync(filePath)) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    console.warn('[VTT-System] Unable to parse runtime state file:', error.message);
    return {};
  }
}

function writeRuntimeState(port, host, tunnelUrl = null, rootDir = path.resolve(__dirname, '..')) {
  const filePath = getRuntimeStatePath(rootDir);
  const state = {
    backendPort: Number(port),
    host,
    tunnelUrl: tunnelUrl || null,
    updatedAt: new Date().toISOString()
  };

  fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
  return state;
}

function getPublicIp() {
  return new Promise((resolve) => {
    https.get('https://api.ipify.org', (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve(data.trim() || null);
      });
    }).on('error', () => {
      resolve(null);
    });
  });
}

/**
 * Automatically spawns a Cloudflare Quick Tunnel and resolves the public https URL
 */
function startCloudflareTunnel(port, timeoutMs = 20000) {
  return new Promise((resolve) => {
    console.log(`[VTT-System] 🛡️ Initializing Cloudflare Tunnel on port ${port}...`);

    let isResolved = false;
    const tunnelUrlRegex = /https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/i;

    try {
      cloudflaredProcess = spawn('cloudflared', ['tunnel', '--url', `http://127.0.0.1:${port}`], {
        stdio: ['ignore', 'pipe', 'pipe']
      });
    } catch (err) {
      console.warn('[VTT-System] Failed to spawn cloudflared process:', err.message);
      return resolve(null);
    }

    const timer = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        console.warn('[VTT-System] Cloudflare tunnel timed out. Falling back to direct IP.');
        resolve(null);
      }
    }, timeoutMs);

    const handleOutput = (data) => {
      const output = data.toString();
      const match = output.match(tunnelUrlRegex);

      if (match && !isResolved) {
        isResolved = true;
        clearTimeout(timer);
        const tunnelUrl = match[0];
        console.log(`[VTT-System] 🛡️ Cloudflare Masked URL Established: ${tunnelUrl}`);
        resolve(tunnelUrl);
      }
    };

    cloudflaredProcess.stdout.on('data', handleOutput);
    cloudflaredProcess.stderr.on('data', handleOutput);

    cloudflaredProcess.on('error', (err) => {
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timer);
        if (err.code === 'ENOENT') {
          console.warn('[VTT-System] \'cloudflared\' binary not found in system PATH. Falling back to direct IP.');
        } else {
          console.warn('[VTT-System] Cloudflare tunnel error:', err.message);
        }
        resolve(null);
      }
    });

    cloudflaredProcess.on('close', (code) => {
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timer);
        console.warn(`[VTT-System] Cloudflare tunnel closed unexpectedly with code ${code}.`);
        resolve(null);
      }
    });
  });
}

function stopCloudflareTunnel() {
  if (cloudflaredProcess) {
    try {
      cloudflaredProcess.kill('SIGTERM');
      console.log('[VTT-System] Cloudflare tunnel closed.');
    } catch (err) {
      // Ignore cleanup error on exit
    }
    cloudflaredProcess = null;
  }
}

function writeClientEnvFile(port, publicIp, tunnelUrl = null, rootDir = path.resolve(__dirname, '..')) {
  const envPath = path.resolve(rootDir, 'client/.env');
  const serverUrl = tunnelUrl || `http://${publicIp || 'localhost'}:${port}`;
  const content = `VITE_SERVER_URL=${serverUrl}\n`;
  fs.writeFileSync(envPath, content);
  return content;
}

module.exports = {
  findAvailablePort,
  getPublicIp,
  getRuntimeStatePath,
  readRuntimeState,
  startCloudflareTunnel,
  stopCloudflareTunnel,
  writeClientEnvFile,
  writeRuntimeState
};