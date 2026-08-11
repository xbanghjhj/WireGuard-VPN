const db = require('../db/database');
const { env } = require('../config/env');
const commandRunner = require('./commandRunner');

const runtimeCache = new Map();
let pollPromise = null;
let lastPersistAt = 0;

function parseWgDump(output) {
  const lines = String(output).trim().split('\n').filter(Boolean);
  const peers = new Map();
  for (const line of lines.slice(1)) {
    const parts = line.split('\t');
    if (parts.length < 8) continue;
    const handshake = Number(parts[4]);
    peers.set(parts[0], {
      endpoint: parts[2] === '(none)' ? null : parts[2],
      lastHandshake: handshake > 0 ? new Date(handshake * 1000).toISOString() : null,
      rxBytes: Number(parts[5]) || 0,
      txBytes: Number(parts[6]) || 0
    });
  }
  return peers;
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${parseFloat((bytes / (1024 ** index)).toFixed(2))} ${units[index]}`;
}

function safePeerDto(peer, stats = {}) {
  const rxBytes = Number(stats.rxBytes ?? peer.rxBytes) || 0;
  const txBytes = Number(stats.txBytes ?? peer.txBytes) || 0;
  const lastHandshake = stats.lastHandshake ?? peer.lastHandshake ?? null;
  const online = peer.enabled === 1 && Boolean(lastHandshake)
    && Date.now() - new Date(lastHandshake).getTime() < 300000;
  return {
    id: peer.id, name: peer.name, publicKey: peer.publicKey, allowedIPs: peer.allowedIPs,
    dns: peer.dns, splitTunnel: peer.splitTunnel === 1, createdAt: peer.createdAt,
    enabled: peer.enabled === 1, needsReprovision: peer.needsReprovision === 1,
    online, rxBytes, txBytes, rxFormatted: formatBytes(rxBytes), txFormatted: formatBytes(txBytes),
    lastHandshake, endpoint: stats.endpoint ?? peer.endpoint ?? null
  };
}

async function persistStats(peers) {
  if (Date.now() - lastPersistAt < env.STATS_PERSIST_INTERVAL) return;
  lastPersistAt = Date.now();
  await db.withTransaction(async (tx) => {
    for (const peer of peers) {
      await tx.run('UPDATE peers SET rxBytes = ?, txBytes = ?, lastHandshake = ?, endpoint = ? WHERE id = ?', [
        peer.rxBytes, peer.txBytes, peer.lastHandshake, peer.endpoint, peer.id
      ]);
    }
  });
}

async function collect(runner) {
  const peers = await db.all(`SELECT id, name, publicKey, allowedIPs, dns, splitTunnel, createdAt,
    enabled, rxBytes, txBytes, lastHandshake, endpoint, needsReprovision FROM peers`);
  if (env.MOCK_WIREGUARD) {
    const result = peers.map((peer) => {
      const cached = runtimeCache.get(peer.id) || { rxBytes: peer.rxBytes, txBytes: peer.txBytes };
      if (peer.enabled === 1) {
        cached.rxBytes += Math.floor(Math.random() * 100000);
        cached.txBytes += Math.floor(Math.random() * 50000);
        cached.lastHandshake = new Date().toISOString();
        cached.endpoint = null;
      }
      runtimeCache.set(peer.id, cached);
      return safePeerDto(peer, cached);
    });
    await persistStats(result);
    return result;
  }
  try {
    const result = await runner.runFile('wg', ['show', env.WG_INTERFACE, 'dump']);
    const parsed = parseWgDump(result.stdout);
    const safePeers = peers.map((peer) => safePeerDto(peer, parsed.get(peer.publicKey)));
    await persistStats(safePeers);
    return safePeers;
  } catch (error) {
    return peers.map((peer) => safePeerDto(peer));
  }
}

function getPeersStats(runner = commandRunner) {
  if (!pollPromise) pollPromise = collect(runner).finally(() => { pollPromise = null; });
  return pollPromise;
}

module.exports = { parseWgDump, formatBytes, safePeerDto, getPeersStats };
