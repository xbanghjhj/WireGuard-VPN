const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { env } = require('../config/env');
const commandRunner = require('./commandRunner');

async function generateKeyPair(runner = commandRunner) {
  if (env.MOCK_WIREGUARD) {
    return {
      privateKey: crypto.randomBytes(32).toString('base64'),
      publicKey: crypto.randomBytes(32).toString('base64'),
      mock: true
    };
  }
  const privateResult = await runner.runFile('wg', ['genkey']);
  const privateKey = privateResult.stdout.trim();
  const publicResult = await runner.runFile('wg', ['pubkey'], { input: `${privateKey}\n` });
  return { privateKey, publicKey: publicResult.stdout.trim(), mock: false };
}

async function ensureServerKeyPair(runner = commandRunner) {
  const privatePath = env.WG_SERVER_PRIVATE_KEY_PATH;
  const publicPath = env.WG_SERVER_PUBLIC_KEY_PATH;
  fs.mkdirSync(path.dirname(privatePath), { recursive: true, mode: 0o700 });
  fs.mkdirSync(path.dirname(publicPath), { recursive: true, mode: 0o700 });
  if (!fs.existsSync(privatePath)) {
    const pair = await generateKeyPair(runner);
    fs.writeFileSync(privatePath, `${pair.privateKey}\n`, { mode: 0o600, flag: 'wx' });
    fs.writeFileSync(publicPath, `${pair.publicKey}\n`, { mode: 0o644 });
  } else if (!fs.existsSync(publicPath)) {
    const privateKey = fs.readFileSync(privatePath, 'utf8').trim();
    if (env.MOCK_WIREGUARD) throw new Error('Mock server public key is missing; rotate the mock server key pair.');
    const result = await runner.runFile('wg', ['pubkey'], { input: `${privateKey}\n` });
    fs.writeFileSync(publicPath, `${result.stdout.trim()}\n`, { mode: 0o644 });
  }
  fs.chmodSync(privatePath, 0o600);
  return {
    privateKey: fs.readFileSync(privatePath, 'utf8').trim(),
    publicKey: fs.readFileSync(publicPath, 'utf8').trim()
  };
}

module.exports = { generateKeyPair, ensureServerKeyPair };
