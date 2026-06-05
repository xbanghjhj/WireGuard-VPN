import { useState } from 'react';
import { X, Plus, Info } from 'lucide-react';

export default function AddPeerModal({ isOpen, onClose, onCreate }) {
  const [name, setName] = useState('');
  const [dns, setDns] = useState('1.1.1.1, 8.8.8.8');
  const [splitTunnel, setSplitTunnel] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Tên thiết bị/nhân viên không được để trống.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      await onCreate({ name, dns, splitTunnel });
      setName('');
      setDns('1.1.1.1, 8.8.8.8');
      setSplitTunnel(false);
      onClose();
    } catch (err) {
      setError(err.message || 'Lỗi xảy ra khi tạo VPN Peer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-sky-950/20 backdrop-blur-sm animate-fade-in p-4">
      <div className="w-full max-w-md glass-card rounded-2xl p-6 shadow-2xl animate-scale-up relative border border-white/60">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-sky-100 pb-4 mb-4">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-sky-100 text-sky-600 rounded-lg">
              <Plus className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">Thêm VPN Client mới</h2>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 hover:bg-sky-100 rounded-full text-slate-400 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
              Tên thiết bị / Nhân viên
            </label>
            <input
              type="text"
              placeholder="Ví dụ: Nguyen Van A - Laptop"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-3 rounded-xl border border-sky-100 bg-white/50 text-slate-800 focus:outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100 transition"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
              Custom DNS Servers
            </label>
            <input
              type="text"
              placeholder="1.1.1.1, 8.8.8.8"
              value={dns}
              onChange={(e) => setDns(e.target.value)}
              className="w-full p-3 rounded-xl border border-sky-100 bg-white/50 text-slate-800 focus:outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100 transition"
            />
          </div>

          {/* Toggle Split Tunneling */}
          <div className="flex items-center justify-between p-3 bg-sky-50/50 rounded-xl border border-sky-100/50">
            <div className="flex items-center space-x-2">
              <div className="text-sky-500">
                <Info className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-800">Split Tunneling</h4>
                <p className="text-xs text-slate-500">Chỉ định tuyến mạng nội bộ qua VPN</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={splitTunnel}
                onChange={(e) => setSplitTunnel(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-350 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-500"></div>
            </label>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center space-x-3 pt-4 border-t border-sky-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 p-3 rounded-xl hover:bg-slate-100 text-slate-600 font-semibold transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 p-3 rounded-xl bg-gradient-to-r from-sky-600 to-sky-500 hover:from-sky-700 hover:to-sky-600 text-white font-semibold shadow-lg shadow-sky-500/20 active:scale-95 transition"
            >
              {isSubmitting ? 'Đang tạo...' : 'Tạo kết nối'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
