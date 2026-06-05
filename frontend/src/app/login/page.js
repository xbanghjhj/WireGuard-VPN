'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Lock, User, Eye, EyeOff } from 'lucide-react';
import api from '../../lib/api';
import { setSession, isAuthenticated } from '../../lib/auth';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated()) {
      router.replace('/dashboard');
    }
  }, [router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Vui lòng nhập đầy đủ tài khoản và mật khẩu.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await api.post('/api/auth/login', { username, password });
      const { token, user } = response.data;
      setSession(token, user);
      router.push('/dashboard');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Kết nối máy chủ thất bại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-tr from-sky-100 via-sky-50 to-indigo-100 p-4">
      {/* Dynamic Animated Background Circles */}
      <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-sky-200/40 blur-[80px] animate-float-slow"></div>
      <div className="absolute bottom-[-15%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-indigo-200/30 blur-[100px] animate-float-fast"></div>
      <div className="absolute top-[30%] right-[10%] w-[25vw] h-[25vw] rounded-full bg-sky-100/50 blur-[60px] animate-float-slow"></div>

      {/* Main Login Card */}
      <div className="w-full max-w-md glass-card rounded-3xl shadow-2xl border border-white/60 p-8 z-10 animate-fade-in">
        
        {/* Logo and Brand */}
        <div className="flex flex-col items-center justify-center text-center space-y-3 mb-8">
          <div className="p-4 bg-gradient-to-br from-sky-500 to-sky-600 text-white rounded-2xl shadow-xl shadow-sky-500/20 neon-glow-blue animate-float-slow">
            <Shield className="h-10 w-10" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-800 bg-gradient-to-r from-sky-800 to-indigo-800 bg-clip-text text-transparent">
              WireGuard Portal
            </h1>
            <p className="text-sm font-medium text-slate-500 mt-1">
              Hệ thống điều phối kết nối VPN doanh nghiệp
            </p>
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-3.5 bg-red-50/80 backdrop-blur border border-red-100 text-red-600 rounded-2xl text-xs font-semibold animate-scale-up">
              {error}
            </div>
          )}

          {/* Username Input */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 px-1">
              Tài khoản Admin
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <User className="h-4 w-4" />
              </div>
              <input
                type="text"
                placeholder="Nhập tên đăng nhập..."
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-3.5 rounded-2xl border border-sky-150 bg-white/40 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:bg-white/80 focus:ring-4 focus:ring-sky-100 transition duration-300"
                required
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 px-1">
              Mật khẩu truy cập
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="h-4 w-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Nhập mật khẩu của bạn..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-3.5 rounded-2xl border border-sky-150 bg-white/40 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:bg-white/80 focus:ring-4 focus:ring-sky-100 transition duration-300"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-sky-600 via-sky-500 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white font-bold shadow-lg shadow-sky-500/25 active:scale-[0.98] disabled:scale-100 disabled:opacity-50 transition-all duration-200 mt-6"
          >
            {loading ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                <span>Đang kiểm tra bảo mật...</span>
              </div>
            ) : (
              'Đăng nhập Hệ thống'
            )}
          </button>
        </form>

        {/* Footer info */}
        <div className="text-center text-slate-400 text-xs mt-8 font-medium">
          Dự án WireGuard VPN Controller © 2026
        </div>
      </div>
    </div>
  );
}
