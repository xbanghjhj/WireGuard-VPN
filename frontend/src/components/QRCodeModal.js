import { useEffect, useState } from 'react';
import { X, Download, Copy, Check, QrCode } from 'lucide-react';

export default function QRCodeModal({ isOpen, onClose, peer, getQRCode, downloadConfig }) {
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && peer) {
      setLoading(true);
      getQRCode(peer.id)
        .then(url => {
          setQrCodeUrl(url);
        })
        .catch(err => {
          console.error(err);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setQrCodeUrl('');
    }
  }, [isOpen, peer, getQRCode]);

  if (!isOpen || !peer) return null;

  const handleCopyKey = () => {
    navigator.clipboard.writeText(peer.publicKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-sky-950/20 backdrop-blur-sm animate-fade-in p-4">
      <div className="w-full max-w-md glass-card rounded-2xl p-6 shadow-2xl animate-scale-up border border-white/60">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-sky-100 pb-4 mb-4">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-sky-100 text-sky-600 rounded-lg">
              <QrCode className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Cấu hình kết nối VPN</h2>
              <p className="text-xs text-slate-500">{peer.name}</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 hover:bg-sky-100 rounded-full text-slate-400 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col items-center justify-center space-y-4">
          {/* QR Code Container */}
          <div className="relative w-64 h-64 flex items-center justify-center bg-slate-50 border border-sky-100 rounded-xl p-2 shadow-inner overflow-hidden">
            {loading ? (
              <div className="flex flex-col items-center space-y-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500"></div>
                <p className="text-xs text-slate-400">Đang tạo QR Code...</p>
              </div>
            ) : qrCodeUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img 
                src={qrCodeUrl} 
                alt="WireGuard Configuration QR Code" 
                className="w-full h-full object-contain animate-scale-up" 
              />
            ) : (
              <p className="text-xs text-red-500">Không thể tạo QR Code</p>
            )}
          </div>

          <p className="text-xs text-center text-slate-500 max-w-xs leading-relaxed">
            Quét mã QR bằng ứng dụng <strong>WireGuard</strong> trên điện thoại (Android/iOS) hoặc tải file cấu hình về máy tính.
          </p>

          {/* Connection Details */}
          <div className="w-full bg-sky-50/50 border border-sky-100/50 rounded-xl p-3 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Địa chỉ IP ảo:</span>
              <span className="font-semibold text-slate-700">{peer.allowedIPs}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Public Key:</span>
              <div className="flex items-center space-x-1">
                <span className="font-mono text-slate-500 truncate max-w-[150px]">{peer.publicKey}</span>
                <button 
                  onClick={handleCopyKey}
                  className="p-1 hover:bg-sky-200 text-sky-600 rounded transition"
                  title="Copy Public Key"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="w-full flex space-x-3 pt-2">
            <button
              onClick={() => downloadConfig(peer.id, peer.name)}
              className="flex-1 flex items-center justify-center space-x-2 p-3 bg-gradient-to-r from-sky-600 to-sky-500 hover:from-sky-700 hover:to-sky-600 text-white font-semibold rounded-xl shadow-lg shadow-sky-500/20 active:scale-95 transition"
            >
              <Download className="h-4 w-4" />
              <span>Tải cấu hình (.conf)</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
