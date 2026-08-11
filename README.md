# 🛡️ WireGuard VPN Controller & Web Dashboard

> Hệ thống quản lý VPN doanh nghiệp hiện đại — cấp phát, giám sát và điều phối kết nối WireGuard qua giao diện Web trực quan.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-22-green.svg)
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

WireGuard được chọn vì có thiết kế gọn, hiệu năng tốt và sử dụng các primitive hiện đại như ChaCha20, Poly1305 và Curve25519. Mức độ an toàn thực tế vẫn phụ thuộc vào quản lý khóa, phân quyền, cấu hình mạng và quy trình vận hành.

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
│  │         Interface: wg0 (10.99.0.1/24)                     │   │
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
- 🗺️ Giới hạn băng thông cho từng peer — roadmap, chưa triển khai

### Giám sát Real-time
- ✅ Danh sách peer đang kết nối (online/offline)
- ✅ Thống kê lưu lượng RX/TX theo thời gian thực qua WebSocket
- ✅ Biểu đồ băng thông lịch sử (Chart.js)
- ✅ Thời gian kết nối lần cuối (Last Handshake)
- ✅ IP thực của client (Endpoint)

### Bảo mật & Kiểm soát truy cập
- ✅ Phân quyền Admin / Viewer
- ✅ JWT Authentication cho Dashboard
- ✅ Gỡ peer khỏi WireGuard runtime khi disable; iptables DROP chỉ là lớp bổ sung
- ✅ Rate limiting API

### Tiện ích
- ✅ Cấu hình DNS tùy chỉnh cho từng peer
- ✅ Hỗ trợ Split Tunneling (chỉ route một phần traffic qua VPN)
- 🗺️ Export danh sách peer ra CSV — roadmap, chưa triển khai
- 🗺️ Backup & Restore cấu hình WireGuard — roadmap, chưa triển khai

---

## 🛠️ Công nghệ sử dụng

| Tầng | Công nghệ | Mục đích |
|------|-----------|----------|
| **VPN Core** | WireGuard + wg-tools | Giao thức VPN, quản lý interface |
| **Backend** | Node.js 22 / Express.js | REST API server |
| **Process** | `child_process.spawn` | Gọi lệnh WireGuard CLI bằng file + danh sách argument |
| **Real-time** | Socket.IO (WebSocket) | Đẩy bandwidth data live |
| **Frontend** | Next.js 16 + React 19 | Web Dashboard |
| **Styling** | TailwindCSS v3 | UI components |
| **Charts** | Chart.js + react-chartjs-2 | Biểu đồ lưu lượng |
| **QR Code** | `qrcode` npm package | Tạo mã QR cấu hình |
| **Auth** | JWT + bcrypt | Xác thực người dùng |
| **Database** | SQLite (`sqlite3`) | Migration, peer metadata, audit log |
| **Config** | dotenv + Zod | Biến môi trường và validation tập trung |
| **Firewall** | iptables / nftables | Kiểm soát truy cập mạng |

---

## 💻 Yêu cầu hệ thống

### Server (Backend + WireGuard)
- **OS**: Ubuntu 20.04+ / Debian 11+ / CentOS Stream 9+
- **CPU**: 1 vCPU (tối thiểu), 2 vCPU (khuyến nghị)
- **RAM**: 512MB (tối thiểu), 1GB (khuyến nghị)
- **Quyền**: backend chạy bằng service account riêng; cấp quyền giới hạn qua systemd capability hoặc privileged helper đã review
- **Node.js**: v22.x
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
git clone https://github.com/xbanghjhj/WireGuard-VPN.git
cd WireGuard-VPN

# Cài đặt dependencies cho Backend
cd backend
npm ci

# Cài đặt dependencies cho Frontend
cd ../frontend
npm ci
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
npm run setup:wireguard                  # tạo/kiểm tra, không start interface
npm run setup:wireguard -- --apply       # chỉ apply sau khi đã review
```

Script này sẽ:
1. Kiểm tra real/mock mode và tạo server key riêng nếu chưa có
2. Tạo, validate và đặt mode `0600` cho cấu hình WireGuard
3. Kiểm tra `net.ipv4.ip_forward` và tạo Admin theo cách idempotent
4. Không tự sửa firewall; chỉ `--apply` mới yêu cầu khởi động/đồng bộ interface

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

cd frontend && npm run build && cd ..
pm2 start ecosystem.config.js
```

Truy cập Dashboard tại: `http://localhost:3001`

---

## 📁 Cấu trúc thư mục

```
WireGuard-VPN/
├── backend/
│   ├── src/
│   │   ├── config/env.js
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── peerController.js
│   │   │   └── statsController.js
│   │   ├── db/database.js
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   │   ├── ipAllocatorService.js
│   │   │   ├── keyService.js
│   │   │   ├── peerKeyCryptoService.js
│   │   │   ├── statsService.js
│   │   │   └── wireguardService.js
│   │   ├── websocket/bandwidthSocket.js
│   │   └── app.js
│   ├── scripts/setup-wireguard.js
│   ├── test/
│   └── .env.example
├── frontend/
│   ├── src/app/
│   │   ├── dashboard/page.js
│   │   └── login/page.js
│   ├── src/components/
│   │   ├── AddPeerModal.js
│   │   ├── BandwidthChart.js
│   │   └── QRCodeModal.js
│   ├── src/hooks/
│   ├── src/lib/
│   └── .env.example
├── deploy/
├── docs/deployment.md
├── .github/workflows/ci.yml
└── ecosystem.config.js
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


### Phân quyền và dữ liệu nhạy cảm

| Chức năng | Admin | Viewer |
| --- | :---: | :---: |
| Login, Dashboard, danh sách/chi tiết peer an toàn | Có | Có |
| Tạo, enable/disable, xóa peer | Có | Không |
| Tải config hoặc xem QR | Có | Không |
| Xem private key qua JSON/WebSocket | Không | Không |

Danh sách, chi tiết và WebSocket chỉ dùng DTO an toàn. Private key peer được mã hóa AES-256-GCM trong SQLite và chỉ được giải mã tạm thời khi Admin yêu cầu config/QR. Peer cũ không có bản ghi mã hóa hoàn chỉnh được đánh dấu `needsReprovision`.

### Stats

```
GET /api/stats                 — Tổng quan toàn hệ thống
```

#### Ví dụ response — Tạo peer mới

```json
{
  "id": "peer_abc123",
  "name": "Nguyen Van A - Laptop",
  "publicKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY=",
  "allowedIPs": "10.99.0.2/32",
  "dns": "1.1.1.1, 8.8.8.8",
  "createdAt": "2025-06-04T10:00:00Z",
  "enabled": true
}
```

---

## 🔌 WebSocket Events

Kết nối tới Socket.IO endpoint với JWT trong `auth: { token }`; query-string token không được chấp nhận.

### Server → Client (events lắng nghe)

| Event | Payload | Mô tả |
|-------|---------|-------|
| `stats:update` | `{ peers: [...] }` | Bandwidth update theo `STATS_INTERVAL` |
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
      "rxFormatted": "1 MB",
      "txFormatted": "512 KB"
    }
  ],
  "timestamp": "2025-06-04T10:05:32Z"
}
```

---

## ⚙️ Biến môi trường

Sao chép các file example chỉ chứa placeholder; không commit file môi trường thật.

### Backend (`backend/.env`)

```env
PORT=3000
NODE_ENV=production
JWT_SECRET=replace_with_at_least_32_random_bytes
JWT_EXPIRES_IN=2h
ADMIN_USERNAME=admin
ADMIN_PASSWORD=replace_with_strong_password
PEER_KEY_ENCRYPTION_KEY=replace_with_32_byte_key

WG_INTERFACE=wg0
WG_CONFIG_PATH=/etc/wireguard/wg0.conf
WG_SERVER_PRIVATE_KEY_PATH=/etc/wireguard/server_private.key
WG_SERVER_PUBLIC_KEY_PATH=/etc/wireguard/server_public.key
WG_SERVER_ADDRESS=10.99.0.1/24
WG_SERVER_SUBNET=10.99.0.0/24
WG_CLIENT_ALLOWED_IPS=10.10.10.0/24,10.99.0.0/24
WG_SERVER_PORT=51820
SERVER_PUBLIC_IP=192.168.100.10

DB_PATH=/var/lib/wireguard-controller/database.sqlite
STATS_INTERVAL=5000
STATS_PERSIST_INTERVAL=60000
MOCK_WIREGUARD=false
CORS_ORIGIN=http://172.16.10.10:3001
```

Production dừng khởi động nếu thiếu hoặc sai biến bắt buộc. `WG_SERVER_ADDRESS` phải chứa đầy đủ CIDR; controller không tự nối `/24`. `PEER_KEY_ENCRYPTION_KEY` phải là 32 byte dưới dạng base64 hoặc 64 ký tự hex.

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://192.168.100.10:3000
NEXT_PUBLIC_WS_URL=http://192.168.100.10:3000
```

Các biến `NEXT_PUBLIC_*` là dữ liệu public và không được chứa secret.

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
npm run lint
npm run build
```

### Test API thủ công với curl

```bash
# Đăng nhập
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<strong-password>"}'

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

> Backend production không chạy toàn bộ bằng root. Dùng dedicated service account và systemd capability giới hạn hoặc root-owned privileged helper đã audit. Không tự động sửa `/etc/sudoers`. Frontend luôn chạy non-root.

Trong mô hình VMware routed, pfSense phân tách WAN/DMZ/LAN, có static route trả về `10.99.0.0/24` qua WireGuard Server và không NAT traffic tunnel-to-LAN. Xem cấu hình systemd mẫu tại `deploy/` và hướng dẫn chi tiết ở [docs/deployment.md](docs/deployment.md).

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

Build frontend trước, sau đó chạy PM2 từ repository root:

```bash
cd WireGuard-VPN
cd frontend && npm run build && cd ..
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

PM2 chỉ quản lý Node process; không thay thế `wg-quick@wg0`, routing, capability hay firewall.

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
iptables -t nat -A POSTROUTING -s 10.99.0.0/24 -o eth0 -j MASQUERADE

# Chặn một peer cụ thể
iptables -A FORWARD -s 10.0.0.5/32 -j DROP
```

---

## 🗺️ Roadmap

- [x] CRUD peers có RBAC, validation và audit log
- [x] Tạo file `.conf` và QR code Admin-only với private key mã hóa
- [x] Real-time bandwidth monitoring và WebSocket JWT
- [x] JWT authentication
- [ ] Export CSV
- [ ] Backup & Restore
- [ ] Multi-server support (quản lý nhiều WireGuard server)
- [ ] Email notification khi peer kết nối bất thường
- [ ] Tích hợp LDAP/Active Directory
- [ ] Mobile app (React Native)
- [ ] Prometheus + Grafana metrics export
- [ ] Kubernetes deployment

---

## 🔐 Lưu ý bảo mật và xử lý secret

- Không commit `.env`, `.env.local`, SQLite, WireGuard private key, `wg0.conf` thật hoặc `server_keys.json`.
- Không chạy backend hoặc frontend bằng root trong production.
- Không đưa Dashboard trực tiếp ra WAN.
- Bearer token hiện lưu trong `localStorage`, chỉ phù hợp lab cô lập. Kế hoạch production là chuyển sang Secure HttpOnly SameSite cookie kèm CSRF protection.
- Setup mặc định chỉ tạo/kiểm tra cấu hình; `--apply` mới đồng bộ interface và không tự thay đổi firewall.
- Stats real mode dùng `wg show <interface> dump`, không sinh CPU ngẫu nhiên; nếu chưa có collector tin cậy thì CPU trả `null/unavailable`.

Repository từng theo dõi runtime secrets. Việc bỏ chúng khỏi index không xóa lịch sử Git. Sau khi triển khai, quản trị viên phải đổi WireGuard server key, cấp lại toàn bộ peer, đổi `JWT_SECRET`, `PEER_KEY_ENCRYPTION_KEY` và mật khẩu Admin. Cân nhắc dùng `git-filter-repo` theo tài liệu GitHub, nhưng chỉ thực hiện thủ công sau khi phối hợp với mọi người dùng repository.

### Kiểm tra tự động hiện tại

```bash
cd backend
npm ci
npm run lint
npm test
npm run test:coverage
npm audit --omit=dev

cd ../frontend
npm ci
npm run lint
npm test
npm run test:coverage
npm run build
npm audit --omit=dev
```

CI chạy Node.js 22 ở mock mode, không sửa `/etc/wireguard` hoặc iptables. Real mode cần kiểm tra thủ công trên Ubuntu:

```bash
sysctl net.ipv4.ip_forward
sudo wg-quick strip /etc/wireguard/wg0.conf
sudo systemctl status wg-quick@wg0
sudo wg show wg0 dump
ip route
```

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
