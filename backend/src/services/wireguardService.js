const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('../db/database');
const { env } = require('../config/env');
const commandRunner = require('./commandRunner');

function renderServerConfig(privateKey, peers) {
  const mockWarning = env.MOCK_WIREGUARD ? '# MOCK CONFIGURATION - NOT FOR REAL VPN USE\n' : '';
  const peerBlocks = peers.map((peer) => `# Client: ${String(peer.name).replace(/[\r\n#]/g, ' ')} (${peer.id})
[Peer]
PublicKey = ${peer.publicKey}
AllowedIPs = ${peer.allowedIPs}
`).join('\n');
  return `${mockWarning}[Interface]
PrivateKey = ${privateKey}
Address = ${env.WG_SERVER_ADDRESS}
ListenPort = ${env.WG_SERVER_PORT}

${peerBlocks}`;
}

function parseRuntimePublicKeys(dump) {
  return dump.trim().split('\n').slice(1).filter(Boolean).map((line) => line.split('\t')[0]);
}

async function interfaceExists(runner) {
  const result = await runner.runFile('wg', ['show', 'interfaces']);
  return result.stdout.trim().split(/\s+/).includes(env.WG_INTERFACE);
}

async function syncWireGuardConfig(options = {}) {
  const runner = options.runner || commandRunner;
  const dbClient = options.dbClient || db;
  const peers = await dbClient.all('SELECT id, name, publicKey, allowedIPs FROM peers WHERE enabled = 1');
  const privateKey = fs.readFileSync(env.WG_SERVER_PRIVATE_KEY_PATH, 'utf8').trim();
  const directory = path.dirname(env.WG_CONFIG_PATH);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const suffix = `${process.pid}-${crypto.randomBytes(6).toString('hex')}`;
  const candidatePath = path.join(directory, `.${path.basename(env.WG_CONFIG_PATH)}.${suffix}.tmp`);
  const strippedPath = path.join(directory, `.wg-stripped.${suffix}.tmp`);
  const previous = fs.existsSync(env.WG_CONFIG_PATH) ? fs.readFileSync(env.WG_CONFIG_PATH) : null;
  fs.writeFileSync(candidatePath, renderServerConfig(privateKey, peers), { mode: 0o600, flag: 'wx' });

  try {
    if (env.MOCK_WIREGUARD) {
      fs.renameSync(candidatePath, env.WG_CONFIG_PATH);
      fs.chmodSync(env.WG_CONFIG_PATH, 0o600);
      return { applied: false, mock: true, peerCount: peers.length };
    }

    const stripped = await runner.runFile('wg-quick', ['strip', candidatePath]);
    fs.writeFileSync(strippedPath, stripped.stdout, { mode: 0o600, flag: 'wx' });
    fs.renameSync(candidatePath, env.WG_CONFIG_PATH);
    fs.chmodSync(env.WG_CONFIG_PATH, 0o600);

    if (await interfaceExists(runner)) {
      await runner.runFile('wg', ['syncconf', env.WG_INTERFACE, strippedPath]);
    } else {
      await runner.runFile('wg-quick', ['up', env.WG_CONFIG_PATH]);
    }

    const dump = await runner.runFile('wg', ['show', env.WG_INTERFACE, 'dump']);
    const actual = new Set(parseRuntimePublicKeys(dump.stdout));
    const expected = new Set(peers.map((peer) => peer.publicKey));
    if (actual.size !== expected.size || [...expected].some((key) => !actual.has(key))) {
      throw new Error('WireGuard runtime verification did not match the enabled peer set.');
    }
    return { applied: true, mock: false, peerCount: peers.length };
  } catch (error) {
    if (previous) {
      const restorePath = `${candidatePath}.restore`;
      fs.writeFileSync(restorePath, previous, { mode: 0o600 });
      fs.renameSync(restorePath, env.WG_CONFIG_PATH);
    } else if (fs.existsSync(env.WG_CONFIG_PATH)) {
      fs.unlinkSync(env.WG_CONFIG_PATH);
    }
    throw error;
  } finally {
    for (const temporaryPath of [candidatePath, strippedPath]) {
      try { if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath); } catch { /* best effort */ }
    }
  }
}

module.exports = { renderServerConfig, parseRuntimePublicKeys, syncWireGuardConfig };
