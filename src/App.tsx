/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { PublicMemories } from './pages/PublicMemories';
import { AlbumsView } from './pages/AlbumsView';
import { AdminLogin } from './pages/AdminLogin';
import { AdminDashboard } from './pages/AdminDashboard';
import { AdminUpload } from './pages/AdminUpload';
import { AdminMemories } from './pages/AdminMemories';
import { AdminAlbums } from './pages/AdminAlbums';
import { AdminSettings } from './pages/AdminSettings';
import { UploadQueueModal } from './components/UploadQueueModal';
import { ToastProvider } from './components/Toast';
import { PageBabyMotifBackground } from './components/BabyToysBackground';
import { subscribeToAuthState } from './supabase/auth';
import { AdminAuthState } from './types';

export default function App() {
  const [currentPath, setCurrentPath] = useState<string>(() => {
    return window.location.pathname || '/memories';
  });

  const [selectedAlbumFilter, setSelectedAlbumFilter] = useState<string | null>(null);

  const [authState, setAuthState] = useState<AdminAuthState>({
    isAuthenticated: false,
    isAdmin: false,
    method: null,
    userEmail: null,
    userId: null,
    token: null,
  });

  // Track browser history
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/memories');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Listen to Auth State
  useEffect(() => {
    const unsubscribe = subscribeToAuthState((state) => {
      setAuthState(state);
    });
    return unsubscribe;
  }, []);

  const navigate = useCallback((path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Route protection
  const isAdminProtectedPath = currentPath.startsWith('/familyadmin/') && currentPath !== '/familyadmin';
  const shouldRedirectToLogin = isAdminProtectedPath && !authState.isAuthenticated;

  useEffect(() => {
    if (shouldRedirectToLogin) {
      navigate('/familyadmin');
    }
  }, [shouldRedirectToLogin, navigate]);

  // Route renderer
  const renderContent = () => {
    if (currentPath === '/familyadmin') {
      return <AdminLogin navigate={navigate} authState={authState} />;
    }

    if (currentPath === '/familyadmin/dashboard') {
      return <AdminDashboard navigate={navigate} />;
    }

    if (currentPath === '/familyadmin/upload') {
      return <AdminUpload navigate={navigate} />;
    }

    if (currentPath === '/familyadmin/memories') {
      return <AdminMemories navigate={navigate} />;
    }

    if (currentPath === '/familyadmin/albums') {
      return <AdminAlbums navigate={navigate} />;
    }

    if (currentPath === '/familyadmin/settings') {
      return <AdminSettings navigate={navigate} />;
    }

    if (currentPath === '/albums') {
      return (
        <AlbumsView
          navigate={navigate}
          onSelectAlbum={(albumId) => {
            setSelectedAlbumFilter(albumId);
          }}
        />
      );
    }

    // Default to /memories (and /)
    return (
      <PublicMemories
        navigate={navigate}
        selectedAlbumId={selectedAlbumFilter}
        onClearAlbumFilter={() => setSelectedAlbumFilter(null)}
      />
    );
  };

  return (
    <ToastProvider>
      <div className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col font-sans relative overflow-x-hidden">
        {/* Subtle page-wide floating baby toy motifs */}
        <PageBabyMotifBackground />

        {/* Navigation Bar */}
        <Navbar
          currentPath={currentPath}
          navigate={navigate}
          authState={authState}
        />

        {/* Main Content Area */}
        <div className="flex-1">
          {renderContent()}
        </div>

        {/* Footer */}
        <footer className="mt-auto border-t border-slate-200/80 bg-white/60 py-6 text-center text-xs text-slate-400">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="font-light">
              Made with love for baby boy's precious moments • Built with Supabase Realtime Sync
            </p>
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/memories')}
                className="hover:text-slate-600 transition"
              >
                Memories
              </button>
              <button
                onClick={() => navigate('/albums')}
                className="hover:text-slate-600 transition"
              >
                Albums
              </button>
              <button
                onClick={() => navigate('/familyadmin')}
                className="hover:text-sky-600 font-medium transition"
              >
                Family Admin
              </button>
            </div>
          </div>
        </footer>

        {/* Floating Upload Queue Modal */}
        <UploadQueueModal />
      </div>
    </ToastProvider>
  );
}
