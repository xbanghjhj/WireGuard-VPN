const crypto = require('crypto');
const { env } = require('../config/env');

function getKey() {
  const value = env.PEER_KEY_ENCRYPTION_KEY;
  return /^[a-fA-F0-9]{64}$/.test(value) ? Buffer.from(value, 'hex') : Buffer.from(value, 'base64');
}

function encryptPrivateKey(privateKey) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(privateKey, 'utf8'), cipher.final()]);
  return {
    privateKeyEncrypted: encrypted.toString('base64'),
    privateKeyIv: iv.toString('base64'),
    privateKeyAuthTag: cipher.getAuthTag().toString('base64')
  };
}

function decryptPrivateKey(peer) {
  if (!peer.privateKeyEncrypted || !peer.privateKeyIv || !peer.privateKeyAuthTag) {
    const error = new Error('Peer must be reprovisioned before its configuration can be downloaded.');
    error.status = 409;
    throw error;
  }
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(peer.privateKeyIv, 'base64'));
  decipher.setAuthTag(Buffer.from(peer.privateKeyAuthTag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(peer.privateKeyEncrypted, 'base64')),
    decipher.final()
  ]).toString('utf8');
}

module.exports = { encryptPrivateKey, decryptPrivateKey };
