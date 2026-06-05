const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

const configPath = process.env.WG_CONFIG_PATH || './data/wg0.conf';

/**
 * Sinh nội dung file cấu hình WireGuard cho Client.
 * @param {object} peer Đối tượng peer từ database
 * @returns {string} Nội dung file .conf
 */
function generateClientConfig(peer) {
  const dataDir = path.dirname(configPath);
  const serverKeyPath = path.join(dataDir, 'server_keys.json');
  let serverPublicKey = '';
  
  if (fs.existsSync(serverKeyPath)) {
    const keys = JSON.parse(fs.readFileSync(serverKeyPath, 'utf8'));
    serverPublicKey = keys.publicKey;
  }

  const serverIP = process.env.SERVER_PUBLIC_IP || '127.0.0.1';
  const serverPort = process.env.WG_SERVER_PORT || 51820;
  
  // Xác định AllowedIPs cho client (nếu Split Tunneling bật thì chỉ route dải mạng VPN, nếu tắt thì route toàn bộ Internet 0.0.0.0/0)
  // Trong cấu hình peer, ta lưu allowedIPs của client (vd: 10.0.0.5/32).
  // Khi gửi cho client, phần [Peer].AllowedIPs xác định lưu lượng nào được đi qua VPN.
  // Mặc định cho client là đi hết qua VPN (0.0.0.0/0, ::/0).
  // Nếu bật Split Tunneling, client chỉ định tuyến dải mạng VPN (vd: 10.0.0.0/24).
  const clientAllowedIPs = peer.splitTunnel === 1 || peer.splitTunnel === true 
    ? (process.env.WG_SERVER_SUBNET || '10.0.0.0/24')
    : '0.0.0.0/0, ::/0';

  const dnsList = peer.dns || '1.1.1.1, 8.8.8.8';

  return `[Interface]
PrivateKey = ${peer.privateKey}
Address = ${peer.allowedIPs}
DNS = ${dnsList}

[Peer]
PublicKey = ${serverPublicKey}
Endpoint = ${serverIP}:${serverPort}
AllowedIPs = ${clientAllowedIPs}
PersistentKeepalive = 25
`;
}

/**
 * Tạo mã QR Code dạng base64 từ nội dung cấu hình client.
 * @param {string} configContent Nội dung file cấu hình
 * @returns {Promise<string>} Mã QR Code dạng Base64 Data URL (image/png)
 */
async function generateQRCodeBase64(configContent) {
  try {
    const qrDataUrl = await QRCode.toDataURL(configContent, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 300,
      color: {
        dark: '#0f172a', // Slate 900
        light: '#f8fafc' // Slate 50
      }
    });
    return qrDataUrl;
  } catch (err) {
    console.error('Error generating QR code:', err);
    throw err;
  }
}

module.exports = {
  generateClientConfig,
  generateQRCodeBase64
};
