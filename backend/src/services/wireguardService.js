const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const db = require('../db/database');

const isMock = process.env.MOCK_WIREGUARD === 'true';
const configPath = process.env.WG_CONFIG_PATH || './data/wg0.conf';
const dbPath = process.env.DB_PATH || './data/database.sqlite';
const wgInterface = process.env.WG_INTERFACE || 'wg0';

/**
 * Đồng bộ hóa dữ liệu từ database ghi đè vào file wg0.conf
 * và reload lại WireGuard interface.
 */
async function syncWireGuardConfig() {
  try {
    console.log('Syncing WireGuard configuration...');
    
    // 1. Lấy thông tin server keys
    const dataDir = path.dirname(dbPath);
    const serverKeyPath = path.join(dataDir, 'server_keys.json');
    let serverPrivateKey = '';
    
    if (fs.existsSync(serverKeyPath)) {
      const keys = JSON.parse(fs.readFileSync(serverKeyPath, 'utf8'));
      serverPrivateKey = keys.privateKey;
    } else {
      throw new Error('Server keys not found. Please run setup first.');
    }

    // 2. Tạo phần Interface cơ bản
    const serverPort = process.env.WG_SERVER_PORT || 51820;
    const serverIP = process.env.WG_SERVER_IP || '10.0.0.1';
    
    let configContent = `[Interface]
PrivateKey = ${serverPrivateKey}
Address = ${serverIP}/24
ListenPort = ${serverPort}

# PostUp/PostDown rules for NAT
# PostUp = iptables -A FORWARD -i %i -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
# PostDown = iptables -D FORWARD -i %i -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE

`;

    // 3. Lấy tất cả Peers ENABLED từ database để ghi vào file
    const peers = await db.all('SELECT * FROM peers WHERE enabled = 1');
    
    peers.forEach(peer => {
      configContent += `### Client: ${peer.name} (${peer.id})
[Peer]
PublicKey = ${peer.publicKey}
AllowedIPs = ${peer.allowedIPs}

`;
    });

    // Ghi cấu hình ra file
    fs.writeFileSync(configPath, configContent, 'utf8');
    console.log(`Successfully wrote ${peers.length} active peers to ${configPath}`);

    // 4. Thực thi nạp lại cấu hình WireGuard
    if (isMock) {
      console.log(`[MOCK] Reloaded WireGuard interface '${wgInterface}' using config: ${configPath}`);
    } else {
      try {
        // wg syncconf nạp cấu hình mới mà không làm rớt các kết nối cũ
        // Cần trích xuất các Peer và cấu hình nạp vào wg mà không có phần [Interface]
        // Sử dụng wg syncconf <interface> <(wg-quick strip <config_path>)
        execSync(`wg syncconf ${wgInterface} <(wg-quick strip ${configPath})`, { shell: '/bin/bash' });
        console.log(`Successfully synced real WireGuard interface ${wgInterface}`);
      } catch (err) {
        console.error('Error applying config to real WireGuard interface:', err.message);
        console.log('Running in fallback mode (command execution failed, configuration file updated).');
      }
    }
    return true;
  } catch (error) {
    console.error('Sync WireGuard config error:', error);
    return false;
  }
}

module.exports = {
  syncWireGuardConfig
};
