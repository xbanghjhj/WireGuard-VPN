const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const { Server } = require('socket.io');
const { env } = require('./config/env');
const db = require('./db/database');
const authRoutes = require('./routes/auth');
const peersRoutes = require('./routes/peers');
const statsRoutes = require('./routes/stats');
const { apiRateLimiter } = require('./middleware/rateLimiters');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { initBandwidthSocket } = require('./websocket/bandwidthSocket');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }));
  app.use(express.json({ limit: '64kb' }));
  app.use('/api', apiRateLimiter);
  app.use('/api/auth', authRoutes);
  app.use('/api/peers', peersRoutes);
  app.use('/api/stats', statsRoutes);
  app.get('/health', (req, res) => res.json({ status: 'UP', timestamp: new Date().toISOString(), mockMode: env.MOCK_WIREGUARD }));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

function createServer() {
  const app = createApp();
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: env.CORS_ORIGIN, methods: ['GET', 'POST'] } });
  initBandwidthSocket(io);
  return { app, server, io };
}

async function start() {
  await db.ready;
  const { server } = createServer();
  server.listen(env.PORT, () => {
    console.log(`WireGuard Controller listening on port ${env.PORT} (${env.MOCK_WIREGUARD ? 'MOCK - configs are not usable' : 'REAL'})`);
  });
  return server;
}

if (require.main === module) {
  start().catch((error) => { console.error(`Startup failed: ${error.message}`); process.exitCode = 1; });
}

module.exports = { createApp, createServer, start };
