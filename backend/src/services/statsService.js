const { execSync } = require('child_process');
const db = require('../db/database');

const isMock = process.env.MOCK_WIREGUARD === 'true';
const wgInterface = process.env.WG_INTERFACE || 'wg0';

// Bộ nhớ đệm giả lập để lưu giữ trạng thái hoạt động của các peer
const mockPeersCache = {};

/**
 * Đọc lưu lượng và trạng thái bắt tay thực tế từ WireGuard hoặc sinh dữ liệu giả lập.
 * @returns {Promise<Array>} Danh sách các peer kèm thống kê băng thông
 */
async function getPeersStats() {
  const peers = await db.all('SELECT * FROM peers');
  
  if (isMock) {
    const now = new Date();
    const updatedPeers = [];

    for (const peer of peers) {
      // Chỉ giả lập hoạt động cho các peer đang ENABLED
      if (peer.enabled === 1) {
        // Khởi tạo cache nếu chưa có
        if (!mockPeersCache[peer.id]) {
          mockPeersCache[peer.id] = {
            rxBytes: peer.rxBytes || Math.floor(Math.random() * 5000000),
            txBytes: peer.txBytes || Math.floor(Math.random() * 2000000),
            lastHandshake: peer.lastHandshake || new Date(now - Math.random() * 3600000).toISOString(),
            endpoint: peer.endpoint || `115.79.${Math.floor(Math.random() * 254) + 1}.${Math.floor(Math.random() * 254) + 1}:${Math.floor(Math.random() * 64511) + 1024}`,
            isOnline: Math.random() > 0.3 // 70% cơ hội online
          };
        }

        const cache = mockPeersCache[peer.id];

        // Nếu online, mô phỏng tăng lưu lượng
        if (cache.isOnline) {
          // Tăng lượng bytes nhận/gửi ngẫu nhiên (từ 50KB đến 2.5MB mỗi chu kỳ)
          const rxDelta = Math.floor(Math.random() * 2500000) + 50000;
          const txDelta = Math.floor(Math.random() * 1200000) + 20000;
          
          cache.rxBytes += rxDelta;
          cache.txBytes += txDelta;
          cache.lastHandshake = now.toISOString();
          
          // Cập nhật vào DB để lưu giữ tiến trình
          await db.run(
            'UPDATE peers SET rxBytes = ?, txBytes = ?, lastHandshake = ?, endpoint = ? WHERE id = ?',
            [cache.rxBytes, cache.txBytes, cache.lastHandshake, cache.endpoint, peer.id]
          );
        }

        updatedPeers.push({
          id: peer.id,
          name: peer.name,
          publicKey: peer.publicKey,
          allowedIPs: peer.allowedIPs,
          enabled: true,
          online: cache.isOnline,
          rxBytes: cache.rxBytes,
          txBytes: cache.txBytes,
          rxFormatted: formatBytes(cache.rxBytes),
          txFormatted: formatBytes(cache.txBytes),
          lastHandshake: cache.lastHandshake,
          endpoint: cache.endpoint
        });
      } else {
        // Peer bị disable
        if (mockPeersCache[peer.id]) {
          delete mockPeersCache[peer.id];
        }
        updatedPeers.push({
          id: peer.id,
          name: peer.name,
          publicKey: peer.publicKey,
          allowedIPs: peer.allowedIPs,
          enabled: false,
          online: false,
          rxBytes: peer.rxBytes || 0,
          txBytes: peer.txBytes || 0,
          rxFormatted: formatBytes(peer.rxBytes || 0),
          txFormatted: formatBytes(peer.txBytes || 0),
          lastHandshake: peer.lastHandshake || null,
          endpoint: peer.endpoint || null
        });
      }
    }

    return updatedPeers;
  } else {
    // Trên Linux thực tế, thực thi lệnh `wg show <interface> dump`
    try {
      const dumpOutput = execSync(`sudo wg show ${wgInterface} dump`).toString().trim();
      const lines = dumpOutput.split('\n');
      // Bỏ dòng đầu tiên (chứa thông tin interface server)
      const peerLines = lines.slice(1);
      
      const wgStatsMap = {};
      peerLines.forEach(line => {
        const parts = line.split('\t');
        if (parts.length >= 8) {
          const pubKey = parts[0];
          const endpoint = parts[2] === '(none)' ? null : parts[2];
          const lastHandshakeEpoch = parseInt(parts[4], 10);
          const rxBytes = parseInt(parts[5], 10);
          const txBytes = parseInt(parts[6], 10);
          
          wgStatsMap[pubKey] = {
            endpoint,
            lastHandshake: lastHandshakeEpoch > 0 ? new Date(lastHandshakeEpoch * 1000).toISOString() : null,
            rxBytes,
            txBytes
          };
        }
      });

      const updatedPeers = [];
      const now = Date.now();

      for (const peer of peers) {
        const stats = wgStatsMap[peer.publicKey];
        
        let rx = peer.rxBytes || 0;
        let tx = peer.txBytes || 0;
        let lastHandshake = peer.lastHandshake || null;
        let endpoint = peer.endpoint || null;
        let online = false;

        if (stats && peer.enabled === 1) {
          rx = stats.rxBytes;
          tx = stats.txBytes;
          lastHandshake = stats.lastHandshake;
          endpoint = stats.endpoint;
          
          // Xác định online nếu có handshake trong vòng 5 phút (300 giây)
          if (lastHandshake) {
            const handshakeTime = new Date(lastHandshake).getTime();
            online = (now - handshakeTime) < 300000;
          }

          // Cập nhật lại vào Database
          await db.run(
            'UPDATE peers SET rxBytes = ?, txBytes = ?, lastHandshake = ?, endpoint = ? WHERE id = ?',
            [rx, tx, lastHandshake, endpoint, peer.id]
          );
        }

        updatedPeers.push({
          id: peer.id,
          name: peer.name,
          publicKey: peer.publicKey,
          allowedIPs: peer.allowedIPs,
          enabled: peer.enabled === 1,
          online,
          rxBytes: rx,
          txBytes: tx,
          rxFormatted: formatBytes(rx),
          txFormatted: formatBytes(tx),
          lastHandshake,
          endpoint
        });
      }

      return updatedPeers;
    } catch (err) {
      console.error('Failed to run wg show dump command, returning database stats fallback:', err.message);
      // Fallback khi lệnh lỗi: trả về dữ liệu lưu trong DB
      return peers.map(peer => ({
        id: peer.id,
        name: peer.name,
        publicKey: peer.publicKey,
        allowedIPs: peer.allowedIPs,
        enabled: peer.enabled === 1,
        online: false,
        rxBytes: peer.rxBytes || 0,
        txBytes: peer.txBytes || 0,
        rxFormatted: formatBytes(peer.rxBytes || 0),
        txFormatted: formatBytes(peer.txBytes || 0),
        lastHandshake: peer.lastHandshake || null,
        endpoint: peer.endpoint || null
      }));
    }
  }
}

/**
 * Định dạng số bytes sang đơn vị đọc được (KB, MB, GB).
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

module.exports = {
  getPeersStats
};
