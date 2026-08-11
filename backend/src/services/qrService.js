const fs = require('fs');
const QRCode = require('qrcode');
const { env } = require('../config/env');

function generateClientConfig(peer, privateKey) {
  const serverPublicKey = fs.readFileSync(env.WG_SERVER_PUBLIC_KEY_PATH, 'utf8').trim();
  const routes = peer.splitTunnel === 1 || peer.splitTunnel === true
    ? env.WG_CLIENT_ALLOWED_IPS
    : '0.0.0.0/0, ::/0';
  return `[Interface]
PrivateKey = ${privateKey}
Address = ${peer.allowedIPs}
DNS = ${peer.dns || '1.1.1.1, 8.8.8.8'}

[Peer]
PublicKey = ${serverPublicKey}
Endpoint = ${env.SERVER_PUBLIC_IP}:${env.WG_SERVER_PORT}
AllowedIPs = ${routes}
PersistentKeepalive = 25
`;
}

function generateQRCodeBase64(configContent) {
  return QRCode.toDataURL(configContent, {
    errorCorrectionLevel: 'M', margin: 2, width: 300,
    color: { dark: '#0f172a', light: '#f8fafc' }
  });
}

module.exports = { generateClientConfig, generateQRCodeBase64 };
