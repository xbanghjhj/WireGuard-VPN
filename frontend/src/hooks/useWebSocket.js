import { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { getToken, isAuthenticated, clearSession } from '../lib/auth';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3000';

export default function useWebSocket() {
  const [stats, setStats] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated()) return;

    const token = getToken();
    
    // Khởi tạo kết nối Socket.IO
    const socket = io(WS_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('WebSocket connected to backend.');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('WebSocket disconnected.');
      setIsConnected(false);
    });

    socket.on('stats:update', (data) => {
      setStats(data);
    });

    socket.on('connect_error', (err) => {
      console.error('WebSocket connection error:', err.message);
      setIsConnected(false);
      if (/authentication error/i.test(err.message)) {
        clearSession();
        window.dispatchEvent(new Event('auth:expired'));
      }
    });

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  return {
    stats,
    isConnected
  };
}
