# 🛡️ WireGuard VPN Controller & Web Dashboard

> Hệ thống quản lý VPN doanh nghiệp hiện đại — cấp phát, giám sát và điều phối kết nối WireGuard qua giao diện Web trực quan.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-green.svg)
![WireGuard](https://img.shields.io/badge/WireGuard-v1.0%2B-orange.svg)
![Platform](https://img.shields.io/badge/platform-Linux-lightgrey.svg)

---

## 📋 Mục lục

- [Tổng quan dự án](#-tổng-quan-dự-án)
- [Kiến trúc hệ thống](#-kiến-trúc-hệ-thống)
- [Tính năng](#-tính-năng)
- [Công nghệ sử dụng](#-công-nghệ-sử-dụng)
- [Yêu cầu hệ thống](#-yêu-cầu-hệ-thống)
- [Cài đặt & Khởi chạy](#-cài-đặt--khởi-chạy)
- [Cấu trúc thư mục](#-cấu-trúc-thư-mục)
- [API Reference](#-api-reference)
- [WebSocket Events](#-websocket-events)
- [Biến môi trường](#-biến-môi-trường)
- [Hướng dẫn sử dụng](#-hướng-dẫn-sử-dụng)
- [Môi trường phát triển & Test](#-môi-trường-phát-triển--test)
- [Deployment lên Production](#-deployment-lên-production)
- [Kiến thức nền tảng](#-kiến-thức-nền-tảng)
- [Roadmap](#-roadmap)
- [Đóng góp](#-đóng-góp)

---

## 🎯 Tổng quan dự án

**WireGuard VPN Controller** là một giải pháp quản lý VPN toàn diện cho doanh nghiệp, cho phép quản trị viên:

- Tạo và quản lý tài khoản VPN cho từng nhân viên/thiết bị
- Giám sát lưu lượng băng thông theo thời gian thực
- Tạo file cấu hình `.conf` và mã QR để kết nối từ điện thoại
- Kiểm soát quyền truy cập mạng nội bộ qua Firewall/iptables

WireGuard được chọn vì đây là giao thức VPN **nhanh nhất, bảo mật nhất** hiện nay — sử dụng mã hóa ChaCha20, Poly1305, Curve25519 — vượt trội hoàn toàn so với OpenVPN hay IPSec cũ kỹ.

---

## 🏗️ Kiến trúc hệ thống

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT DEVICES                           │
│   [Laptop/PC]        [Android/iOS]        [Remote Server]       │
│   WireGuard App      WireGuard App        WireGuard CLI          │
└────────────┬─────────────────┬────────────────────┬────────────┘
             │  UDP (51820)    │  UDP (51820)        │
             ▼                 ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                    VPN SERVER (Linux)                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              WireGuard Kernel Module                      │   │
│  │         Interface: wg0 (10.0.0.1/24)                     │   │
│  └──────────────────────┬───────────────────────────────────┘   │
│                          │                                       │
│  ┌──────────────────────▼───────────────────────────────────┐   │
│  │              iptables / nftables                          │   │
│  │   NAT Masquerade, Port Forward, Access Control           │   │
│  └──────────────────────┬───────────────────────────────────┘   │
│                          │                                       │
│  ┌──────────────────────▼───────────────────────────────────┐   │
│  │              Node.js Backend (Port 3000)                  │   │
│  │   REST API + WebSocket Server                             │   │
│  │   ┌─────────────┐  ┌──────────────┐  ┌──────────────┐   │   │
│  │   │ WireGuard   │  │  Key Manager │  │  Stats       │   │   │
│  │   │ Controller  │  │  (keypairs)  │  │  Collector   │   │   │
│  │   └─────────────┘  └──────────────┘  └──────────────┘   │   │
│  └──────────────────────┬───────────────────────────────────┘   │
│                          │                                       │
│  ┌──────────────────────▼───────────────────────────────────┐   │
│  │              React/Next.js Frontend (Port 3001)           │   │
│  │   Dashboard · Peer List · Bandwidth Charts · QR Codes    │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## ✨ Tính năng

### Quản lý Peers (VPN Clients)
- ✅ Tạo peer mới — tự động sinh cặp key (public/private)
- ✅ Xóa peer và thu hồi quyền truy cập ngay lập tức
- ✅ Bật/tắt peer không cần xóa cấu hình
- ✅ Xuất file `.conf` để import vào WireGuard client
- ✅ Tạo mã QR để kết nối từ điện thoại (Android/iOS)
- ✅ Đặt giới hạn băng thông cho từng peer

### Giám sát Real-time
- ✅ Danh sách peer đang kết nối (online/offline)
- ✅ Thống kê lưu lượng RX/TX theo thời gian thực qua WebSocket
- ✅ Biểu đồ băng thông lịch sử (Chart.js)
- ✅ Thời gian kết nối lần cuối (Last Handshake)
- ✅ IP thực của client (Endpoint)

### Bảo mật & Kiểm soát truy cập
- ✅ Phân quyền Admin / Viewer
- ✅ JWT Authentication cho Dashboard
- ✅ Tích hợp iptables để chặn/cho phép peer truy cập internet
- ✅ Rate limiting API

### Tiện ích
- ✅ Cấu hình DNS tùy chỉnh cho từng peer
- ✅ Hỗ trợ Split Tunneling (chỉ route một phần traffic qua VPN)
- ✅ Export danh sách peer ra CSV
- ✅ Backup & Restore cấu hình WireGuard

---

## 🛠️ Công nghệ sử dụng

| Tầng | Công nghệ | Mục đích |
|------|-----------|----------|
| **VPN Core** | WireGuard + wg-tools | Giao thức VPN, quản lý interface |
| **Backend** | Node.js 18+ / Express.js | REST API server |
| **Process** | `child_process` / `execa` | Gọi lệnh WireGuard CLI |
| **Real-time** | Socket.IO (WebSocket) | Đẩy bandwidth data live |
| **Frontend** | Next.js 14 + React 18 | Web Dashboard |
| **Styling** | TailwindCSS v3 | UI components |
| **Charts** | Chart.js + react-chartjs-2 | Biểu đồ lưu lượng |
| **QR Code** | `qrcode` npm package | Tạo mã QR cấu hình |
| **Auth** | JWT + bcrypt | Xác thực người dùng |
| **Database** | SQLite (better-sqlite3) | Lưu trữ peer metadata |
| **Config** | dotenv | Biến môi trường |
| **Firewall** | iptables / nftables | Kiểm soát truy cập mạng |

---

## 💻 Yêu cầu hệ thống

### Server (Backend + WireGuard)
- **OS**: Ubuntu 20.04+ / Debian 11+ / CentOS Stream 9+
- **CPU**: 1 vCPU (tối thiểu), 2 vCPU (khuyến nghị)
- **RAM**: 512MB (tối thiểu), 1GB (khuyến nghị)
- **Quyền**: `root` hoặc `sudo` (cần thiết để quản lý WireGuard interface)
- **Node.js**: v18.0.0 trở lên
- **WireGuard**: v1.0+

### Client (truy cập Dashboard)
- Bất kỳ trình duyệt hiện đại nào (Chrome, Firefox, Edge, Safari)

---

## 🚀 Cài đặt & Khởi chạy

### Bước 1: Cài đặt WireGuard lên Server

```bash
# Ubuntu/Debian
sudo apt update && sudo apt install -y wireguard wireguard-tools

# CentOS/RHEL
sudo dnf install -y wireguard-tools

# Kiểm tra cài đặt
wg --version
```

### Bước 2: Bật IP Forwarding

```bash
# Bật tạm thời
sudo sysctl -w net.ipv4.ip_forward=1

# Bật vĩnh viễn
echo "net.ipv4.ip_forward = 1" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

### Bước 3: Clone & Cài đặt dự án

```bash
git clone https://github.com/your-username/wireguard-dashboard.git
cd wireguard-dashboard

# Cài đặt dependencies cho Backend
cd backend
npm install

# Cài đặt dependencies cho Frontend
cd ../frontend
npm install
```

### Bước 4: Cấu hình môi trường

```bash
# Backend
cp backend/.env.example backend/.env
nano backend/.env  # Chỉnh sửa các biến cần thiết

# Frontend
cp frontend/.env.example frontend/.env.local
```

Xem chi tiết tại phần [Biến môi trường](#-biến-môi-trường).

### Bước 5: Khởi tạo WireGuard Server Interface

```bash
# Script tự động tạo server keys và cấu hình ban đầu
cd backend
sudo npm run setup:wireguard
```

Script này sẽ:
1. Tạo cặp key server (public/private)
2. Tạo file `/etc/wireguard/wg0.conf`
3. Khởi động interface `wg0`
4. Cấu hình iptables rules cơ bản

### Bước 6: Khởi chạy

```bash
# Development mode (2 terminal)
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend
cd frontend && npm run dev
```

```bash
# Production mode (dùng PM2)
npm install -g pm2

cd backend && pm2 start ecosystem.config.js
cd frontend && npm run build && pm2 start ecosystem.config.js
```

Truy cập Dashboard tại: `http://localhost:3001`

---

## 📁 Cấu trúc thư mục

```
wireguard-dashboard/
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   │   ├── peerController.js     # CRUD operations cho peers
│   │   │   ├── statsController.js    # Thu thập bandwidth stats
│   │   │   └── authController.js     # Đăng nhập / JWT
│   │   ├── services/
│   │   │   ├── wireguardService.js   # Wrapper gọi lệnh wg/wg-quick
│   │   │   ├── keyService.js         # Sinh public/private keypairs
│   │   │   ├── qrService.js          # Tạo mã QR từ config
│   │   │   ├── iptablesService.js    # Quản lý iptables rules
│   │   │   └── statsService.js       # Parse `wg show` output
│   │   ├── routes/
│   │   │   ├── peers.js              # /api/peers CRUD
│   │   │   ├── stats.js              # /api/stats
│   │   │   └── auth.js               # /api/auth
│   │   ├── websocket/
│   │   │   └── bandwidthSocket.js    # Socket.IO emitter (interval push)
│   │   ├── db/
│   │   │   ├── database.js           # SQLite connection
│   │   │   └── schema.sql            # Định nghĩa bảng
│   │   ├── middleware/
│   │   │   ├── auth.js               # JWT verify middleware
│   │   │   └── rateLimiter.js        # Rate limiting
│   │   └── app.js                    # Express app entry point
│   ├── scripts/
│   │   └── setup-wireguard.sh        # Script khởi tạo WireGuard
│   ├── .env.example
│   ├── ecosystem.config.js           # PM2 config
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── app/                      # Next.js App Router
│   │   │   ├── dashboard/
│   │   │   │   └── page.jsx          # Trang Dashboard chính
│   │   │   ├── peers/
│   │   │   │   ├── page.jsx          # Danh sách Peers
│   │   │   │   └── [id]/page.jsx     # Chi tiết từng Peer
│   │   │   └── login/
│   │   │       └── page.jsx          # Trang đăng nhập
│   │   ├── components/
│   │   │   ├── PeerList.jsx          # Bảng danh sách peers
│   │   │   ├── PeerCard.jsx          # Card thông tin peer
│   │   │   ├── BandwidthChart.jsx    # Biểu đồ Chart.js real-time
│   │   │   ├── QRCodeModal.jsx       # Modal hiển thị QR Code
│   │   │   ├── AddPeerModal.jsx      # Form thêm peer mới
│   │   │   └── StatusBadge.jsx       # Badge online/offline
│   │   ├── hooks/
│   │   │   ├── useWebSocket.js       # Hook kết nối Socket.IO
│   │   │   └── usePeers.js           # Hook fetch danh sách peers
│   │   ├── lib/
│   │   │   ├── api.js                # Axios instance + interceptors
│   │   │   └── auth.js               # Token storage helpers
│   │   └── styles/
│   │       └── globals.css
│   ├── .env.example
│   └── package.json
│
├── docs/
│   ├── architecture.md               # Tài liệu kiến trúc chi tiết
│   ├── api.md                        # API documentation
│   └── deployment.md                 # Hướng dẫn deploy
│
└── README.md
```

---

## 📡 API Reference

### Authentication

```
POST /api/auth/login
Body: { "username": "admin", "password": "..." }
Response: { "token": "eyJ..." }
```

### Peer Management

```
GET    /api/peers              — Lấy danh sách tất cả peers
POST   /api/peers              — Tạo peer mới
GET    /api/peers/:id          — Lấy thông tin một peer
PATCH  /api/peers/:id          — Cập nhật peer (bật/tắt)
DELETE /api/peers/:id          — Xóa peer

GET    /api/peers/:id/config   — Tải file .conf
GET    /api/peers/:id/qrcode   — Lấy QR code (base64 PNG)
```

### Stats

```
GET /api/stats                 — Tổng quan toàn hệ thống
GET /api/stats/peers           — Bandwidth stats của tất cả peers
GET /api/stats/peers/:id       — Bandwidth stats của một peer
```

#### Ví dụ response — Tạo peer mới

```json
{
  "id": "peer_abc123",
  "name": "Nguyen Van A - Laptop",
  "publicKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY=",
  "allowedIPs": "10.0.0.5/32",
  "dns": "1.1.1.1, 8.8.8.8",
  "createdAt": "2025-06-04T10:00:00Z",
  "enabled": true
}
```

---

## 🔌 WebSocket Events

Kết nối tới `ws://localhost:3000` với JWT token.

### Server → Client (events lắng nghe)

| Event | Payload | Mô tả |
|-------|---------|-------|
| `stats:update` | `{ peers: [...] }` | Bandwidth update mỗi 2 giây |
| `peer:connected` | `{ peerId, endpoint }` | Peer vừa thiết lập handshake |
| `peer:disconnected` | `{ peerId }` | Peer mất kết nối |

### Ví dụ stats payload

```json
{
  "peers": [
    {
      "id": "peer_abc123",
      "name": "Nguyen Van A",
      "online": true,
      "lastHandshake": "2025-06-04T10:05:30Z",
      "endpoint": "203.0.113.10:51234",
      "rxBytes": 1048576,
      "txBytes": 524288,
      "rxBytesFormatted": "1.00 MB",
      "txBytesFormatted": "512 KB"
    }
  ],
  "timestamp": "2025-06-04T10:05:32Z"
}
```

---

## ⚙️ Biến môi trường

### Backend (`backend/.env`)

```env
# Server
PORT=3000
NODE_ENV=development

# JWT
JWT_SECRET=your_super_secret_key_here
JWT_EXPIRES_IN=24h

# Admin credentials (lần đầu khởi tạo)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=changeme123

# WireGuard
WG_INTERFACE=wg0
WG_CONFIG_PATH=/etc/wireguard/wg0.conf
WG_SERVER_PORT=51820
WG_SERVER_SUBNET=10.0.0.0/24
WG_SERVER_IP=10.0.0.1

# Server public IP (để generate client config)
SERVER_PUBLIC_IP=your.server.public.ip

# Database
DB_PATH=./data/database.sqlite

# Stats collection interval (milliseconds)
STATS_INTERVAL=2000
```

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=ws://localhost:3000
```

---

## 📖 Hướng dẫn sử dụng

### Thêm peer mới

1. Đăng nhập vào Dashboard
2. Click **"+ Add Peer"**
3. Nhập tên (ví dụ: `Nguyen Van A - MacBook`)
4. Chọn DNS, bật/tắt Split Tunnel tùy nhu cầu
5. Click **"Create"** → Hệ thống tự động:
   - Sinh cặp key mới
   - Cập nhật `/etc/wireguard/wg0.conf`
   - Reload WireGuard interface (`wg syncconf`)
6. Tải file `.conf` hoặc quét mã QR bằng điện thoại

### Xem giám sát real-time

- Vào tab **"Dashboard"** để xem biểu đồ băng thông tổng
- Vào tab **"Peers"** để xem từng kết nối

### Thu hồi quyền truy cập

- Tìm peer trong danh sách
- Click **"Disable"** (tạm thời) hoặc **"Delete"** (vĩnh viễn)
- Thay đổi có hiệu lực **ngay lập tức** (không cần khởi động lại VPN server)

---

## 🧪 Môi trường phát triển & Test

### Nên dùng phần mềm nào?

| Công cụ | Mục đích | Link |
|---------|----------|------|
| **VS Code** | IDE chính — viết code | [code.visualstudio.com](https://code.visualstudio.com) |
| **WSL2** (Windows) hoặc **Ubuntu VM** | Môi trường Linux để chạy WireGuard | Tích hợp Windows / VirtualBox |
| **Postman** | Test REST API thủ công | [postman.com](https://www.postman.com) |
| **TablePlus** | Xem SQLite database | [tableplus.com](https://tableplus.com) |
| **WireGuard Official Client** | Test kết nối VPN thực | [wireguard.com/install](https://www.wireguard.com/install/) |

**VS Code Extensions nên cài:**
- ESLint, Prettier
- REST Client (test API ngay trong VS Code)
- SQLite Viewer
- Tailwind CSS IntelliSense

---

### Chạy test ở đâu?

#### Option 1: VPS/Cloud Server (Khuyến nghị nhất)

Thuê một VPS giá rẻ (~$5/tháng) trên:
- **DigitalOcean** — Droplet Ubuntu 22.04 ($4/tháng)
- **Vultr** — Cloud Compute ($2.50/tháng)
- **Hetzner Cloud** — CX11 (€3.29/tháng, rẻ nhất)
- **Linode / Akamai** — Nanode ($5/tháng)

Cần đảm bảo: **Mở port UDP 51820** trong Security Group / Firewall của nhà cung cấp.

#### Option 2: Máy ảo Local (VMware / VirtualBox)

```bash
# Tạo VM Ubuntu 22.04
# Cài WireGuard + Node.js vào VM
# Chạy Backend trong VM
# Chạy Frontend trên máy thật (Windows/macOS)
# Trỏ NEXT_PUBLIC_API_URL về IP của VM (ví dụ: 192.168.1.100)
```

> ⚠️ Lưu ý: WireGuard cần quyền root và kernel module — **không thể chạy trong Docker thông thường** nếu không dùng `--privileged`. Dùng VM thật sẽ dễ hơn.

#### Option 3: WSL2 trên Windows (có giới hạn)

```bash
# Cài WSL2 với Ubuntu 22.04
wsl --install -d Ubuntu-22.04

# Cài WireGuard trong WSL2
sudo apt install wireguard

# Lưu ý: WireGuard trong WSL2 cần kernel tùy chỉnh
# Tham khảo: https://github.com/microsoft/WSL/issues/4584
```

> WSL2 có thể test Backend API và Frontend bình thường, nhưng chức năng WireGuard thực tế sẽ có giới hạn kernel. Dùng được để phát triển UI và API logic.

#### Option 4: Mock Mode (phát triển Frontend thuần)

Thêm biến môi trường `MOCK_WIREGUARD=true` để Backend trả về dữ liệu giả — cho phép phát triển toàn bộ Frontend **mà không cần server Linux thật**:

```bash
# Backend sẽ trả mock data thay vì gọi lệnh wg thật
MOCK_WIREGUARD=true npm run dev
```

---

### Chạy Unit Tests

```bash
# Backend tests
cd backend
npm test                    # Chạy tất cả tests
npm run test:watch          # Watch mode
npm run test:coverage       # Coverage report

# Frontend tests
cd frontend
npm test                    # Jest + React Testing Library
npm run test:e2e            # Playwright end-to-end tests
```

### Test API thủ công với curl

```bash
# Đăng nhập
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"changeme123"}'

# Lấy danh sách peers (cần token)
curl http://localhost:3000/api/peers \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Tạo peer mới
curl -X POST http://localhost:3000/api/peers \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Peer","dns":"1.1.1.1"}'
```

---

## 🌐 Deployment lên Production

### Dùng Nginx làm Reverse Proxy

```nginx
# /etc/nginx/sites-available/vpn-dashboard
server {
    listen 80;
    server_name vpn.yourcompany.com;

    # Frontend
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
    }

    # Backend API + WebSocket
    location /api {
        proxy_pass http://localhost:3000;
    }

    location /socket.io {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
    }
}
```

```bash
# Cài SSL với Let's Encrypt
sudo certbot --nginx -d vpn.yourcompany.com
```

### Dùng PM2 để quản lý process

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup   # Tự khởi động khi reboot server
```

---

## 📚 Kiến thức nền tảng

Dự án này giúp bạn học và thực hành các khái niệm sau:

### 🔐 Mã hóa đường truyền (Tunneling & Encryption)
WireGuard sử dụng:
- **ChaCha20** — Mã hóa đối xứng stream cipher
- **Poly1305** — MAC để xác thực tính toàn vẹn
- **Curve25519** — ECDH để trao đổi khóa
- **BLAKE2s** — Hash function
- **SipHash24** — Hashtable keys

### 🌐 Giao thức UDP
WireGuard chạy trên **UDP port 51820**. Khác với TCP, UDP không có handshake, giúp:
- Kết nối nhanh hơn (không cần 3-way handshake)
- Ít overhead hơn
- WireGuard tự xử lý độ tin cậy qua cryptographic handshake riêng

### 🗺️ Định tuyến IP (IP Routing)
Khi một peer kết nối, kernel Linux sẽ:
1. Route traffic từ IP `10.0.0.x` qua interface `wg0`
2. WireGuard decrypt packet và forward đến đích
3. IP Forwarding (`net.ipv4.ip_forward=1`) cho phép server làm gateway

### 🔥 Firewall / iptables
```bash
# Cho phép traffic qua wg0
iptables -A FORWARD -i wg0 -j ACCEPT

# NAT để peers ra được Internet
iptables -t nat -A POSTROUTING -s 10.0.0.0/24 -o eth0 -j MASQUERADE

# Chặn một peer cụ thể
iptables -A FORWARD -s 10.0.0.5/32 -j DROP
```

---

## 🗺️ Roadmap

- [x] CRUD peers cơ bản
- [x] Tạo file `.conf` và QR code
- [x] Real-time bandwidth monitoring
- [x] JWT authentication
- [ ] Multi-server support (quản lý nhiều WireGuard server)
- [ ] Email notification khi peer kết nối bất thường
- [ ] Tích hợp LDAP/Active Directory
- [ ] Mobile app (React Native)
- [ ] Prometheus + Grafana metrics export
- [ ] Kubernetes deployment

---

## 🤝 Đóng góp

Mọi đóng góp đều được chào đón!

1. Fork repository
2. Tạo branch: `git checkout -b feature/ten-tinh-nang`
3. Commit: `git commit -m 'feat: thêm tính năng X'`
4. Push: `git push origin feature/ten-tinh-nang`
5. Tạo Pull Request

Vui lòng đọc [CONTRIBUTING.md](CONTRIBUTING.md) trước khi đóng góp.

---

## 📄 License

MIT License — xem [LICENSE](LICENSE) để biết thêm chi tiết.

---

<p align="center">
  Built with ❤️ for the Vietnamese developer community
</p>
