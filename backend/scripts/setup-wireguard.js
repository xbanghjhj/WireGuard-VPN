const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { env } = require('../src/config/env');
const db = require('../src/db/database');
const commandRunner = require('../src/services/commandRunner');
const keyService = require('../src/services/keyService');
const wireguardService = require('../src/services/wireguardService');

function assertArguments(argv) {
  const unknown = argv.filter((item) => item !== '--apply');
  if (unknown.length) throw new Error(`Unknown setup option: ${unknown.join(', ')}`);
  return argv.includes('--apply');
}

function assertStrongPassword(password) {
  const categories = [/[a-z]/, /[A-Z]/, /\d/, /[^a-zA-Z0-9]/].filter((pattern) => pattern.test(password)).length;
  if (password.length < 12 || categories < 3) {
    throw new Error('ADMIN_PASSWORD must be at least 12 characters and use at least three character categories.');
  }
}

async function createValidatedConfig(runner = commandRunner) {
  const keys = await keyService.ensureServerKeyPair(runner);
  const peers = await db.all('SELECT id, name, publicKey, allowedIPs FROM peers WHERE enabled = 1');
  const directory = path.dirname(env.WG_CONFIG_PATH);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const temporaryPath = path.join(directory, `.${path.basename(env.WG_CONFIG_PATH)}.${process.pid}-${crypto.randomBytes(4).toString('hex')}.tmp`);
  fs.writeFileSync(temporaryPath, wireguardService.renderServerConfig(keys.privateKey, peers), { mode: 0o600, flag: 'wx' });
  try {
    if (!env.MOCK_WIREGUARD) await runner.runFile('wg-quick', ['strip', temporaryPath]);
    fs.renameSync(temporaryPath, env.WG_CONFIG_PATH);
    fs.chmodSync(env.WG_CONFIG_PATH, 0o600);
  } finally {
    if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
  }
}

async function ensureAdmin() {
  assertStrongPassword(env.ADMIN_PASSWORD);
  const existing = await db.get('SELECT id FROM users WHERE username = ?', [env.ADMIN_USERNAME]);
  if (existing) return false;
  const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 12);
  await db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [
    env.ADMIN_USERNAME, passwordHash, 'admin'
  ]);
  return true;
}

async function checkIpForwarding(runner = commandRunner) {
  if (env.MOCK_WIREGUARD) return { enabled: null, mock: true };
  const result = await runner.runFile('sysctl', ['-n', 'net.ipv4.ip_forward']);
  return { enabled: result.stdout.trim() === '1', mock: false };
}

async function runSetup(argv = process.argv.slice(2), runner = commandRunner) {
  const apply = assertArguments(argv);
  await db.ready;
  const forwarding = await checkIpForwarding(runner);
  if (apply && forwarding.enabled === false) {
    throw new Error('net.ipv4.ip_forward is disabled; enable it before using --apply.');
  }
  await createValidatedConfig(runner);
  const adminCreated = await ensureAdmin();
  if (apply) await wireguardService.syncWireGuardConfig({ runner });

  console.log(`Setup complete (${env.MOCK_WIREGUARD ? 'MOCK - generated configs cannot connect a VPN' : 'REAL'} mode).`);
  console.log(`Interface apply: ${apply ? 'requested' : 'not requested; run again with --apply after review'}.`);
  console.log(`IP forwarding: ${forwarding.mock ? 'not checked in mock mode' : forwarding.enabled ? 'enabled' : 'DISABLED'}.`);
  console.log(`Admin account: ${adminCreated ? 'created' : 'already exists'}.`);
  console.log('No firewall rules were changed.');
  return { apply, forwarding, adminCreated };
}

if (require.main === module) {
  runSetup()
    .then(() => db.close())
    .catch(async (error) => {
      console.error(`Setup failed: ${error.message}`);
      try { await db.close(); } catch { /* initialization may have failed */ }
      process.exitCode = 1;
    });
}

module.exports = { runSetup, assertArguments, assertStrongPassword, createValidatedConfig, ensureAdmin, checkIpForwarding };
