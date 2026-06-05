const { execSync } = require('child_process');
const crypto = require('crypto');

const isMock = process.env.MOCK_WIREGUARD === 'true';

/**
 * Sinh cặp private key và public key cho WireGuard.
 * @returns { { privateKey: string, publicKey: string } }
 */
function generateKeyPair() {
  if (isMock) {
    // Trong chế độ Mock, tạo ngẫu nhiên 32 byte base64 tương tự WireGuard keys
    const privateKey = crypto.randomBytes(32).toString('base64');
    // Tạo public key ngẫu nhiên khác để hiển thị
    const publicKey = crypto.randomBytes(32).toString('base64');
    return { privateKey, publicKey };
  } else {
    try {
      // Trên Linux thực tế, gọi lệnh WireGuard CLI
      const privateKey = execSync('wg genkey').toString().trim();
      const publicKey = execSync(`echo "${privateKey}" | wg pubkey`).toString().trim();
      return { privateKey, publicKey };
    } catch (error) {
      console.error('Error generating real WireGuard keys, using fallback random generation:', error.message);
      // Fallback nếu không có wg command trên máy
      const privateKey = crypto.randomBytes(32).toString('base64');
      const publicKey = crypto.randomBytes(32).toString('base64');
      return { privateKey, publicKey };
    }
  }
}

module.exports = {
  generateKeyPair
};
