const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const { env } = require('../src/config/env');
const db = require('../src/db/database');
const wireguardService = require('../src/services/wireguardService');
const { createApp } = require('../src/app');

const app = createApp();
let adminToken;
let viewerToken;

async function addUser(username, password, role) {
  const hash = await bcrypt.hash(password, 4);
  const result = await db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [username, hash, role]);
  return result.lastID;
}

describe('authenticated peer API', () => {
  beforeAll(async () => {
    await db.ready;
    fs.mkdirSync(process.env.TEST_RUNTIME_DIR, { recursive: true });
    fs.writeFileSync(env.WG_SERVER_PRIVATE_KEY_PATH, 'mock-server-private\n', { mode: 0o600 });
    fs.writeFileSync(env.WG_SERVER_PUBLIC_KEY_PATH, 'mock-server-public\n', { mode: 0o644 });
    await db.run('DELETE FROM audit_logs');
    await db.run('DELETE FROM peers');
    await db.run('DELETE FROM users');
    const adminId = await addUser('admin-user', 'Admin-Password-123!', 'admin');
    const viewerId = await addUser('viewer-user', 'Viewer-Password-123!', 'viewer');
    adminToken = jwt.sign({ id: adminId, username: 'admin-user', role: 'admin' }, env.JWT_SECRET);
    viewerToken = jwt.sign({ id: viewerId, username: 'viewer-user', role: 'viewer' }, env.JWT_SECRET);
  });

  beforeEach(async () => {
    await db.run('DELETE FROM audit_logs');
    await db.run('DELETE FROM peers');
  });

  afterAll(async () => {
    await db.close();
  });

  test('authentication accepts valid credentials and rejects invalid credentials', async () => {
    await request(app).post('/api/auth/login').send({ username: 'admin-user', password: 'wrong' }).expect(401);
    const response = await request(app).post('/api/auth/login')
      .send({ username: 'admin-user', password: 'Admin-Password-123!' }).expect(200);
    expect(response.body.token).toEqual(expect.any(String));
    expect(response.body.user.role).toBe('admin');
  });

  test('viewer can read safe peers but cannot mutate or retrieve config/QR', async () => {
    await request(app).get('/api/peers').set('Authorization', `Bearer ${viewerToken}`).expect(200);
    await request(app).post('/api/peers').set('Authorization', `Bearer ${viewerToken}`)
      .send({ name: 'Denied', splitTunnel: true }).expect(403);
    await request(app).get('/api/peers/peer_aaaaaaaaaaaa/config')
      .set('Authorization', `Bearer ${viewerToken}`).expect(403);
    await request(app).get('/api/peers/peer_aaaaaaaaaaaa/qrcode')
      .set('Authorization', `Bearer ${viewerToken}`).expect(403);
  });

  test('admin creates split and full tunnel peers and receives only safe DTOs', async () => {
    const split = await request(app).post('/api/peers').set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Split laptop', dns: '1.1.1.1, 8.8.8.8', splitTunnel: true }).expect(201);
    const full = await request(app).post('/api/peers').set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Full laptop', splitTunnel: false }).expect(201);

    expect(split.body.allowedIPs).toBe('10.99.0.2/32');
    expect(full.body.allowedIPs).toBe('10.99.0.3/32');
    for (const body of [split.body, full.body]) {
      expect(body).not.toHaveProperty('privateKey');
      expect(body).not.toHaveProperty('privateKeyEncrypted');
    }

    const splitConfig = await request(app).get(`/api/peers/${split.body.id}/config`)
      .set('Authorization', `Bearer ${adminToken}`).expect(200);
    const fullConfig = await request(app).get(`/api/peers/${full.body.id}/config`)
      .set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(splitConfig.text).toContain(`AllowedIPs = ${env.WG_CLIENT_ALLOWED_IPS}`);
    expect(fullConfig.text).toContain('AllowedIPs = 0.0.0.0/0, ::/0');

    const detail = await request(app).get(`/api/peers/${split.body.id}`)
      .set('Authorization', `Bearer ${viewerToken}`).expect(200);
    expect(detail.body.splitTunnel).toBe(true);
    expect(detail.body).not.toHaveProperty('privateKeyEncrypted');
  });

  test('concurrent creates receive distinct addresses and pool exhaustion returns 409', async () => {
    const create = (name) => request(app).post('/api/peers').set('Authorization', `Bearer ${adminToken}`)
      .send({ name, splitTunnel: true });
    const [first, second] = await Promise.all([create('Concurrent A'), create('Concurrent B')]);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body.allowedIPs).not.toBe(second.body.allowedIPs);
    await create('Three').expect(201);
    await create('Four').expect(201);
    await create('Five').expect(201);
    await create('Exhausted').expect(409);
  });

  test('enable, disable and delete synchronize state', async () => {
    const created = await request(app).post('/api/peers').set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Lifecycle', splitTunnel: true }).expect(201);
    const disabled = await request(app).patch(`/api/peers/${created.body.id}`).set('Authorization', `Bearer ${adminToken}`)
      .send({ enabled: false }).expect(200);
    expect(disabled.body.enabled).toBe(false);
    const enabled = await request(app).patch(`/api/peers/${created.body.id}`).set('Authorization', `Bearer ${adminToken}`)
      .send({ enabled: true }).expect(200);
    expect(enabled.body.enabled).toBe(true);
    await request(app).delete(`/api/peers/${created.body.id}`).set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(await db.get('SELECT id FROM peers WHERE id = ?', [created.body.id])).toBeUndefined();
  });

  test('WireGuard synchronization failure rolls back database and returns a clear error', async () => {
    const before = await db.get('SELECT COUNT(*) AS count FROM peers');
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
    const sync = jest.spyOn(wireguardService, 'syncWireGuardConfig')
      .mockRejectedValueOnce(new Error('simulated syncconf failure'));
    const response = await request(app).post('/api/peers').set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Rollback', splitTunnel: true }).expect(502);
    sync.mockRestore();
    errorLog.mockRestore();
    const after = await db.get('SELECT COUNT(*) AS count FROM peers');
    expect(after.count).toBe(before.count);
    expect(response.body.message).toMatch(/rolled back/i);
  });

  test('database migration created encrypted-key columns, uniqueness and audit schema', async () => {
    const columns = await db.all('PRAGMA table_info(peers)');
    expect(columns.map((column) => column.name)).toEqual(expect.arrayContaining([
      'privateKeyEncrypted', 'privateKeyIv', 'privateKeyAuthTag', 'splitTunnel', 'needsReprovision'
    ]));
    const indexes = await db.all('PRAGMA index_list(peers)');
    expect(indexes.filter((index) => index.unique === 1).length).toBeGreaterThanOrEqual(2);
    expect(await db.get('SELECT version FROM schema_migrations WHERE version = 2')).toEqual({ version: 2 });
    expect(await db.all('PRAGMA table_info(audit_logs)')).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'actorUsername' }), expect.objectContaining({ name: 'success' })
    ]));
  });
});
