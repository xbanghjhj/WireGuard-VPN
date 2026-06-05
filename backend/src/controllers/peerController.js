const crypto = require('crypto');
const db = require('../db/database');
const keyService = require('../services/keyService');
const qrService = require('../services/qrService');
const wireguardService = require('../services/wireguardService');
const iptablesService = require('../services/iptablesService');
const statsService = require('../services/statsService');

/**
 * Lấy danh sách tất cả peers kèm theo metrics thời gian thực.
 */
async function getPeers(req, res) {
  try {
    const peersStats = await statsService.getPeersStats();
    return res.status(200).json(peersStats);
  } catch (error) {
    console.error('Get peers error:', error);
    return res.status(500).json({ message: 'Error retrieving peer list.' });
  }
}

/**
 * Lấy thông tin một peer cụ thể theo ID.
 */
async function getPeerById(req, res) {
  try {
    const { id } = req.params;
    const peer = await db.get('SELECT * FROM peers WHERE id = ?', [id]);
    
    if (!peer) {
      return res.status(404).json({ message: 'Peer not found.' });
    }

    return res.status(200).json(peer);
  } catch (error) {
    console.error('Get peer by id error:', error);
    return res.status(500).json({ message: 'Error retrieving peer details.' });
  }
}

/**
 * Tạo mới một peer VPN client, tự động cấp phát IP và sinh cặp khóa.
 */
async function createPeer(req, res) {
  try {
    const { name, dns, splitTunnel } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Peer name is required.' });
    }

    // 1. Tự động cấp phát IP tiếp theo trong mạng VPN (vd: 10.0.0.2 -> 10.0.0.254)
    const serverIP = process.env.WG_SERVER_IP || '10.0.0.1';
    const ipPrefix = serverIP.substring(0, serverIP.lastIndexOf('.') + 1); // e.g. "10.0.0."
    
    const existingPeers = await db.all('SELECT allowedIPs FROM peers');
    const usedOctets = new Set();
    
    // Thu thập các octet cuối đã sử dụng
    existingPeers.forEach(p => {
      if (p.allowedIPs) {
        // Lấy IP từ chuỗi "10.0.0.5/32" -> "10.0.0.5" -> "5"
        const cleanIP = p.allowedIPs.split('/')[0];
        const lastOctet = parseInt(cleanIP.substring(cleanIP.lastIndexOf('.') + 1), 10);
        if (!isNaN(lastOctet)) {
          usedOctets.add(lastOctet);
        }
      }
    });

    // Quét tìm octet rảnh đầu tiên từ 2 đến 254
    let allocatedOctet = 2;
    for (let i = 2; i <= 254; i++) {
      if (!usedOctets.has(i)) {
        allocatedOctet = i;
        break;
      }
    }

    if (allocatedOctet > 254) {
      return res.status(400).json({ message: 'IP address space is full. Cannot allocate IP.' });
    }

    const clientIP = `${ipPrefix}${allocatedOctet}/32`;

    // 2. Sinh cặp keys
    const keys = keyService.generateKeyPair();
    
    // 3. Lưu vào Database
    const peerId = `peer_${crypto.randomBytes(6).toString('hex')}`;
    const createdAt = new Date().toISOString();
    const defaultDNS = dns || '1.1.1.1, 8.8.8.8';
    const isSplitTunnel = splitTunnel === true || splitTunnel === 1 ? 1 : 0;

    await db.run(
      `INSERT INTO peers (id, name, publicKey, privateKey, allowedIPs, dns, createdAt, enabled, rxBytes, txBytes, lastHandshake, endpoint)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, 0, null, null)`,
      [peerId, name, keys.publicKey, keys.privateKey, clientIP, defaultDNS, createdAt]
    );

    // Lưu splitTunnel vào database nếu SQLite hỗ trợ (hoặc SQLite schema đã lưu đầy đủ trong JSON fallback)
    // Để giữ đơn giản cho schema tiêu chuẩn, ta có thể lưu cấu trúc splitTunnel
    // Cập nhật lại cấu hình WireGuard wg0.conf và đồng bộ
    await wireguardService.syncWireGuardConfig();

    return res.status(201).json({
      id: peerId,
      name,
      publicKey: keys.publicKey,
      allowedIPs: clientIP,
      dns: defaultDNS,
      createdAt,
      enabled: true
    });

  } catch (error) {
    console.error('Create peer error:', error);
    return res.status(500).json({ message: 'Failed to create VPN peer.' });
  }
}

/**
 * Cập nhật trạng thái peer (Bật/Tắt).
 */
async function updatePeer(req, res) {
  try {
    const { id } = req.params;
    const { enabled } = req.body;

    if (enabled === undefined) {
      return res.status(400).json({ message: 'Enabled field is required.' });
    }

    const peer = await db.get('SELECT * FROM peers WHERE id = ?', [id]);
    if (!peer) {
      return res.status(404).json({ message: 'Peer not found.' });
    }

    const numericEnabled = enabled ? 1 : 0;
    await db.run('UPDATE peers SET enabled = ? WHERE id = ?', [numericEnabled, id]);

    // Đồng bộ lại card mạng WireGuard
    await wireguardService.syncWireGuardConfig();

    // Thêm quy tắc tường lửa tương ứng
    if (!enabled) {
      await iptablesService.blockClientIP(peer.allowedIPs);
    } else {
      await iptablesService.unblockClientIP(peer.allowedIPs);
    }

    return res.status(200).json({ id, enabled });
  } catch (error) {
    console.error('Update peer error:', error);
    return res.status(500).json({ message: 'Failed to update peer status.' });
  }
}

/**
 * Xóa một peer vĩnh viễn khỏi hệ thống.
 */
async function deletePeer(req, res) {
  try {
    const { id } = req.params;
    
    const peer = await db.get('SELECT * FROM peers WHERE id = ?', [id]);
    if (!peer) {
      return res.status(404).json({ message: 'Peer not found.' });
    }

    // Xóa khỏi DB
    await db.run('DELETE FROM peers WHERE id = ?', [id]);

    // Đồng bộ lại card mạng WireGuard
    await wireguardService.syncWireGuardConfig();

    // Hủy quy tắc tường lửa nếu đang bị chặn
    await iptablesService.unblockClientIP(peer.allowedIPs);

    return res.status(200).json({ message: 'Peer deleted successfully.', id });
  } catch (error) {
    console.error('Delete peer error:', error);
    return res.status(500).json({ message: 'Failed to delete peer.' });
  }
}

/**
 * Tải file cấu hình .conf dành cho client.
 */
async function downloadPeerConfig(req, res) {
  try {
    const { id } = req.params;
    const peer = await db.get('SELECT * FROM peers WHERE id = ?', [id]);

    if (!peer) {
      return res.status(404).json({ message: 'Peer not found.' });
    }

    const configContent = qrService.generateClientConfig(peer);
    
    res.setHeader('Content-disposition', `attachment; filename=${peer.name.replace(/[^a-zA-Z0-9]/g, '_')}.conf`);
    res.setHeader('Content-type', 'text/plain');
    return res.send(configContent);
  } catch (error) {
    console.error('Download config error:', error);
    return res.status(500).json({ message: 'Failed to download configuration.' });
  }
}

/**
 * Lấy QR Code cấu hình dưới dạng ảnh Base64.
 */
async function getPeerQRCode(req, res) {
  try {
    const { id } = req.params;
    const peer = await db.get('SELECT * FROM peers WHERE id = ?', [id]);

    if (!peer) {
      return res.status(404).json({ message: 'Peer not found.' });
    }

    const configContent = qrService.generateClientConfig(peer);
    const qrCodeBase64 = await qrService.generateQRCodeBase64(configContent);

    return res.status(200).json({ qrCode: qrCodeBase64 });
  } catch (error) {
    console.error('Get QR Code error:', error);
    return res.status(500).json({ message: 'Failed to generate QR Code.' });
  }
}

module.exports = {
  getPeers,
  getPeerById,
  createPeer,
  updatePeer,
  deletePeer,
  downloadPeerConfig,
  getPeerQRCode
};
