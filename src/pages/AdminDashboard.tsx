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
  Trash2,
} from 'lucide-react';
import {
  listenToMemories,
  listenToAlbums,
  listenToMemoryStatistics,
  MemoryStatistics,
  subscribeToSupabaseSchemaStatus,
  SUPABASE_SETUP_SQL,
} from '../supabase/database';
import { getSupabaseSqlEditorUrl } from '../supabase/client';
import { uploadManager } from '../services/uploadManager';
import { Memory, Album } from '../types';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';

interface AdminDashboardProps {
  navigate: (path: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ navigate }) => {
  const { showToast } = useToast();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [stats, setStats] = useState<MemoryStatistics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStatsLoading, setIsStatsLoading] = useState(true);
  const [isSchemaMissing, setIsSchemaMissing] = useState(false);
  const [isConfirmDeleteAllOpen, setIsConfirmDeleteAllOpen] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  useEffect(() => {
    const unsubSchema = subscribeToSupabaseSchemaStatus((missing) => {
      setIsSchemaMissing(missing);
    });
    return unsubSchema;
  }, []);

  useEffect(() => {
    const unsubStats = listenToMemoryStatistics(
      (liveStats) => {
        setStats(liveStats);
        setIsStatsLoading(false);
      },
      () => {
        setIsStatsLoading(false);
      },
      true
    );

    const unsubMemories = listenToMemories(
      {
        onInitialLoad: (list) => {
          setMemories(list);
          setIsLoading(false);
        },
        onAdded: (m) => {
          setMemories((prev) => {
            if (prev.some((item) => item.id === m.id)) {
              return prev.map((item) => (item.id === m.id ? m : item));
            }
            return [m, ...prev];
          });
        },
        onModified: (m) => {
          setMemories((prev) => prev.map((item) => (item.id === m.id ? m : item)));
        },
        onRemoved: (id) => {
          setMemories((prev) => prev.filter((item) => item.id !== id));
        },
        onError: () => {
          setIsLoading(false);
        },
      },
      { isAdmin: true }
    );

    const unsubAlbums = listenToAlbums((albumList) => {
      setAlbums(albumList);
    }, true);

    return () => {
      unsubStats();
      unsubMemories();
      unsubAlbums();
    };
  }, []);

  const totalMemories = stats ? stats.totalMemories : memories.length;
  const photoCount = stats
    ? stats.totalPhotos
    : memories.filter((m) => m.type === 'photo').length;
  const videoCount = stats
    ? stats.totalVideos
    : memories.filter((m) => m.type === 'video').length;
  const albumCount = stats ? stats.totalAlbums : albums.length;
  const latestMemory = stats?.latestMemory || memories[0] || null;
  const showMetricLoading = isStatsLoading && isLoading;

  const recentMemories = memories.slice(0, 6);

  const handleConfirmDeleteAll = async () => {
    setIsDeletingAll(true);
    try {
      const result = await uploadManager.deleteAllMemoriesWithFiles();
      setMemories([]);
      setStats((prev) =>
        prev
          ? {
              ...prev,
              totalMemories: 0,
              totalPhotos: 0,
              totalVideos: 0,
              latestMemory: null,
            }
          : null
      );
      setIsConfirmDeleteAllOpen(false);
      if (result.storageWarning) {
        showToast(
          `Deleted ${result.deletedCount} memories from database, though some storage files could not be removed.`,
          'info'
        );
      } else {
        showToast(
          `Successfully deleted all ${result.deletedCount} memories and media files.`,
          'success'
        );
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to delete all memories', 'error');
    } finally {
      setIsDeletingAll(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-[80vh]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[var(--border-subtle)]">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-[#A9D6F5] [.light_&]:text-[#2563EB] tracking-wide mb-1">
            <span aria-hidden="true">☾</span>
            <span>Family Control Center</span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[var(--text-primary)]">
            Admin Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-0.5">
            Manage Keion Arkin's precious photos, videos, and memory chapters.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {totalMemories > 0 && (
            <button
              type="button"
              onClick={() => setIsConfirmDeleteAllOpen(true)}
              disabled={isDeletingAll}
              className="px-3.5 py-2.5 bg-rose-500/12 hover:bg-rose-500/20 border border-rose-400/30 text-rose-300 [.light_&]:text-rose-600 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
              title="Delete all memories"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete All Memories</span>
            </button>
          )}
          <button
            onClick={() => navigate('/familyadmin/upload')}
            className="px-4 py-2.5 btn-night-primary rounded-xl text-xs sm:text-sm flex items-center gap-2 cursor-pointer"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload Media</span>
          </button>
          <button
            onClick={() => navigate('/memories')}
            className="px-3.5 py-2.5 btn-night-secondary rounded-xl text-xs sm:text-sm font-medium flex items-center gap-1.5 cursor-pointer"
            title="Open Public Album"
          >
            <ExternalLink className="w-4 h-4 text-[#6FA8DC]" />
            <span className="hidden sm:inline">View Public</span>
          </button>
        </div>
      </div>

      {/* Optional 1-Click Supabase SQL Setup Helper if tables are not created yet */}
      {isSchemaMissing && (
        <div className="mt-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-400/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-amber-300 [.light_&]:text-amber-900">
              Finish Supabase Table & Storage Bucket Setup
            </h3>
            <p className="text-xs text-amber-200/90 [.light_&]:text-amber-800 mt-0.5">
              Your uploads are active and syncing, but the <code className="font-mono bg-amber-500/20 px-1 rounded">memories</code>, <code className="font-mono bg-amber-500/20 px-1 rounded">albums</code>, and <code className="font-mono bg-amber-500/20 px-1 rounded">media</code> bucket have not been created in your Supabase SQL Editor yet.
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
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              Copy Setup SQL
            </button>
            <a
              href={getSupabaseSqlEditorUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-xl btn-night-secondary text-xs font-semibold flex items-center gap-1.5"
            >
              <span>Open SQL Editor</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 my-6">
        <div className="night-card p-5 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-[var(--text-secondary)] mb-2">
            <span className="text-xs font-medium">Total Photos & Videos</span>
            <div className="p-2 rounded-xl bg-[#0B1D35] [.light_&]:bg-sky-50 border border-[var(--border-subtle)] text-[#A9D6F5] [.light_&]:text-sky-600">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <span className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] tabular-nums">
            {showMetricLoading ? '...' : totalMemories}
          </span>
          <span className="text-[11px] text-[var(--text-muted)] mt-1">Realtime synced</span>
        </div>

        <div className="night-card p-5 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-[var(--text-secondary)] mb-2">
            <span className="text-xs font-medium">Photos</span>
            <div className="p-2 rounded-xl bg-[#0B1D35] [.light_&]:bg-blue-50 border border-[var(--border-subtle)] text-[#6FA8DC] [.light_&]:text-blue-600">
              <ImageIcon className="w-4 h-4" />
            </div>
          </div>
          <span className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] tabular-nums">
            {showMetricLoading ? '...' : photoCount}
          </span>
          <span className="text-[11px] text-[var(--text-muted)] mt-1">High-res stored</span>
        </div>

        <div className="night-card p-5 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-[var(--text-secondary)] mb-2">
            <span className="text-xs font-medium">Videos</span>
            <div className="p-2 rounded-xl bg-[#0B1D35] [.light_&]:bg-pink-50 border border-[var(--border-subtle)] text-[#F3C9D9] [.light_&]:text-pink-600">
              <Film className="w-4 h-4" />
            </div>
          </div>
          <span className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] tabular-nums">
            {showMetricLoading ? '...' : videoCount}
          </span>
          <span className="text-[11px] text-[var(--text-muted)] mt-1">First-frame posters</span>
        </div>

        <div className="night-card p-5 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-[var(--text-secondary)] mb-2">
            <span className="text-xs font-medium">Albums</span>
            <div className="p-2 rounded-xl bg-[#0B1D35] [.light_&]:bg-sky-50 border border-[var(--border-subtle)] text-[#A9D6F5] [.light_&]:text-sky-600">
              <FolderHeart className="w-4 h-4" />
            </div>
          </div>
          <span className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] tabular-nums">
            {showMetricLoading ? '...' : albumCount}
          </span>
          <span className="text-[11px] text-[var(--text-muted)] mt-1">Milestones & chapters</span>
        </div>
      </div>

      {/* Quick Access Menu Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <button
          onClick={() => navigate('/familyadmin/upload')}
          className="p-5 bg-gradient-to-tr from-[#16365F] via-[#1E4678] to-[#2C5E9E] text-[#F0F7FF] rounded-2xl border border-[#6FA8DC]/35 shadow-lg text-left hover:-translate-y-0.5 transition group cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-[#0B1D35]/60 border border-[#A9D6F5]/25 flex items-center justify-center mb-3">
            <UploadCloud className="w-5 h-5 text-[#D9ECFF]" />
          </div>
          <h3 className="font-semibold text-base mb-1">Add Photos & Videos</h3>
          <p className="text-xs text-[#B8D4EE] font-light mb-3">
            Fast concurrent multi-file uploader with auto-thumbnail generation.
          </p>
          <span className="text-xs font-semibold text-[#D9ECFF] flex items-center gap-1 group-hover:translate-x-1 transition-transform">
            Start Upload <ChevronRight className="w-4 h-4" />
          </span>
        </button>

        <button
          onClick={() => navigate('/familyadmin/memories')}
          className="p-5 night-card night-card-interactive rounded-2xl text-left group cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-[#0B1D35] [.light_&]:bg-sky-50 border border-[var(--border-subtle)] text-[#6FA8DC] flex items-center justify-center mb-3">
            <ImageIcon className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-base text-[var(--text-primary)] mb-1">Manage Memories</h3>
          <p className="text-xs text-[var(--text-secondary)] font-light mb-3">
            Edit titles, captions, dates, or delete media with storage cleanup.
          </p>
          <span className="text-xs font-semibold text-[#A9D6F5] [.light_&]:text-[#2563EB] flex items-center gap-1 group-hover:translate-x-1 transition-transform">
            View All ({totalMemories}) <ChevronRight className="w-4 h-4" />
          </span>
        </button>

        <button
          onClick={() => navigate('/familyadmin/albums')}
          className="p-5 night-card night-card-interactive rounded-2xl text-left group cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-[#0B1D35] [.light_&]:bg-blue-50 border border-[var(--border-subtle)] text-[#A9D6F5] [.light_&]:text-blue-600 flex items-center justify-center mb-3">
            <FolderHeart className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-base text-[var(--text-primary)] mb-1">Manage Albums</h3>
          <p className="text-xs text-[var(--text-secondary)] font-light mb-3">
            Organize special themes (e.g. 1st Month, First Steps, Christening).
          </p>
          <span className="text-xs font-semibold text-[#A9D6F5] [.light_&]:text-[#2563EB] flex items-center gap-1 group-hover:translate-x-1 transition-transform">
            View Albums ({albumCount}) <ChevronRight className="w-4 h-4" />
          </span>
        </button>
      </div>

      {/* Recent Uploads Section */}
      <div className="night-card rounded-2xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Clock className="w-4 h-4 text-[#6FA8DC]" />
            <h3 className="font-semibold text-[var(--text-primary)] text-sm">Recent Uploads</h3>
            {latestMemory && (
              <span className="text-[11px] text-[var(--text-muted)]">
                Latest: <strong className="text-[var(--text-secondary)]">{latestMemory.title || latestMemory.fileName}</strong>
              </span>
            )}
          </div>
          <button
            onClick={() => navigate('/familyadmin/memories')}
            className="text-xs font-semibold text-[#A9D6F5] [.light_&]:text-[#2563EB] hover:underline self-start sm:self-auto cursor-pointer"
          >
            See all ({totalMemories})
          </button>
        </div>

        {recentMemories.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {recentMemories.map((m) => (
              <div
                key={m.id}
                onClick={() => navigate('/familyadmin/memories')}
                className="group cursor-pointer rounded-xl overflow-hidden bg-[#0B1D35] border border-[var(--border-subtle)] hover:border-[#A9D6F5]/45 transition aspect-square relative"
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
                      <div className="w-full h-full flex items-center justify-center bg-[#0B1D35] text-[#6FA8DC]">
                        <Film className="w-6 h-6" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-[#071426]/30 flex items-center justify-center">
                      <div className="w-7 h-7 rounded-full bg-[#102642]/90 border border-[#A9D6F5]/30 text-[#D9ECFF] flex items-center justify-center shadow-xs">
                        <Film className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-[#071426]/75 text-[#D9ECFF] text-[9px] font-bold">
                      VID
                    </span>
                  </>
                ) : (
                  <img
                    src={m.thumbnailUrl || m.mediaUrl}
                    alt={m.title || 'Memory'}
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      const target = e.currentTarget;
                      if (m.mediaUrl && target.src !== m.mediaUrl) {
                        target.src = m.mediaUrl;
                      }
                    }}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-200 bg-[#0B1D35]"
                  />
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-[var(--text-muted)] text-xs">
            No memories uploaded yet. Click "Upload Media" above to begin.
          </div>
        )}
      </div>

      {/* Delete All Memories Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isConfirmDeleteAllOpen}
        title="Delete All Memories"
        message={`Are you sure you want to permanently delete all ${totalMemories} memories (photos and videos)? This will remove every record from the database and delete all associated media files from Supabase Storage. This action cannot be undone.`}
        confirmLabel={`Yes, Delete All (${totalMemories})`}
        cancelLabel="Cancel"
        isDestructive={true}
        isLoading={isDeletingAll}
        onConfirm={handleConfirmDeleteAll}
        onCancel={() => {
          if (!isDeletingAll) setIsConfirmDeleteAllOpen(false);
        }}
      />
    </div>
  );
};
