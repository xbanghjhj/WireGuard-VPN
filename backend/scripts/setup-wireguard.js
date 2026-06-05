require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { generateKeyPair } = require('../src/services/keyService');

const isMock = process.env.MOCK_WIREGUARD === 'true';
const dbPath = process.env.DB_PATH || './data/database.sqlite';
const dataDir = path.dirname(dbPath);

// Tạo thư mục data nếu chưa có
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

async function runSetup() {
  console.log('=== WireGuard Controller Setup ===');
  
  // 1. Tạo Server Keys nếu chưa có
  let serverPrivateKey = '';
  let serverPublicKey = '';
  
  const serverKeyPath = path.join(dataDir, 'server_keys.json');
  if (fs.existsSync(serverKeyPath)) {
    console.log('Loading existing Server Keys...');
    const keys = JSON.parse(fs.readFileSync(serverKeyPath, 'utf8'));
    serverPrivateKey = keys.privateKey;
    serverPublicKey = keys.publicKey;
  } else {
    console.log('Generating new Server Keys...');
    const keys = generateKeyPair();
    serverPrivateKey = keys.privateKey;
    serverPublicKey = keys.publicKey;
    fs.writeFileSync(serverKeyPath, JSON.stringify(keys, null, 2), 'utf8');
    console.log('Server Keys generated and saved to', serverKeyPath);
  }

  // 2. Tạo file cấu hình wg0.conf
  const configPath = process.env.WG_CONFIG_PATH || './data/wg0.conf';
  const configDir = path.dirname(configPath);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  if (!fs.existsSync(configPath)) {
    console.log('Creating default WireGuard Server Config at:', configPath);
    const serverPort = process.env.WG_SERVER_PORT || 51820;
    const serverIP = process.env.WG_SERVER_IP || '10.0.0.1';
    
    const defaultConfig = `[Interface]
PrivateKey = ${serverPrivateKey}
Address = ${serverIP}/24
ListenPort = ${serverPort}

# PostUp/PostDown rules for NAT (Linux only)
# PostUp = iptables -A FORWARD -i %i -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
# PostDown = iptables -D FORWARD -i %i -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE
`;
    fs.writeFileSync(configPath, defaultConfig, 'utf8');
    console.log('Default config written.');
  } else {
    console.log('WireGuard config already exists at:', configPath);
  }

  // 3. Khởi tạo Admin User trong database
  const db = require('../src/db/database');
  
  // Chờ database kết nối và thiết lập xong
  setTimeout(async () => {
    try {
      const adminUsername = process.env.ADMIN_USERNAME || 'admin';
      const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
      
      const existingAdmin = await db.get('SELECT * FROM users WHERE username = ?', [adminUsername]);
      
      if (!existingAdmin) {
        console.log(`Creating Admin user: "${adminUsername}"...`);
        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        await db.run(
          'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
          [adminUsername, hashedPassword, 'admin']
        );
        console.log('Admin user created successfully.');
      } else {
        console.log(`Admin user "${adminUsername}" already exists.`);
      }
      
      console.log('=== Setup Completed Successfully ===');
      process.exit(0);
    } catch (err) {
      console.error('Setup error:', err.message);
      process.exit(1);
    }
  }, 1000);
}

runSetup().catch(err => {
  console.error('Setup script failed:', err);
  process.exit(1);
});
