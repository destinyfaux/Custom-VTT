const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('net');
const { findAvailablePort } = require('./portUtils');

function listenOnce(port) {
  const server = net.createServer();
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

test('findAvailablePort skips occupied ports and returns the next free one', async () => {
  const preferredPort = 51000 + Math.floor(Math.random() * 1000);
  const blocker = await listenOnce(preferredPort);

  try {
    const port = await findAvailablePort(preferredPort, '127.0.0.1', 3);
    assert.equal(port, preferredPort + 1);
  } finally {
    await closeServer(blocker);
  }
});
