const { getPublicIp, readRuntimeState, writeClientEnvFile } = require('./portUtils');

(async () => {
  console.log('Fetching public IP...');
  const ip = await getPublicIp();
  const runtimeState = readRuntimeState();
  const port = runtimeState.backendPort || process.env.PORT || 3001;
  writeClientEnvFile(port, ip);
  console.log(`Updated client/.env with VITE_SERVER_URL=http://${ip || 'localhost'}:${port}`);
})().catch((error) => {
  console.error('Failed to refresh client env file:', error.message);
  process.exit(1);
});