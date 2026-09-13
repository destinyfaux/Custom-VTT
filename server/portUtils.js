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

function getNamedTunnelConfig() {
  const name = (process.env.CLOUDFLARE_TUNNEL_NAME || '').trim();
  const id = (process.env.CLOUDFLARE_TUNNEL_ID || '').trim();
  const url = (process.env.CLOUDFLARE_TUNNEL_URL || '').trim().replace(/\/+$/, '');
  const token = (process.env.CLOUDFLARE_TUNNEL_TOKEN || '').trim();

  if (!name && !id && !token) {
    return null;
  }

  if (token && !/^https:\/\/[^/\s]+$/i.test(url)) {
    console.warn('[VTT-System] CLOUDFLARE_TUNNEL_URL must be an https URL when using a tunnel token. Using a Quick Tunnel instead.');
    return null;
  }

  if (token) {
    return { name: name || 'token-managed tunnel', id, url, token };
  }

  if (!name || !id) {
    console.warn('[VTT-System] Named tunnel requires both CLOUDFLARE_TUNNEL_NAME and CLOUDFLARE_TUNNEL_ID. Using a Quick Tunnel instead.');
    return null;
  }

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    console.warn('[VTT-System] CLOUDFLARE_TUNNEL_ID is not a valid tunnel UUID. Using a Quick Tunnel instead.');
    return null;
  }

  if (!/^https:\/\/[^/\s]+$/i.test(url)) {
    console.warn('[VTT-System] CLOUDFLARE_TUNNEL_URL must be an https URL. Named tunnel cannot be used without it.');
    return null;
  }

  return { name, id, url, token: null };
}

function startCloudflareTunnel(port, timeoutMs = 20000) {
  return new Promise((resolve) => {
    console.log(`[VTT-System] 🛡️ Initializing Cloudflare Tunnel on port ${port}...`);

    let isResolved = false;
    let lastOutput = '';
    const namedTunnel = getNamedTunnelConfig();
    const tunnelUrlRegex = /https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/i;
    const configPath = (process.env.CLOUDFLARE_TUNNEL_CONFIG || '').trim();
    const tunnelArgs = namedTunnel
      ? (namedTunnel.token
        ? ['tunnel', '--no-autoupdate', 'run', '--token', namedTunnel.token]
        : ['tunnel', '--no-autoupdate', 'run', namedTunnel.id])
      : ['tunnel', '--url', `http://127.0.0.1:${port}`];
    const args = configPath ? ['--config', configPath, ...tunnelArgs] : tunnelArgs;
    if (namedTunnel) {
      console.log(`[VTT-System] Using named Cloudflare tunnel "${namedTunnel.name}" (${namedTunnel.id}).`);
    }

    try {
      cloudflaredProcess = spawn('cloudflared', args, {
        stdio: ['ignore', 'pipe', 'pipe']
      });
    } catch (err) {
      console.warn('[VTT-System] Failed to spawn cloudflared process:', err.message);
      return resolve(null);
    }

    const timer = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        if (cloudflaredProcess && !cloudflaredProcess.killed) {
          cloudflaredProcess.kill();
        }
        console.warn(`[VTT-System] Cloudflare ${namedTunnel ? 'named ' : ''}tunnel timed out. Falling back to direct IP.`);
        resolve(null);
      }
    }, timeoutMs);

    const handleOutput = (data) => {
      const output = data.toString();
      lastOutput = output.trim().split(/\r?\n/).filter(Boolean).slice(-3).join(' | ');
      const match = namedTunnel ? /registered tunnel connection|connection .* registered/i.test(output) : output.match(tunnelUrlRegex);

      if (match && !isResolved) {
        isResolved = true;
        clearTimeout(timer);
        const tunnelUrl = namedTunnel ? namedTunnel.url : match[0];
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
        console.warn(`[VTT-System] Cloudflare ${namedTunnel ? 'named ' : ''}tunnel closed unexpectedly with code ${code}.`);
        if (lastOutput) {
          console.warn(`[VTT-System] cloudflared output: ${lastOutput}`);
        }
        if (namedTunnel && /credentials file not found|credentials-file|authentication/i.test(lastOutput)) {
          console.warn('[VTT-System] Named tunnel credentials are missing. Set CLOUDFLARE_TUNNEL_TOKEN, or set CLOUDFLARE_TUNNEL_CONFIG to a config.yml that references the tunnel credentials JSON.');
        }
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
  const content = `# Generated by server startup. Do not commit this file.\nVITE_SERVER_URL=${serverUrl}\n`;
  fs.writeFileSync(envPath, content);
  return content;
}

module.exports = {
  findAvailablePort,
  getPublicIp,
  getRuntimeStatePath,
  getNamedTunnelConfig,
  readRuntimeState,
  startCloudflareTunnel,
  stopCloudflareTunnel,
  writeClientEnvFile,
  writeRuntimeState
};