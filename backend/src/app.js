require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const authRoutes = require('./routes/auth');
const peersRoutes = require('./routes/peers');
const statsRoutes = require('./routes/stats');
const { initBandwidthSocket } = require('./websocket/bandwidthSocket');

const app = express();
const port = process.env.PORT || 3000;

// Cấu hình Middleware
app.use(cors({
  origin: '*', // Cho phép mọi origin phục vụ mục đích phát triển local
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Khởi tạo HTTP Server
const server = http.createServer(app);

// Khởi tạo Socket.IO Server
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Liên kết WebSocket handler
initBandwidthSocket(io);

// Đăng ký API Routes
app.use('/api/auth', authRoutes);
app.use('/api/peers', peersRoutes);
app.use('/api/stats', statsRoutes);

// Trạng thái Health Check cơ bản
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    mockMode: process.env.MOCK_WIREGUARD === 'true'
  });
});

// Xử lý Route không tồn tại
app.use((req, res) => {
  res.status(404).json({ message: 'API Endpoint not found.' });
});

// Khởi động server lắng nghe
server.listen(port, () => {
  console.log(`=================================================`);
  console.log(` WireGuard Controller Backend Server is running`);
  console.log(` Port: ${port}`);
  console.log(` Mode: ${process.env.NODE_ENV}`);
  console.log(` WireGuard Mock: ${process.env.MOCK_WIREGUARD === 'true' ? 'ENABLED 🛠️' : 'DISABLED 🛡️'}`);
  console.log(`=================================================`);
});
