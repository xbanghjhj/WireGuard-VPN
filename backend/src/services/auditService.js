const db = require('../db/database');

function writeAudit({ user, action, peerId = null, success, detail = null }, client = db) {
  const safeDetail = detail
    ? String(detail).replace(/[A-Za-z0-9+/]{42,44}={0,2}/g, '[REDACTED]').slice(0, 300)
    : null;
  return client.run(`INSERT INTO audit_logs
    (actorId, actorUsername, action, peerId, createdAt, success, detail)
    VALUES (?, ?, ?, ?, ?, ?, ?)`, [
    user?.id ? String(user.id) : null, user?.username || 'system', action, peerId,
    new Date().toISOString(), success ? 1 : 0, safeDetail
  ]);
}

module.exports = { writeAudit };
