import React, { useState, useEffect } from 'react';
import { Sparkles, Shield, LogOut, Menu, X, Wifi, WifiOff, FolderHeart, Image as ImageIcon } from 'lucide-react';
import { AdminAuthState } from '../types';
import { logoutAdmin } from '../supabase/auth';

interface NavbarProps {
  currentPath: string;
  navigate: (path: string) => void;
  authState: AdminAuthState;
}

export const Navbar: React.FC<NavbarProps> = ({ currentPath, navigate, authState }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleNavClick = (path: string) => {
    setIsMobileMenuOpen(false);
    navigate(path);
  };

  const handleLogout = async () => {
    await logoutAdmin();
    navigate('/memories');
  };

  const isAdminRoute = currentPath.startsWith('/familyadmin');

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-sky-100/80 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <button
          onClick={() => handleNavClick('/memories')}
          className="flex items-center gap-2.5 text-left group focus:outline-hidden"
        >
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-400 to-blue-500 text-white flex items-center justify-center shadow-md shadow-sky-200/50 group-hover:scale-105 transition">
            <Sparkles className="w-5 h-5 text-sky-100" />
          </div>
          <div>
            <span className="font-serif text-lg font-bold tracking-tight text-slate-800 flex items-center gap-1.5">
              Little Keion
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 inline-block"></span>
            </span>
            <p className="text-[11px] font-medium tracking-wide uppercase text-sky-600/90 -mt-0.5">
              Keion Arkin De La Cruz
            </p>
          </div>
        </button>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          <button
            onClick={() => handleNavClick('/memories')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
              currentPath === '/memories' || currentPath === '/'
                ? 'bg-sky-50 text-sky-700 font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <ImageIcon className="w-4 h-4 text-sky-500" />
            Memories
          </button>

          <button
            onClick={() => handleNavClick('/albums')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
              currentPath === '/albums'
                ? 'bg-sky-50 text-sky-700 font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <FolderHeart className="w-4 h-4 text-sky-500" />
            Albums
          </button>
        </nav>

        {/* Right side: Realtime Sync Pill + Admin */}
        <div className="flex items-center gap-2.5">
          {/* Sync status pill */}
          <div
            className={`hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition ${
              isOnline
                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-700'
                : 'bg-amber-50/80 border-amber-200 text-amber-700'
            }`}
            title={isOnline ? 'Realtime Supabase sync active' : 'Offline - cached data available'}
          >
            {isOnline ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Live Sync</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-amber-600" />
                <span>Offline</span>
              </>
            )}
          </div>

          {/* Admin link / status */}
          {authState.isAuthenticated ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleNavClick('/familyadmin/dashboard')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border shadow-xs transition ${
                  isAdminRoute
                    ? 'bg-sky-600 border-sky-600 text-white'
                    : 'bg-white border-sky-200 text-sky-700 hover:bg-sky-50'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Admin Dashboard</span>
              </button>
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                title="Log out from Admin"
                aria-label="Log out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => handleNavClick('/familyadmin')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition ${
                currentPath === '/familyadmin'
                  ? 'bg-sky-600 text-white border-sky-600'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-white hover:border-sky-300'
              }`}
            >
              <Shield className="w-3.5 h-3.5 text-sky-600" />
              <span>Family Admin</span>
            </button>
          )}

          {/* Mobile menu toggle */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
            aria-label="Toggle navigation menu"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-slate-100 bg-white/95 px-4 pt-3 pb-5 flex flex-col gap-2 shadow-xl animate-fade-in">
          <button
            onClick={() => handleNavClick('/memories')}
            className={`w-full px-4 py-2.5 rounded-xl text-left text-sm font-medium flex items-center gap-2.5 transition ${
              currentPath === '/memories' || currentPath === '/'
                ? 'bg-sky-50 text-sky-800 font-semibold'
                : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <ImageIcon className="w-4 h-4 text-sky-500" />
            Memories Gallery
          </button>
          <button
            onClick={() => handleNavClick('/albums')}
            className={`w-full px-4 py-2.5 rounded-xl text-left text-sm font-medium flex items-center gap-2.5 transition ${
              currentPath === '/albums'
                ? 'bg-sky-50 text-sky-800 font-semibold'
                : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <FolderHeart className="w-4 h-4 text-sky-500" />
            Photo Albums
          </button>

          {authState.isAuthenticated && (
            <div className="pt-2 border-t border-slate-100 flex flex-col gap-1.5">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2">
                Admin Panel
              </p>
              <button
                onClick={() => handleNavClick('/familyadmin/dashboard')}
                className="w-full px-4 py-2 rounded-xl text-left text-sm text-slate-700 hover:bg-sky-50 transition"
              >
                Dashboard
              </button>
              <button
                onClick={() => handleNavClick('/familyadmin/upload')}
                className="w-full px-4 py-2 rounded-xl text-left text-sm text-slate-700 hover:bg-sky-50 transition"
              >
                Add Photos & Videos
              </button>
              <button
                onClick={() => handleNavClick('/familyadmin/memories')}
                className="w-full px-4 py-2 rounded-xl text-left text-sm text-slate-700 hover:bg-sky-50 transition"
              >
                Manage Memories
              </button>
              <button
                onClick={() => handleNavClick('/familyadmin/albums')}
                className="w-full px-4 py-2 rounded-xl text-left text-sm text-slate-700 hover:bg-sky-50 transition"
              >
                Manage Albums
              </button>
              <button
                onClick={() => handleNavClick('/familyadmin/settings')}
                className="w-full px-4 py-2 rounded-xl text-left text-sm text-slate-700 hover:bg-sky-50 transition"
              >
                Baby Profile Settings
              </button>
            </div>
          )}

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 px-2">
            <span className="flex items-center gap-1.5">
              {isOnline ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Realtime Connected</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-amber-600" />
                  <span>Offline Mode</span>
                </>
              )}
            </span>
          </div>
        </div>
      )}
    </header>
  );
};
