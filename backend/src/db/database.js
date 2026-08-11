const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { env } = require('../config/env');
const { allocateIp } = require('../services/ipAllocatorService');

let connection;
let transactionQueue = Promise.resolve();

function openDatabase(filename) {
  return new Promise((resolve, reject) => {
    const instance = new sqlite3.Database(filename, (error) => error ? reject(error) : resolve(instance));
  });
}

function rawRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    connection.run(sql, params, function onRun(error) {
      if (error) reject(error);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function rawGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    connection.get(sql, params, (error, row) => error ? reject(error) : resolve(row));
  });
}

function rawAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    connection.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows));
  });
}

async function createPeersTable() {
  await rawRun(`CREATE TABLE peers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    publicKey TEXT NOT NULL UNIQUE,
    privateKeyEncrypted TEXT,
    privateKeyIv TEXT,
    privateKeyAuthTag TEXT,
    allowedIPs TEXT NOT NULL UNIQUE,
    dns TEXT,
    splitTunnel INTEGER NOT NULL DEFAULT 1 CHECK (splitTunnel IN (0, 1)),
    createdAt TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
    rxBytes INTEGER NOT NULL DEFAULT 0,
    txBytes INTEGER NOT NULL DEFAULT 0,
    lastHandshake TEXT,
    endpoint TEXT,
    needsReprovision INTEGER NOT NULL DEFAULT 0 CHECK (needsReprovision IN (0, 1))
  )`);
}

async function migrateLegacyPeers(columns) {
  const columnNames = new Set(columns.map((column) => column.name));
  await rawRun('ALTER TABLE peers RENAME TO peers_legacy');
  await createPeersTable();
  const legacyRows = await rawAll('SELECT * FROM peers_legacy ORDER BY createdAt, id');
  const usedAddresses = [];
  for (const peer of legacyRows) {
    const encryptedComplete = columnNames.has('privateKeyEncrypted') && peer.privateKeyEncrypted
      && peer.privateKeyIv && peer.privateKeyAuthTag;
    let allowedIPs = peer.allowedIPs;
    const duplicateOrInvalid = !allowedIPs || usedAddresses.includes(allowedIPs);
    if (duplicateOrInvalid) {
      allowedIPs = allocateIp({
        subnet: env.WG_SERVER_SUBNET,
        serverAddress: env.WG_SERVER_ADDRESS,
        usedAddresses
      });
    }
    usedAddresses.push(allowedIPs);
    await rawRun(`INSERT INTO peers (
      id, name, publicKey, privateKeyEncrypted, privateKeyIv, privateKeyAuthTag,
      allowedIPs, dns, splitTunnel, createdAt, enabled, rxBytes, txBytes,
      lastHandshake, endpoint, needsReprovision
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      peer.id, peer.name || 'Migrated peer', peer.publicKey,
      encryptedComplete ? peer.privateKeyEncrypted : null,
      encryptedComplete ? peer.privateKeyIv : null,
      encryptedComplete ? peer.privateKeyAuthTag : null,
      allowedIPs, peer.dns || null, peer.splitTunnel === 0 ? 0 : 1,
      peer.createdAt || new Date().toISOString(), peer.enabled === 0 ? 0 : 1,
      Number(peer.rxBytes) || 0, Number(peer.txBytes) || 0,
      peer.lastHandshake || null, peer.endpoint || null,
      encryptedComplete && !duplicateOrInvalid ? 0 : 1
    ]);
  }
  await rawRun('DROP TABLE peers_legacy');
}

async function hasUniqueIndex(columnName) {
  const indexes = await rawAll('PRAGMA index_list(peers)');
  for (const index of indexes.filter((item) => item.unique === 1)) {
    const columns = await rawAll(`PRAGMA index_info(${JSON.stringify(index.name)})`);
    if (columns.length === 1 && columns[0].name === columnName) return true;
  }
  return false;
}

async function peersTableNeedsMigration(columns) {
  const required = [
    'id', 'name', 'publicKey', 'privateKeyEncrypted', 'privateKeyIv', 'privateKeyAuthTag',
    'allowedIPs', 'dns', 'splitTunnel', 'createdAt', 'enabled', 'rxBytes', 'txBytes',
    'lastHandshake', 'endpoint', 'needsReprovision'
  ];
  if (required.some((name) => !columns.some((column) => column.name === name))) return true;
  return !(await hasUniqueIndex('publicKey')) || !(await hasUniqueIndex('allowedIPs'));
}

async function runMigrations() {
  await rawRun('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, appliedAt TEXT NOT NULL)');
  await rawRun(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'viewer'))
  )`);
  const peersTable = await rawGet("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'peers'");
  if (!peersTable) {
    await createPeersTable();
  } else {
    const columns = await rawAll('PRAGMA table_info(peers)');
    if (await peersTableNeedsMigration(columns)) {
      await migrateLegacyPeers(columns);
    }
  }
  await rawRun(`CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actorId TEXT,
    actorUsername TEXT NOT NULL,
    action TEXT NOT NULL,
    peerId TEXT,
    createdAt TEXT NOT NULL,
    success INTEGER NOT NULL,
    detail TEXT
  )`);
  await rawRun('INSERT OR IGNORE INTO schema_migrations (version, appliedAt) VALUES (2, ?)', [new Date().toISOString()]);
}

async function initialize() {
  const directory = path.dirname(env.DB_PATH);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  try {
    connection = await openDatabase(env.DB_PATH);
    await rawRun('PRAGMA foreign_keys = ON');
    await rawRun('PRAGMA busy_timeout = 5000');
    await rawRun('PRAGMA journal_mode = WAL');
    await rawRun('BEGIN IMMEDIATE');
    try {
      await runMigrations();
      await rawRun('COMMIT');
    } catch (error) {
      await rawRun('ROLLBACK');
      throw error;
    }
  } catch (error) {
    throw new Error(`SQLite initialization failed at ${env.DB_PATH}: ${error.message}`);
  }
}

const ready = initialize();

async function run(sql, params = []) { await ready; return rawRun(sql, params); }
async function get(sql, params = []) { await ready; return rawGet(sql, params); }
async function all(sql, params = []) { await ready; return rawAll(sql, params); }

async function withTransaction(callback) {
  await ready;
  const previous = transactionQueue;
  let release;
  transactionQueue = new Promise((resolve) => { release = resolve; });
  await previous;
  try {
    await rawRun('BEGIN IMMEDIATE');
    try {
      const result = await callback({ run: rawRun, get: rawGet, all: rawAll });
      await rawRun('COMMIT');
      return result;
    } catch (error) {
      await rawRun('ROLLBACK');
      throw error;
    }
  } finally {
    release();
  }
}

async function close() {
  await ready;
  return new Promise((resolve, reject) => connection.close((error) => error ? reject(error) : resolve()));
}

module.exports = { ready, run, get, all, withTransaction, close };
