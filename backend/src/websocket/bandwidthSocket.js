const jwt = require('jsonwebtoken');
const os = require('os');
const { env } = require('../config/env');
const statsService = require('../services/statsService');

let intervalId = null;
let broadcastPromise = null;
const connectionState = new Map();

function serverStats() {
  const totalMemory = os.totalmem();
  return {
    cpuUsage: null,
    cpuStatus: 'unavailable',
    ramUsage: totalMemory ? Math.round(((totalMemory - os.freemem()) / totalMemory) * 100) : null,
    uptime: os.uptime()
  };
}

function emitConnectionTransitions(target, peers) {
  const currentIds = new Set();
  for (const peer of peers) {
    currentIds.add(peer.id);
    const previous = connectionState.get(peer.id);
    if (previous !== undefined && previous !== peer.online) {
      target.emit(peer.online ? 'peer:connected' : 'peer:disconnected', peer.online
        ? { peerId: peer.id, endpoint: peer.endpoint }
        : { peerId: peer.id });
    }
    connectionState.set(peer.id, peer.online);
  }
  for (const id of connectionState.keys()) {
    if (!currentIds.has(id)) connectionState.delete(id);
  }
}

async function buildStatsPayload() {
  return {
    peers: await statsService.getPeersStats(),
    server: serverStats(),
    timestamp: new Date().toISOString()
  };
}

async function sendBandwidthUpdate(target, { transitions = false } = {}) {
  const payload = await buildStatsPayload();
  target.emit('stats:update', payload);
  if (transitions) emitConnectionTransitions(target, payload.peers);
  return payload;
}

function broadcastBandwidthUpdate(io) {
  if (!broadcastPromise) {
    broadcastPromise = sendBandwidthUpdate(io, { transitions: true })
      .catch((error) => { console.error('WebSocket stats update failed:', error.message); })
      .finally(() => { broadcastPromise = null; });
  }
  return broadcastPromise;
}

function initBandwidthSocket(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication error: Bearer token required.'));
    try {
      socket.user = jwt.verify(token, env.JWT_SECRET);
      return next();
    } catch {
      return next(new Error('Authentication error: Invalid or expired token.'));
    }
  });

  io.on('connection', (socket) => {
    sendBandwidthUpdate(socket).catch((error) => {
      console.error('Initial WebSocket stats update failed:', error.message);
    });
  });

  if (!intervalId) {
    intervalId = setInterval(() => {
      if (io.sockets.sockets.size > 0) broadcastBandwidthUpdate(io);
    }, env.STATS_INTERVAL);
    intervalId.unref?.();
  }
}

function stopBandwidthSocket() {
  if (intervalId) clearInterval(intervalId);
  intervalId = null;
  broadcastPromise = null;
  connectionState.clear();
}

module.exports = {
  initBandwidthSocket,
  stopBandwidthSocket,
  serverStats,
  emitConnectionTransitions,
  buildStatsPayload,
  sendBandwidthUpdate,
  broadcastBandwidthUpdate
};
