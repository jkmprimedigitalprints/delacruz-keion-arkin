import React, { useState, useEffect } from 'react';
import {
  Shield,
  LogOut,
  Menu,
  X,
  WifiOff,
  FolderHeart,
  Image as ImageIcon,
  Moon,
  Sun,
} from 'lucide-react';
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
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const saved = window.localStorage.getItem('keion_theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {}
    return 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
    }
    try {
      window.localStorage.setItem('keion_theme', theme);
    } catch {}
  }, [theme]);

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

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const isAdminRoute = currentPath.startsWith('/familyadmin');

  return (
    <header className="sticky top-0 z-40 bg-[#0B1D35]/88 [.light_&]:bg-white/88 backdrop-blur-md border-b border-[var(--border-subtle)] transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <button
          onClick={() => handleNavClick('/memories')}
          className="flex items-center gap-3 text-left group focus:outline-hidden cursor-pointer"
        >
          <div className="w-10 h-10 rounded-2xl bg-[#102642] [.light_&]:bg-[#E6F1FB] border border-[#6FA8DC]/30 text-[#D9ECFF] [.light_&]:text-[#2563EB] flex items-center justify-center shadow-[0_4px_16px_rgba(111,168,220,0.2)] group-hover:border-[#A9D6F5]/60 transition">
            <span className="text-lg leading-none select-none">☾</span>
          </div>
          <div>
            <span className="font-serif text-lg font-semibold tracking-tight text-[var(--text-primary)] flex items-center gap-1.5">
              Little Keion
              <span className="w-1.5 h-1.5 rounded-full bg-[#A9D6F5] inline-block" />
            </span>
            <p className="text-[11px] font-medium tracking-wide text-[#6FA8DC] -mt-0.5">
              Keion Arkin De La Cruz
            </p>
          </div>
        </button>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-2">
          <button
            onClick={() => handleNavClick('/memories')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 cursor-pointer ${
              currentPath === '/memories' || currentPath === '/'
                ? 'bg-[#102642] [.light_&]:bg-[#E6F1FB] text-[#D9ECFF] [.light_&]:text-[#1E3A5F] border border-[#6FA8DC]/30 shadow-2xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[#102642]/50 [.light_&]:hover:bg-slate-100'
            }`}
          >
            <ImageIcon className="w-4 h-4 text-[#6FA8DC]" />
            <span>Memories</span>
          </button>

          <button
            onClick={() => handleNavClick('/albums')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 cursor-pointer ${
              currentPath === '/albums'
                ? 'bg-[#102642] [.light_&]:bg-[#E6F1FB] text-[#D9ECFF] [.light_&]:text-[#1E3A5F] border border-[#6FA8DC]/30 shadow-2xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[#102642]/50 [.light_&]:hover:bg-slate-100'
            }`}
          >
            <FolderHeart className="w-4 h-4 text-[#6FA8DC]" />
            <span>Albums</span>
          </button>
        </nav>

        {/* Right side: Connectivity + Theme Toggle + Admin */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Quiet connectivity status */}
          <div
            className={`hidden sm:flex items-center gap-1.5 text-xs font-medium ${
              isOnline ? 'text-[#A9D6F5]/85 [.light_&]:text-emerald-700' : 'text-amber-400'
            }`}
            title={isOnline ? 'Realtime Supabase sync active' : 'Offline - cached data available'}
          >
            {isOnline ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Live Sync</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                <span>Offline</span>
              </>
            )}
          </div>

          {/* Theme Toggle (Night Sky vs Light Mode) */}
          <button
            type="button"
            onClick={toggleTheme}
            className="w-9 h-9 rounded-xl btn-night-secondary flex items-center justify-center cursor-pointer"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Night Sky Mode'}
            aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Night Sky Mode'}
          >
            {theme === 'dark' ? (
              <Moon className="w-4 h-4 text-[#D9ECFF]" />
            ) : (
              <Sun className="w-4 h-4 text-amber-500" />
            )}
          </button>

          {/* Admin link / status */}
          {authState.isAuthenticated ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleNavClick('/familyadmin/dashboard')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                  isAdminRoute ? 'btn-night-primary' : 'btn-night-secondary'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Admin Dashboard</span>
              </button>
              <button
                onClick={handleLogout}
                className="p-2 rounded-xl text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                title="Log out from Admin"
                aria-label="Log out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => handleNavClick('/familyadmin')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                currentPath === '/familyadmin' ? 'btn-night-primary' : 'btn-night-secondary'
              }`}
            >
              <Shield className="w-3.5 h-3.5 text-[#6FA8DC]" />
              <span>Family Admin</span>
            </button>
          )}

          {/* Mobile menu toggle */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[#102642]/60 transition"
            aria-label="Toggle navigation menu"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-[var(--border-subtle)] bg-[#0B1D35]/98 [.light_&]:bg-white/98 px-4 pt-3 pb-5 flex flex-col gap-2 shadow-xl animate-fade-in">
          <button
            onClick={() => handleNavClick('/memories')}
            className={`w-full px-4 py-2.5 rounded-xl text-left text-sm font-medium flex items-center gap-2.5 transition ${
              currentPath === '/memories' || currentPath === '/'
                ? 'bg-[#102642] [.light_&]:bg-[#E6F1FB] text-[#D9ECFF] [.light_&]:text-[#1E3A5F] font-semibold border border-[#6FA8DC]/25'
                : 'text-[var(--text-secondary)] hover:bg-[#102642]/50'
            }`}
          >
            <ImageIcon className="w-4 h-4 text-[#6FA8DC]" />
            <span>Memories Gallery</span>
          </button>
          <button
            onClick={() => handleNavClick('/albums')}
            className={`w-full px-4 py-2.5 rounded-xl text-left text-sm font-medium flex items-center gap-2.5 transition ${
              currentPath === '/albums'
                ? 'bg-[#102642] [.light_&]:bg-[#E6F1FB] text-[#D9ECFF] [.light_&]:text-[#1E3A5F] font-semibold border border-[#6FA8DC]/25'
                : 'text-[var(--text-secondary)] hover:bg-[#102642]/50'
            }`}
          >
            <FolderHeart className="w-4 h-4 text-[#6FA8DC]" />
            <span>Photo Albums</span>
          </button>

          {authState.isAuthenticated && (
            <div className="pt-2 border-t border-[var(--border-subtle)] flex flex-col gap-1.5">
              <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider px-2">
                Admin Panel
              </p>
              <button
                onClick={() => handleNavClick('/familyadmin/dashboard')}
                className="w-full px-4 py-2 rounded-xl text-left text-sm text-[var(--text-secondary)] hover:bg-[#102642]/60 transition"
              >
                Dashboard
              </button>
              <button
                onClick={() => handleNavClick('/familyadmin/upload')}
                className="w-full px-4 py-2 rounded-xl text-left text-sm text-[var(--text-secondary)] hover:bg-[#102642]/60 transition"
              >
                Upload Photos & Videos
              </button>
              <button
                onClick={() => handleNavClick('/familyadmin/memories')}
                className="w-full px-4 py-2 rounded-xl text-left text-sm text-[var(--text-secondary)] hover:bg-[#102642]/60 transition"
              >
                Manage Memories
              </button>
              <button
                onClick={() => handleNavClick('/familyadmin/albums')}
                className="w-full px-4 py-2 rounded-xl text-left text-sm text-[var(--text-secondary)] hover:bg-[#102642]/60 transition"
              >
                Manage Albums
              </button>
              <button
                onClick={() => handleNavClick('/familyadmin/settings')}
                className="w-full px-4 py-2 rounded-xl text-left text-sm text-[var(--text-secondary)] hover:bg-[#102642]/60 transition"
              >
                Baby Profile Settings
              </button>
              <button
                onClick={handleLogout}
                className="w-full px-4 py-2 rounded-xl text-left text-sm text-rose-400 hover:bg-rose-500/10 font-medium transition"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
};
