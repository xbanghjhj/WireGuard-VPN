import { useState, useCallback } from 'react';
import api from '../lib/api';

export default function usePeers() {
  const [peers, setPeers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Lấy danh sách peers
  const fetchPeers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/api/peers');
      setPeers(response.data);
      return response.data;
    } catch (err) {
      const msg = err.response?.data?.message || 'Error fetching peers.';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  // Tạo mới Peer
  const createPeer = useCallback(async ({ name, dns, splitTunnel }) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post('/api/peers', { name, dns, splitTunnel });
      // Thêm peer mới vào danh sách hiện tại
      setPeers(prev => [...prev, response.data]);
      return response.data;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to create peer.';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  // Bật/tắt Peer
  const togglePeer = useCallback(async (id, enabled) => {
    setError(null);
    try {
      const response = await api.patch(`/api/peers/${id}`, { enabled });
      // Cập nhật trạng thái trong client list
      setPeers(prev =>
        prev.map(p => (p.id === id ? { ...p, enabled: response.data.enabled } : p))
      );
      return response.data;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update peer status.';
      setError(msg);
      throw new Error(msg);
    }
  }, []);

  // Xóa Peer
  const deletePeer = useCallback(async (id) => {
    setError(null);
    try {
      await api.delete(`/api/peers/${id}`);
      setPeers(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to delete peer.';
      setError(msg);
      throw new Error(msg);
    }
  }, []);

  // Tải file cấu hình .conf
  const downloadConfig = useCallback(async (id, filename) => {
    let url;
    try {
      const response = await api.get(`/api/peers/${id}/config`, {
        responseType: 'blob'
      });
      // Tạo URL download file
      url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${filename.replace(/[^a-zA-Z0-9]/g, '_')}.conf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to download peer config.';
      setError(msg);
      throw new Error(msg);
    } finally {
      if (url) window.URL.revokeObjectURL(url);
    }
  }, []);

  // Lấy mã QR Code (base64)
  const getQRCode = useCallback(async (id) => {
    try {
      const response = await api.get(`/api/peers/${id}/qrcode`);
      return response.data.qrCode;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to retrieve QR Code.';
      setError(msg);
      throw new Error(msg);
    }
  }, []);

  return {
    peers,
    setPeers,
    loading,
    error,
    fetchPeers,
    createPeer,
    togglePeer,
    deletePeer,
    downloadConfig,
    getQRCode
  };
}
