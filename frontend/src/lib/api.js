import axios from 'axios';
import { getToken, clearSession } from './auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor đính kèm JWT Token vào request headers
api.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor xử lý lỗi Unauthorized (401/403)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearSession();
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('auth:expired'));
    }
    return Promise.reject(error);
  }
);

export default api;
