'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Shield, Activity, Trash2, Key, Cpu,
  Server, Plus, Search, LogOut, Download, QrCode, 
  Clock, ArrowUpRight, ArrowDownLeft
} from 'lucide-react';

import { getUser, clearSession, isAuthenticated } from '../../lib/auth';
import usePeers from '../../hooks/usePeers';
import useWebSocket from '../../hooks/useWebSocket';

import BandwidthChart from '../../components/BandwidthChart';
import AddPeerModal from '../../components/AddPeerModal';
import QRCodeModal from '../../components/QRCodeModal';

export default function Dashboard() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  
  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isQROpen, setIsQROpen] = useState(false);
  const [selectedPeer, setSelectedPeer] = useState(null);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Custom hooks
  const { 
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
  } = usePeers();

  const { stats: liveStats, isConnected: wsConnected } = useWebSocket();
  const isAdmin = currentUser?.role === 'admin';

  // Kiểm tra đăng nhập
  useEffect(() => {
    const handleExpiredSession = () => router.replace('/login');
    window.addEventListener('auth:expired', handleExpiredSession);
    if (!isAuthenticated()) {
      router.replace('/login');
    } else {
      // Session storage is an external browser system; this hydrates its snapshot client-side.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCurrentUser(getUser());
      fetchPeers().catch(() => {});
    }
    return () => window.removeEventListener('auth:expired', handleExpiredSession);
  }, [router, fetchPeers]);

  // Đồng bộ hóa danh sách peer từ dữ liệu WebSocket thời gian thực
  useEffect(() => {
    if (liveStats && liveStats.peers) {
      setPeers(liveStats.peers);
    }
  }, [liveStats, setPeers]);

  const handleLogout = () => {
    clearSession();
    router.push('/login');
  };

  const handleOpenQR = (peer) => {
    setSelectedPeer(peer);
    setIsQROpen(true);
  };

  // Tính toán các thông số tổng quan từ danh sách peers
  const statsOverview = useMemo(() => {
    const total = peers.length;
    const online = peers.filter(p => p.online && p.enabled).length;
    
    let totalRx = 0;
    let totalTx = 0;
    
    peers.forEach(p => {
      totalRx += p.rxBytes || 0;
      totalTx += p.txBytes || 0;
    });

    return {
      total,
      online,
      totalRxFormatted: formatBytes(totalRx),
      totalTxFormatted: formatBytes(totalTx)
    };
  }, [peers]);

  // Lọc danh sách peers theo tìm kiếm
  const filteredPeers = useMemo(() => {
    return peers.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.allowedIPs && p.allowedIPs.includes(searchQuery))
    );
  }, [peers, searchQuery]);

  // Quy đổi Last Handshake sang dạng tương đối
  const timeAgo = (dateString) => {
    if (!dateString) return 'Chưa kết nối';
    try {
      const now = new Date();
      const past = new Date(dateString);
      const diffMs = now - past;
      const diffSec = Math.floor(diffMs / 1000);
      
      if (diffSec < 5) return 'Vừa mới đây';
      if (diffSec < 60) return `${diffSec} giây trước`;
      
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin} phút trước`;
      
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) return `${diffHr} giờ trước`;
      
      return past.toLocaleDateString();
    } catch {
      return 'Không xác định';
    }
  };

  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  return (
    <div className="min-h-screen bg-gradient-to-tr from-sky-100 via-sky-50 to-indigo-50/50 pb-12">
      
      {/* Dynamic Animated Background Orbs */}
      <div className="absolute top-0 right-0 w-[30vw] h-[30vw] rounded-full bg-sky-200/20 blur-[80px] pointer-events-none"></div>
      <div className="absolute bottom-10 left-10 w-[25vw] h-[25vw] rounded-full bg-indigo-200/20 blur-[70px] pointer-events-none"></div>

      {/* Modern Header */}
      <header className="sticky top-0 z-40 bg-white/70 backdrop-blur-md border-b border-sky-100/80 px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-gradient-to-br from-sky-500 to-sky-600 text-white rounded-xl shadow-md neon-glow-blue">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-800 tracking-tight">WireGuard Dashboard</h1>
              <p className="text-xs font-semibold text-slate-400 flex items-center space-x-1">
                <span className={`inline-block w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500 animate-pulse' : 'bg-red-400'}`}></span>
                <span>{wsConnected ? 'Kết nối Live-sync' : 'Mất kết nối Live'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-sm font-bold text-slate-700 capitalize">{currentUser?.username || 'Admin'}</span>
              <span className="text-[10px] font-bold text-sky-600 bg-sky-100/50 px-2 py-0.5 rounded-full self-end uppercase">
                {currentUser?.role || 'Administrator'}
              </span>
            </div>
            
            <button 
              onClick={handleLogout}
              className="p-2.5 hover:bg-red-50 text-slate-500 hover:text-red-600 rounded-xl transition duration-300 border border-transparent hover:border-red-100"
              title="Đăng xuất"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8 animate-fade-in relative z-10">
        {error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}
        
        {/* Top Widgets Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* Card: Total Peers */}
          <div className="glass-card glass-card-hover rounded-2xl p-5 flex items-center space-x-4">
            <div className="p-3.5 bg-sky-100 text-sky-600 rounded-2xl shadow-sm">
              <Server className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Thiết bị cấu hình</p>
              <p className="text-2xl font-black text-slate-800">{statsOverview.total} Clients</p>
            </div>
          </div>

          {/* Card: Active Connections */}
          <div className="glass-card glass-card-hover rounded-2xl p-5 flex items-center space-x-4">
            <div className={`p-3.5 rounded-2xl shadow-sm ${statsOverview.online > 0 ? 'bg-green-100 text-green-600 neon-glow-green' : 'bg-slate-100 text-slate-500'}`}>
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Đang hoạt động</p>
              <p className="text-2xl font-black text-slate-800">{statsOverview.online} Đang chạy</p>
            </div>
          </div>

          {/* Card: Total Download */}
          <div className="glass-card glass-card-hover rounded-2xl p-5 flex items-center space-x-4">
            <div className="p-3.5 bg-sky-100 text-sky-600 rounded-2xl shadow-sm">
              <ArrowDownLeft className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Tổng tải xuống (DL)</p>
              <p className="text-2xl font-black text-slate-800">{statsOverview.totalRxFormatted}</p>
            </div>
          </div>

          {/* Card: Total Upload */}
          <div className="glass-card glass-card-hover rounded-2xl p-5 flex items-center space-x-4">
            <div className="p-3.5 bg-indigo-100 text-indigo-600 rounded-2xl shadow-sm">
              <ArrowUpRight className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Tổng tải lên (UL)</p>
              <p className="text-2xl font-black text-slate-800">{statsOverview.totalTxFormatted}</p>
            </div>
          </div>

        </section>

        {/* Resources & Real-time Charts Section */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Real-time Bandwidth Graph */}
          <div className="lg:col-span-2 glass-card rounded-2xl p-6 flex flex-col justify-between h-[360px] shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Activity className="h-5 w-5 text-sky-600" />
                <h3 className="font-bold text-slate-800">Biểu đồ băng thông hệ thống</h3>
              </div>
              <span className="text-[10px] font-bold text-sky-500 bg-sky-50 px-2.5 py-1 rounded-full uppercase tracking-wider animate-pulse-slow">
                Live (2s)
              </span>
            </div>
            <div className="flex-1 min-h-0">
              <BandwidthChart liveData={liveStats} />
            </div>
          </div>

          {/* Server Resources Utilization */}
          <div className="glass-card rounded-2xl p-6 flex flex-col justify-between h-[360px] shadow-sm">
            <div className="flex items-center space-x-2 mb-4 border-b border-sky-100 pb-3">
              <Cpu className="h-5 w-5 text-indigo-600" />
              <h3 className="font-bold text-slate-800">Hiệu năng máy chủ</h3>
            </div>

            <div className="flex-1 flex flex-col justify-around py-2">
              {/* CPU Progress */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold text-slate-600">
                  <span>Vi xử lý (CPU)</span>
                  <span>{liveStats?.server?.cpuUsage || 0}%</span>
                </div>
                <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-sky-100">
                  <div 
                    className="h-full bg-gradient-to-r from-sky-500 to-sky-600 rounded-full transition-all duration-1000"
                    style={{ width: `${liveStats?.server?.cpuUsage || 0}%` }}
                  ></div>
                </div>
              </div>

              {/* Memory Progress */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold text-slate-600">
                  <span>Bộ nhớ đệm (RAM)</span>
                  <span>{liveStats?.server?.ramUsage || 0}%</span>
                </div>
                <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-sky-100">
                  <div 
                    className="h-full bg-gradient-to-r from-indigo-500 to-sky-500 rounded-full transition-all duration-1000"
                    style={{ width: `${liveStats?.server?.ramUsage || 0}%` }}
                  ></div>
                </div>
              </div>

              {/* Uptime details */}
              <div className="bg-sky-50/60 rounded-xl p-3 border border-sky-100/50 flex items-center justify-between text-xs text-slate-600 font-semibold">
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-sky-500" />
                  <span>Thời gian hệ thống chạy:</span>
                </div>
                <span className="text-slate-800">
                  {liveStats?.server?.uptime 
                    ? `${Math.floor(liveStats.server.uptime / 3600)}h ${Math.floor((liveStats.server.uptime % 3600) / 60)}m` 
                    : 'Đang tải...'}
                </span>
              </div>
            </div>
          </div>

        </section>

        {/* Peers List Management */}
        <section className="glass-card rounded-2xl shadow-sm overflow-hidden border border-white/60">
          
          {/* Table Header controls */}
          <div className="px-6 py-5 border-b border-sky-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white/30">
            <div className="flex items-center space-x-2 self-start sm:self-auto">
              <h3 className="font-bold text-slate-800 text-lg">Danh sách kết nối VPN</h3>
              {loading && <div className="animate-spin rounded-full h-4 w-4 border-2 border-sky-500 border-t-transparent"></div>}
            </div>

            <div className="w-full sm:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Search Bar */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Search className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  placeholder="Tìm kiếm thiết bị, IP..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full sm:w-64 pl-9 pr-4 py-2 text-sm rounded-xl border border-sky-100 bg-white/60 focus:outline-none focus:border-sky-500 focus:bg-white transition"
                />
              </div>

              {/* Add New Peer Button */}
              {isAdmin && <button
                onClick={() => setIsAddOpen(true)}
                className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-sky-600 to-sky-500 hover:from-sky-700 hover:to-sky-600 text-white font-semibold text-sm rounded-xl shadow-md shadow-sky-500/10 active:scale-95 transition"
              >
                <Plus className="h-4 w-4" />
                <span>Thêm kết nối</span>
              </button>}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-sky-50/50 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-sky-100">
                  <th className="px-6 py-4">Tên Client</th>
                  <th className="px-6 py-4">IP VPN</th>
                  <th className="px-6 py-4">Trạng thái</th>
                  <th className="px-6 py-4">Handshake</th>
                  <th className="px-6 py-4">Lưu lượng RX / TX</th>
                  <th className="px-6 py-4">Endpoint thực</th>
                  {isAdmin && <th className="px-6 py-4 text-right">Hành động</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-sky-100/50 bg-white/20">
                {filteredPeers.length > 0 ? (
                  filteredPeers.map((peer) => (
                    <tr 
                      key={peer.id} 
                      className={`hover:bg-sky-50/30 transition duration-150 ${!peer.enabled ? 'opacity-60 bg-slate-50/20' : ''}`}
                    >
                      {/* Name */}
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className={`p-2 rounded-xl ${peer.enabled ? 'bg-sky-100 text-sky-600' : 'bg-slate-100 text-slate-400'}`}>
                            <Key className="h-4 w-4" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-800 block text-sm">{peer.name}</span>
                            <span className="text-[10px] font-mono text-slate-400 block truncate max-w-[150px]">{peer.publicKey}</span>
                          </div>
                        </div>
                      </td>

                      {/* AllowedIPs */}
                      <td className="px-6 py-4 font-mono text-sm font-semibold text-slate-700">
                        {peer.allowedIPs}
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        {peer.enabled ? (
                          peer.online ? (
                            <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-100">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                              <span>Hoạt động</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-50 text-slate-500 border border-slate-150">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                              <span>Chờ kết nối</span>
                            </span>
                          )
                        ) : (
                          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50/80 text-red-600 border border-red-100">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                            <span>Bị chặn</span>
                          </span>
                        )}
                      </td>

                      {/* Handshake */}
                      <td className="px-6 py-4 text-xs font-semibold text-slate-500">
                        {peer.enabled ? timeAgo(peer.lastHandshake) : '—'}
                      </td>

                      {/* Rx / Tx bytes */}
                      <td className="px-6 py-4">
                        <div className="flex flex-col text-xs font-bold text-slate-600">
                          <span className="flex items-center text-sky-600">
                            <ArrowDownLeft className="h-3 w-3 mr-0.5" />
                            <span>{peer.rxFormatted || formatBytes(peer.rxBytes || 0)}</span>
                          </span>
                          <span className="flex items-center text-indigo-500 mt-0.5">
                            <ArrowUpRight className="h-3 w-3 mr-0.5" />
                            <span>{peer.txFormatted || formatBytes(peer.txBytes || 0)}</span>
                          </span>
                        </div>
                      </td>

                      {/* Real Endpoint */}
                      <td className="px-6 py-4 font-mono text-xs text-slate-500">
                        {peer.enabled ? (peer.endpoint || '—') : '—'}
                      </td>

                      {/* Actions */}
                      {isAdmin && <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          
                          {/* Enable/Disable Toggle */}
                          <label className="relative inline-flex items-center cursor-pointer mr-2">
                            <input
                              type="checkbox"
                              checked={peer.enabled}
                              onChange={(e) => togglePeer(peer.id, e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500"></div>
                          </label>

                          {/* Get QR Code */}
                          <button
                            onClick={() => handleOpenQR(peer)}
                            disabled={!peer.enabled}
                            className="p-2 bg-sky-50 hover:bg-sky-100 text-sky-600 rounded-xl transition duration-200 border border-sky-100/50 disabled:opacity-40 disabled:hover:bg-sky-50 disabled:cursor-not-allowed"
                            title="Hiển thị QR Code"
                          >
                            <QrCode className="h-4 w-4" />
                          </button>

                          {/* Download config */}
                          <button
                            onClick={() => downloadConfig(peer.id, peer.name)}
                            className="p-2 bg-sky-50 hover:bg-sky-100 text-sky-600 rounded-xl transition duration-200 border border-sky-100/50"
                            title="Tải tệp cấu hình"
                          >
                            <Download className="h-4 w-4" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => {
                              if (confirm(`Bạn có chắc chắn muốn xóa kết nối của "${peer.name}" vĩnh viễn?`)) {
                                deletePeer(peer.id);
                              }
                            }}
                            className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition duration-200 border border-red-100/30"
                            title="Xóa vĩnh viễn"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>

                        </div>
                      </td>}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={isAdmin ? 7 : 6} className="px-6 py-12 text-center text-sm font-semibold text-slate-400 bg-white/10">
                      Không tìm thấy kết nối VPN nào.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

        </section>

      </main>

      {/* Add Peer Modal */}
      {isAdmin && <AddPeerModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onCreate={createPeer}
      />}

      {/* QR Code / Config Viewer Modal */}
      {isAdmin && <QRCodeModal
        isOpen={isQROpen}
        onClose={() => {
          setIsQROpen(false);
          setSelectedPeer(null);
        }}
        peer={selectedPeer}
        getQRCode={getQRCode}
        downloadConfig={downloadConfig}
      />}

    </div>
  );
}
