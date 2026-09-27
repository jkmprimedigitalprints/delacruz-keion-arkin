import React, { useState, useEffect } from 'react';
import {
  UploadCloud,
  Image as ImageIcon,
  Film,
  FolderHeart,
  Settings,
  Sparkles,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Clock,
} from 'lucide-react';
import {
  listenToMemories,
  listenToAlbums,
  subscribeToSupabaseSchemaStatus,
  SUPABASE_SETUP_SQL,
} from '../supabase/database';
import { getSupabaseSqlEditorUrl } from '../supabase/client';
import { Memory, Album } from '../types';
import { useToast } from '../components/Toast';

interface AdminDashboardProps {
  navigate: (path: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ navigate }) => {
  const { showToast } = useToast();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSchemaMissing, setIsSchemaMissing] = useState(false);

  useEffect(() => {
    const unsubSchema = subscribeToSupabaseSchemaStatus((missing) => {
      setIsSchemaMissing(missing);
    });
    return unsubSchema;
  }, []);

  useEffect(() => {
    const unsubMemories = listenToMemories(
      {
        onInitialLoad: (list) => {
          setMemories(list);
          setIsLoading(false);
        },
        onAdded: (m) => {
          setMemories((prev) => {
            if (prev.some((item) => item.id === m.id)) return prev;
            return [m, ...prev];
          });
        },
        onModified: (m) => {
          setMemories((prev) => prev.map((item) => (item.id === m.id ? m : item)));
        },
        onRemoved: (id) => {
          setMemories((prev) => prev.filter((item) => item.id !== id));
        },
      },
      { isAdmin: true, pageSize: 100 }
    );

    const unsubAlbums = listenToAlbums((albumList) => {
      setAlbums(albumList);
    }, true);

    return () => {
      unsubMemories();
      unsubAlbums();
    };
  }, []);

  const totalMemories = memories.length;
  const photoCount = memories.filter((m) => m.type === 'photo').length;
  const videoCount = memories.filter((m) => m.type === 'video').length;
  const albumCount = albums.length;

  const recentMemories = memories.slice(0, 6);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-[80vh]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-sky-600 uppercase tracking-wider mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Family Control Center</span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900">
            Admin Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Manage your baby boy's precious photos, videos, and memory chapters.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => navigate('/familyadmin/upload')}
            className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-md shadow-sky-200 flex items-center gap-2 transition"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload Media</span>
          </button>
          <button
            onClick={() => navigate('/memories')}
            className="px-3.5 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-1.5 transition"
            title="Open Public Album"
          >
            <ExternalLink className="w-4 h-4 text-slate-400" />
            <span className="hidden sm:inline">View Public</span>
          </button>
        </div>
      </div>

      {/* Optional 1-Click Supabase SQL Setup Helper if tables are not created yet */}
      {isSchemaMissing && (
        <div className="mt-6 p-4 rounded-2xl bg-amber-50/90 border border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-amber-900">
              Finish Supabase Table & Storage Bucket Setup
            </h3>
            <p className="text-xs text-amber-800/90 mt-0.5">
              Your uploads are active and syncing, but the <code className="font-mono bg-amber-100 px-1 rounded">memories</code>, <code className="font-mono bg-amber-100 px-1 rounded">albums</code>, and <code className="font-mono bg-amber-100 px-1 rounded">media</code> bucket have not been created in your Supabase SQL Editor yet.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(SUPABASE_SETUP_SQL);
                  showToast('SQL script copied! Paste and click Run in your Supabase SQL Editor.', 'success');
                } catch {
                  showToast('Please copy the SQL from supabase/schema.sql in the project files.', 'info');
                }
              }}
              className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs transition"
            >
              Copy Setup SQL
            </button>
            <a
              href={getSupabaseSqlEditorUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-amber-50 border border-amber-300 text-amber-900 text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <span>Open SQL Editor</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 my-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Total Memories</span>
            <div className="p-2 rounded-xl bg-sky-50 text-sky-600">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <span className="text-2xl sm:text-3xl font-bold text-slate-900">
            {isLoading ? '...' : totalMemories}
          </span>
          <span className="text-[11px] text-slate-400 mt-1">Realtime synced</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Photos</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <ImageIcon className="w-4 h-4" />
            </div>
          </div>
          <span className="text-2xl sm:text-3xl font-bold text-slate-900">
            {isLoading ? '...' : photoCount}
          </span>
          <span className="text-[11px] text-slate-400 mt-1">High-res stored</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Videos</span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Film className="w-4 h-4" />
            </div>
          </div>
          <span className="text-2xl sm:text-3xl font-bold text-slate-900">
            {isLoading ? '...' : videoCount}
          </span>
          <span className="text-[11px] text-slate-400 mt-1">First-frame posters</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Albums</span>
            <div className="p-2 rounded-xl bg-sky-50 text-sky-600">
              <FolderHeart className="w-4 h-4" />
            </div>
          </div>
          <span className="text-2xl sm:text-3xl font-bold text-slate-900">
            {isLoading ? '...' : albumCount}
          </span>
          <span className="text-[11px] text-slate-400 mt-1">Milestones & chapters</span>
        </div>
      </div>

      {/* Quick Access Menu Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <button
          onClick={() => navigate('/familyadmin/upload')}
          className="p-5 bg-gradient-to-tr from-sky-500 to-blue-600 text-white rounded-2xl shadow-md shadow-sky-200 text-left hover:scale-[1.01] transition group"
        >
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center mb-3">
            <UploadCloud className="w-5 h-5 text-white" />
          </div>
          <h3 className="font-semibold text-base mb-1">Add Photos & Videos</h3>
          <p className="text-xs text-sky-100 font-light mb-3">
            Fast concurrent multi-file uploader with auto-thumbnail generation.
          </p>
          <span className="text-xs font-semibold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
            Start Upload <ChevronRight className="w-4 h-4" />
          </span>
        </button>

        <button
          onClick={() => navigate('/familyadmin/memories')}
          className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-xs text-left hover:border-sky-300 hover:shadow-md transition group"
        >
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center mb-3">
            <ImageIcon className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-base text-slate-900 mb-1">Manage Memories</h3>
          <p className="text-xs text-slate-500 font-light mb-3">
            Edit titles, captions, dates, or delete media with storage cleanup.
          </p>
          <span className="text-xs font-semibold text-sky-600 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
            View All ({totalMemories}) <ChevronRight className="w-4 h-4" />
          </span>
        </button>

        <button
          onClick={() => navigate('/familyadmin/albums')}
          className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-xs text-left hover:border-sky-300 hover:shadow-md transition group"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
            <FolderHeart className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-base text-slate-900 mb-1">Manage Albums</h3>
          <p className="text-xs text-slate-500 font-light mb-3">
            Organize special themes (e.g. 1st Month, First Steps, Christening).
          </p>
          <span className="text-xs font-semibold text-sky-600 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
            View Albums ({albumCount}) <ChevronRight className="w-4 h-4" />
          </span>
        </button>
      </div>

      {/* Recent Uploads Section */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-sky-600" />
            <h3 className="font-semibold text-slate-800 text-sm">Recent Uploads</h3>
          </div>
          <button
            onClick={() => navigate('/familyadmin/memories')}
            className="text-xs font-semibold text-sky-600 hover:text-sky-800"
          >
            See all
          </button>
        </div>

        {recentMemories.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {recentMemories.map((m) => (
              <div
                key={m.id}
                onClick={() => navigate('/familyadmin/memories')}
                className="group cursor-pointer rounded-xl overflow-hidden bg-slate-900 border border-slate-100 hover:shadow-md transition aspect-square relative"
              >
                {m.type === 'video' ? (
                  <>
                    {m.posterUrl || m.thumbnailUrl ? (
                      <img
                        src={m.posterUrl || m.thumbnailUrl || ''}
                        alt={m.title || 'Video Memory'}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                      />
                    ) : m.mediaUrl ? (
                      <video
                        src={m.mediaUrl}
                        preload="metadata"
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-slate-900 text-sky-400">
                        <Film className="w-6 h-6" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                      <div className="w-7 h-7 rounded-full bg-white/90 text-sky-600 flex items-center justify-center shadow-xs">
                        <Film className="w-3.5 h-3.5 fill-sky-600" />
                      </div>
                    </div>
                    <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-[9px] font-bold">
                      VID
                    </span>
                  </>
                ) : (
                  <img
                    src={m.thumbnailUrl || m.mediaUrl}
                    alt={m.title || 'Memory'}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-200 bg-slate-50"
                  />
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400 text-xs">
            No memories uploaded yet. Click "Upload Media" above to begin.
          </div>
        )}
      </div>
    </div>
  );
};
