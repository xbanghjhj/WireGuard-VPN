const fs = require('fs');
const path = require('path');

const dbPath = process.env.DB_PATH || './data/database.sqlite';
const dbDir = path.dirname(dbPath);

// Đảm bảo thư mục lưu database tồn tại
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let dbInstance = null;
let useJsonFallback = false;
let jsonDbPath = path.join(dbDir, 'database_fallback.json');

// Khởi tạo SQLite hoặc fallback sang JSON
function initializeDatabase() {
  try {
    const sqlite3 = require('sqlite3').verbose();
    console.log('尝试连接 SQLite Database...');
    
    dbInstance = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('SQLite connection error, falling back to JSON database:', err.message);
        setupJsonDatabase();
      } else {
        console.log('SQLite Database Connected.');
        setupSqliteSchema();
      }
    });
  } catch (e) {
    console.warn('SQLite module failed to load, falling back to JSON database:', e.message);
    setupJsonDatabase();
  }
}

// Khởi tạo bảng SQLite
function setupSqliteSchema() {
  dbInstance.serialize(() => {
    // Bảng users
    dbInstance.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        role TEXT
      )
    `);

    // Bảng peers
    dbInstance.run(`
      CREATE TABLE IF NOT EXISTS peers (
        id TEXT PRIMARY KEY,
        name TEXT,
        publicKey TEXT UNIQUE,
        privateKey TEXT,
        allowedIPs TEXT,
        dns TEXT,
        createdAt TEXT,
        enabled INTEGER DEFAULT 1,
        rxBytes INTEGER DEFAULT 0,
        txBytes INTEGER DEFAULT 0,
        lastHandshake TEXT,
        endpoint TEXT
      )
    `);
  });
}

// Giả lập cấu trúc dữ liệu JSON Database
let jsonDbData = {
  users: [],
  peers: []
};

function setupJsonDatabase() {
  useJsonFallback = true;
  console.log('Using JSON File Database at:', jsonDbPath);
  
  if (fs.existsSync(jsonDbPath)) {
    try {
      const content = fs.readFileSync(jsonDbPath, 'utf8');
      jsonDbData = JSON.parse(content);
      if (!jsonDbData.users) jsonDbData.users = [];
      if (!jsonDbData.peers) jsonDbData.peers = [];
    } catch (e) {
      console.error('Error reading JSON fallback database, resetting data:', e.message);
    }
  } else {
    saveJsonDatabase();
  }
}

function saveJsonDatabase() {
  try {
    fs.writeFileSync(jsonDbPath, JSON.stringify(jsonDbData, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving JSON database:', e.message);
  }
}

// Tạo Interface API đồng nhất cho cả 2 loại DB
const db = {
  // Lấy nhiều dòng
  all: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      if (!useJsonFallback) {
        dbInstance.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      } else {
        try {
          const result = queryJson(sql, params);
          resolve(result);
        } catch (e) {
          reject(e);
        }
      }
    });
  },

  // Lấy 1 dòng
  get: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      if (!useJsonFallback) {
        dbInstance.get(sql, params, (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      } else {
        try {
          const result = queryJson(sql, params);
          resolve(result.length > 0 ? result[0] : null);
        } catch (e) {
          reject(e);
        }
      }
    });
  },

  // Chạy câu lệnh Insert/Update/Delete
  run: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      if (!useJsonFallback) {
        dbInstance.run(sql, params, function (err) {
          if (err) reject(err);
          else resolve({ lastID: this.lastID, changes: this.changes });
        });
      } else {
        try {
          const result = executeJson(sql, params);
          resolve(result);
        } catch (e) {
          reject(e);
        }
      }
    });
  }
};

// Xử lý truy vấn giả lập cho JSON database (chỉ cần hỗ trợ các câu SQL cơ bản trong dự án)
function queryJson(sql, params) {
  const normalizedSql = sql.replace(/\s+/g, ' ').trim().toLowerCase();
  
  if (normalizedSql.includes('select * from users where username =')) {
    const username = params[0];
    return jsonDbData.users.filter(u => u.username === username);
  }
  
  if (normalizedSql.includes('select * from peers')) {
    if (normalizedSql.includes('where id =')) {
      const id = params[0];
      return jsonDbData.peers.filter(p => p.id === id);
    }
    return [...jsonDbData.peers];
  }
  
  return [];
}

function executeJson(sql, params) {
  const normalizedSql = sql.replace(/\s+/g, ' ').trim().toLowerCase();
  
  // INSERT INTO users
  if (normalizedSql.includes('insert into users')) {
    const [username, password, role] = params;
    // Kiểm tra trùng lặp
    if (jsonDbData.users.some(u => u.username === username)) {
      throw new Error('UNIQUE constraint failed: users.username');
    }
    const newUser = { id: Date.now(), username, password, role };
    jsonDbData.users.push(newUser);
    saveJsonDatabase();
    return { lastID: newUser.id, changes: 1 };
  }
  
  // INSERT INTO peers
  if (normalizedSql.includes('insert into peers')) {
    const [id, name, publicKey, privateKey, allowedIPs, dns, createdAt, enabled, rxBytes, txBytes, lastHandshake, endpoint] = params;
    if (jsonDbData.peers.some(p => p.id === id || p.publicKey === publicKey)) {
      throw new Error('UNIQUE constraint failed: peers.id or peers.publicKey');
    }
    const newPeer = { id, name, publicKey, privateKey, allowedIPs, dns, createdAt, enabled: enabled !== undefined ? enabled : 1, rxBytes: rxBytes || 0, txBytes: txBytes || 0, lastHandshake, endpoint };
    jsonDbData.peers.push(newPeer);
    saveJsonDatabase();
    return { lastID: id, changes: 1 };
  }
  
  // UPDATE peers (enabled)
  if (normalizedSql.includes('update peers set enabled =')) {
    const enabled = params[0];
    const id = params[1];
    const peer = jsonDbData.peers.find(p => p.id === id);
    if (peer) {
      peer.enabled = enabled;
      saveJsonDatabase();
      return { changes: 1 };
    }
    return { changes: 0 };
  }

  // UPDATE peers (rxBytes, txBytes, lastHandshake, endpoint)
  if (normalizedSql.includes('update peers set rxbytes =')) {
    const [rxBytes, txBytes, lastHandshake, endpoint, id] = params;
    const peer = jsonDbData.peers.find(p => p.id === id);
    if (peer) {
      peer.rxBytes = rxBytes;
      peer.txBytes = txBytes;
      peer.lastHandshake = lastHandshake;
      peer.endpoint = endpoint;
      saveJsonDatabase();
      return { changes: 1 };
    }
    return { changes: 0 };
  }
  
  // DELETE FROM peers
  if (normalizedSql.includes('delete from peers where id =')) {
    const id = params[0];
    const initialLength = jsonDbData.peers.length;
    jsonDbData.peers = jsonDbData.peers.filter(p => p.id !== id);
    saveJsonDatabase();
    return { changes: initialLength - jsonDbData.peers.length };
  }
  
  return { changes: 0 };
}

// Khởi chạy kết nối
initializeDatabase();

module.exports = db;
