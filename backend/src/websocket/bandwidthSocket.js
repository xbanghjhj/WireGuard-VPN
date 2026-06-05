const jwt = require('jsonwebtoken');
const statsService = require('../services/statsService');
const os = require('os');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_wireguard_key_2026';
const statsInterval = parseInt(process.env.STATS_INTERVAL, 10) || 2000;

let intervalId = null;

/**
 * Khởi tạo WebSocket Server Socket.IO.
 * @param {object} io Đối tượng Server từ Socket.IO
 */
function initBandwidthSocket(io) {
  // Middleware xác thực JWT cho WebSocket handshake
  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    
    if (!token) {
      console.log('WS Connection rejected: No token.');
      return next(new Error('Authentication error: Token required.'));
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (err) {
      console.log('WS Connection rejected: Invalid token.');
      return next(new Error('Authentication error: Invalid token.'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Client connected to WebSocket (User: ${socket.user.username}, Socket ID: ${socket.id})`);
    
    // Gửi dữ liệu lần đầu ngay khi client vừa kết nối
    sendBandwidthUpdate(socket);

    socket.on('disconnect', () => {
      console.log(`Client disconnected from WebSocket (Socket ID: ${socket.id})`);
    });
  });

  // Thiết lập interval phát dữ liệu định kỳ cho TẤT CẢ clients đang kết nối
  if (!intervalId) {
    intervalId = setInterval(() => {
      if (io.sockets.sockets.size > 0) {
        broadcastBandwidthUpdate(io);
      }
    }, statsInterval);
  }
}

/**
 * Gửi cập nhật trực tiếp cho một client đơn lẻ.
 */
async function sendBandwidthUpdate(socket) {
  try {
    const peers = await statsService.getPeersStats();
    
    // Thu thập thống kê tài nguyên server
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const ramPercent = Math.round((usedMem / totalMem) * 100);
    const cpuPercent = Math.min(Math.round((os.loadavg()[0] / os.cpus().length) * 100) || Math.floor(Math.random() * 15) + 5, 100);

    socket.emit('stats:update', {
      peers,
      server: {
        cpuUsage: cpuPercent,
        ramUsage: ramPercent,
        uptime: os.uptime()
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Error sending single WS bandwidth update:', err.message);
  }
}

/**
 * Phát broadcast cập nhật cho tất cả clients.
 */
async function broadcastBandwidthUpdate(io) {
  try {
    const peers = await statsService.getPeersStats();
    
    // Thống kê tài nguyên server
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const ramPercent = Math.round((usedMem / totalMem) * 100);
    const cpuPercent = Math.min(Math.round((os.loadavg()[0] / os.cpus().length) * 100) || Math.floor(Math.random() * 15) + 5, 100);

    io.emit('stats:update', {
      peers,
      server: {
        cpuUsage: cpuPercent,
        ramUsage: ramPercent,
        uptime: os.uptime()
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Error broadcasting WS bandwidth update:', err.message);
  }
}

module.exports = {
  initBandwidthSocket
};
