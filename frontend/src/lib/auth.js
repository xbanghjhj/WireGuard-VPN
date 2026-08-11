/**
 * Lưu JWT Token và thông tin user vào localStorage.
 * @param {string} token 
 * @param {object} user 
 */
export function setSession(token, user) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('vpn_token', token);
    localStorage.setItem('vpn_user', JSON.stringify(user));
  }
}

/**
 * Xóa thông tin session hiện tại (Logout).
 */
export function clearSession() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('vpn_token');
    localStorage.removeItem('vpn_user');
  }
}

/**
 * Lấy JWT Token đang lưu hành.
 * @returns {string|null}
 */
export function getToken() {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('vpn_token');
  }
  return null;
}

/**
 * Lấy thông tin user hiện tại.
 * @returns {object|null}
 */
export function getUser() {
  if (typeof window !== 'undefined') {
    const userStr = localStorage.getItem('vpn_user');
    try {
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Kiểm tra xem client có đang đăng nhập hợp lệ hay không.
 * @returns {boolean}
 */
export function isAuthenticated() {
  return !!getToken();
}
