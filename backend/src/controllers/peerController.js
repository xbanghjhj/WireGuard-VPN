const crypto = require('crypto');
const db = require('../db/database');
const { env } = require('../config/env');
const keyService = require('../services/keyService');
const qrService = require('../services/qrService');
const wireguardService = require('../services/wireguardService');
const iptablesService = require('../services/iptablesService');
const statsService = require('../services/statsService');
const auditService = require('../services/auditService');
const { encryptPrivateKey, decryptPrivateKey } = require('../services/peerKeyCryptoService');
const { allocateIp, withAllocationLock } = require('../services/ipAllocatorService');

const SAFE_COLUMNS = `id, name, publicKey, allowedIPs, dns, splitTunnel, createdAt, enabled,
  rxBytes, txBytes, lastHandshake, endpoint, needsReprovision`;

function peerDto(peer) {
  return statsService.safePeerDto(peer);
}

async function recordFailure(req, action, peerId, error) {
  try {
    await auditService.writeAudit({ user: req.user, action, peerId, success: false, detail: error.message });
  } catch { /* an audit failure must not hide the original failure */ }
}

async function mutateAndSync(req, action, peerId, mutation) {
  try {
    return await db.withTransaction(async (tx) => {
      const result = await mutation(tx);
      await wireguardService.syncWireGuardConfig({ dbClient: tx });
      await auditService.writeAudit({ user: req.user, action, peerId: result.id || peerId, success: true }, tx);
      return result;
    });
  } catch (error) {
    try { await wireguardService.syncWireGuardConfig(); } catch { /* best-effort runtime restore */ }
    await recordFailure(req, action, peerId, error);
    if (!error.status) {
      error.status = 502;
      error.publicMessage = 'WireGuard synchronization failed; the database change was rolled back.';
    }
    throw error;
  }
}

async function getPeers(req, res, next) {
  try { return res.json(await statsService.getPeersStats()); } catch (error) { return next(error); }
}

async function getPeerById(req, res, next) {
  try {
    const peer = await db.get(`SELECT ${SAFE_COLUMNS} FROM peers WHERE id = ?`, [req.params.id]);
    if (!peer) return res.status(404).json({ message: 'Peer not found.' });
    return res.json(peerDto(peer));
  } catch (error) { return next(error); }
}

async function createPeer(req, res, next) {
  let createdId = null;
  try {
    const keys = await keyService.generateKeyPair();
    const encrypted = encryptPrivateKey(keys.privateKey);
    const created = await withAllocationLock(() => mutateAndSync(req, 'peer.create', null, async (tx) => {
      const existing = await tx.all('SELECT allowedIPs FROM peers');
      const allowedIPs = allocateIp({
        subnet: env.WG_SERVER_SUBNET,
        serverAddress: env.WG_SERVER_ADDRESS,
        usedAddresses: existing.map((peer) => peer.allowedIPs)
      });
      const id = `peer_${crypto.randomBytes(12).toString('hex')}`;
      createdId = id;
      const createdAt = new Date().toISOString();
      const splitTunnel = req.body.splitTunnel === false ? 0 : 1;
      const dns = req.body.dns || '1.1.1.1, 8.8.8.8';
      await tx.run(`INSERT INTO peers (
        id, name, publicKey, privateKeyEncrypted, privateKeyIv, privateKeyAuthTag,
        allowedIPs, dns, splitTunnel, createdAt, enabled, rxBytes, txBytes, needsReprovision
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 0, 0)`, [
        id, req.body.name, keys.publicKey, encrypted.privateKeyEncrypted, encrypted.privateKeyIv,
        encrypted.privateKeyAuthTag, allowedIPs, dns, splitTunnel, createdAt
      ]);
      return { id, name: req.body.name, publicKey: keys.publicKey, allowedIPs, dns,
        splitTunnel: splitTunnel === 1, createdAt, enabled: true, needsReprovision: false,
        online: false, rxBytes: 0, txBytes: 0, rxFormatted: '0 B', txFormatted: '0 B',
        lastHandshake: null, endpoint: null };
    }));
    return res.status(201).json(created);
  } catch (error) {
    if (error.code?.startsWith('SQLITE_CONSTRAINT')) error.status = 409;
    if (createdId) error.peerId = createdId;
    return next(error);
  }
}

async function updatePeer(req, res, next) {
  try {
    const result = await mutateAndSync(req, req.body.enabled ? 'peer.enable' : 'peer.disable', req.params.id, async (tx) => {
      const peer = await tx.get(`SELECT ${SAFE_COLUMNS} FROM peers WHERE id = ?`, [req.params.id]);
      if (!peer) { const error = new Error('Peer not found.'); error.status = 404; throw error; }
      await tx.run('UPDATE peers SET enabled = ? WHERE id = ?', [req.body.enabled ? 1 : 0, req.params.id]);
      return { ...peerDto(peer), enabled: req.body.enabled };
    });
    try {
      if (req.body.enabled) await iptablesService.unblockClientIP(result.allowedIPs);
      else await iptablesService.blockClientIP(result.allowedIPs);
    } catch (error) { console.error('Supplementary firewall rule failed:', error.message); }
    return res.json(result);
  } catch (error) { return next(error); }
}

async function deletePeer(req, res, next) {
  try {
    const deleted = await mutateAndSync(req, 'peer.delete', req.params.id, async (tx) => {
      const peer = await tx.get(`SELECT ${SAFE_COLUMNS} FROM peers WHERE id = ?`, [req.params.id]);
      if (!peer) { const error = new Error('Peer not found.'); error.status = 404; throw error; }
      await tx.run('DELETE FROM peers WHERE id = ?', [req.params.id]);
      return peerDto(peer);
    });
    try { await iptablesService.unblockClientIP(deleted.allowedIPs); } catch (error) {
      console.error('Supplementary firewall cleanup failed:', error.message);
    }
    return res.json({ message: 'Peer deleted successfully.', id: deleted.id });
  } catch (error) { return next(error); }
}

async function getPeerConfig(peerId) {
  const peer = await db.get(`SELECT ${SAFE_COLUMNS}, privateKeyEncrypted, privateKeyIv, privateKeyAuthTag
    FROM peers WHERE id = ?`, [peerId]);
  if (!peer) { const error = new Error('Peer not found.'); error.status = 404; throw error; }
  return { peer, content: qrService.generateClientConfig(peer, decryptPrivateKey(peer)) };
}

async function downloadPeerConfig(req, res, next) {
  try {
    const { peer, content } = await getPeerConfig(req.params.id);
    await auditService.writeAudit({ user: req.user, action: 'peer.config.download', peerId: peer.id, success: true });
    const filename = peer.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.conf"`);
    res.type('text/plain').send(content);
  } catch (error) { await recordFailure(req, 'peer.config.download', req.params.id, error); return next(error); }
}

async function getPeerQRCode(req, res, next) {
  try {
    const { peer, content } = await getPeerConfig(req.params.id);
    const qrCode = await qrService.generateQRCodeBase64(content);
    await auditService.writeAudit({ user: req.user, action: 'peer.qrcode.view', peerId: peer.id, success: true });
    return res.json({ qrCode });
  } catch (error) { await recordFailure(req, 'peer.qrcode.view', req.params.id, error); return next(error); }
}

module.exports = { getPeers, getPeerById, createPeer, updatePeer, deletePeer, downloadPeerConfig, getPeerQRCode };
