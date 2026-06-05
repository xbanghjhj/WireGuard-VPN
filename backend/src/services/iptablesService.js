const { execSync } = require('child_process');

const isMock = process.env.MOCK_WIREGUARD === 'true';

/**
 * Chặn lưu lượng truy cập của một Peer IP thông qua iptables.
 * @param {string} clientIP IP của client (vd: 10.0.0.5)
 * @returns {Promise<boolean>}
 */
async function blockClientIP(clientIP) {
  if (!clientIP) return false;
  // Trích xuất IP sạch (loại bỏ /32 nếu có)
  const cleanIP = clientIP.split('/')[0];
  
  if (isMock) {
    console.log(`[MOCK] Firewall rules: Blocked client IP ${cleanIP} via iptables.`);
    return true;
  } else {
    try {
      // Thêm quy tắc DROP vào đầu chuỗi FORWARD
      // Kiểm tra xem quy tắc đã tồn tại chưa để tránh trùng lặp
      try {
        execSync(`sudo iptables -C FORWARD -s ${cleanIP} -j DROP`, { stdio: 'ignore' });
        console.log(`Firewall rule already exists for blocking ${cleanIP}`);
        return true;
      } catch (checkErr) {
        // Lệnh check trả về lỗi nghĩa là quy tắc chưa có -> Tiến hành thêm mới
        execSync(`sudo iptables -I FORWARD -s ${cleanIP} -j DROP`);
        console.log(`Successfully blocked client IP ${cleanIP} via iptables.`);
        return true;
      }
    } catch (err) {
      console.error(`Failed to block client IP ${cleanIP} via iptables:`, err.message);
      return false;
    }
  }
}

/**
 * Mở chặn lưu lượng truy cập của một Peer IP thông qua iptables.
 * @param {string} clientIP IP của client (vd: 10.0.0.5)
 * @returns {Promise<boolean>}
 */
async function unblockClientIP(clientIP) {
  if (!clientIP) return false;
  const cleanIP = clientIP.split('/')[0];
  
  if (isMock) {
    console.log(`[MOCK] Firewall rules: Unblocked client IP ${cleanIP} via iptables.`);
    return true;
  } else {
    try {
      // Xóa tất cả quy tắc DROP cho IP này trong chuỗi FORWARD
      let deleted = false;
      while (true) {
        try {
          execSync(`sudo iptables -D FORWARD -s ${cleanIP} -j DROP`, { stdio: 'ignore' });
          deleted = true;
        } catch (e) {
          // Khi không xóa được nữa (hết quy tắc trùng khớp)
          break;
        }
      }
      if (deleted) {
        console.log(`Successfully unblocked client IP ${cleanIP} via iptables.`);
      } else {
        console.log(`No blocking firewall rules found for ${cleanIP}.`);
      }
      return true;
    } catch (err) {
      console.error(`Failed to unblock client IP ${cleanIP} via iptables:`, err.message);
      return false;
    }
  }
}

module.exports = {
  blockClientIP,
  unblockClientIP
};
