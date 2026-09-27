import React, { useState, useEffect, useMemo } from 'react';
import {
  listenToMemories,
  listenToAlbums,
  updateMemoryDocument,
  deleteMemoryDocument,
} from '../supabase/database';
import { uploadManager } from '../services/uploadManager';
import { Memory, Album } from '../types';
import {
  Search,
  Filter,
  ArrowUpDown,
  Edit3,
  Trash2,
  Image as ImageIcon,
  Film,
  Calendar,
  FolderHeart,
  X,
  Check,
  ArrowLeft,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';

interface AdminMemoriesProps {
  navigate: (path: string) => void;
}

export const AdminMemories: React.FC<AdminMemoriesProps> = ({ navigate }) => {
  const { showToast } = useToast();

  const [memories, setMemories] = useState<Memory[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | 'photo' | 'video'>('all');
  const [selectedAlbumId, setSelectedAlbumId] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  // Edit Modal State
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCaption, setEditCaption] = useState('');
  const [editType, setEditType] = useState<'photo' | 'video'>('photo');
  const [editAlbumId, setEditAlbumId] = useState('');
  const [editDate, setEditDate] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Delete State
  const [deletingMemory, setDeletingMemory] = useState<Memory | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConfirmDeleteAllOpen, setIsConfirmDeleteAllOpen] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  useEffect(() => {
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
      unsubMemories();
      unsubAlbums();
    };
  }, []);

  const albumMap = useMemo(() => {
    const map = new Map<string, string>();
    albums.forEach((a) => map.set(a.id, a.name));
    return map;
  }, [albums]);

  // Client filtering & search
  const filteredMemories = useMemo(() => {
    return memories.filter((m) => {
      if (selectedType !== 'all' && m.type !== selectedType) return false;
      if (selectedAlbumId && m.albumId !== selectedAlbumId) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = m.title?.toLowerCase().includes(query);
        const matchesCaption = m.caption?.toLowerCase().includes(query);
        const matchesFile = m.fileName?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesCaption && !matchesFile) return false;
      }
      return true;
    }).sort((a, b) => {
      const timeA = a.memoryDate
        ? (typeof (a.memoryDate as any).toMillis === 'function'
            ? (a.memoryDate as any).toMillis()
            : new Date(a.memoryDate as any).getTime())
        : 0;

      const timeB = b.memoryDate
        ? (typeof (b.memoryDate as any).toMillis === 'function'
            ? (b.memoryDate as any).toMillis()
            : new Date(b.memoryDate as any).getTime())
        : 0;

      return sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
    });
  }, [memories, selectedType, selectedAlbumId, searchQuery, sortOrder]);

  const openEditModal = (memory: Memory) => {
    setEditingMemory(memory);
    setEditTitle(memory.title || '');
    setEditCaption(memory.caption || '');
    setEditType(memory.type === 'video' ? 'video' : 'photo');
    setEditAlbumId(memory.albumId || '');

    let dateVal = '';
    if (memory.memoryDate) {
      try {
        const d =
          typeof (memory.memoryDate as any).toDate === 'function'
            ? (memory.memoryDate as any).toDate()
            : new Date(memory.memoryDate as any);
        dateVal = d.toISOString().split('T')[0];
      } catch {}
    }
    setEditDate(dateVal || new Date().toISOString().split('T')[0]);
  };

  const handleSaveEdit = async () => {
    if (!editingMemory) return;
    setIsSavingEdit(true);

    try {
      await updateMemoryDocument(editingMemory.id, {
        title: editTitle.trim(),
        caption: editCaption.trim(),
        type: editType,
        albumId: editAlbumId || null,
        memoryDate: editDate ? new Date(editDate) : new Date(),
      });

      showToast('Memory updated successfully. Realtime clients synced.', 'success');
      setEditingMemory(null);
    } catch (err: any) {
      showToast(err.message || 'Failed to update memory', 'error');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const confirmDeleteMemory = async () => {
    if (!deletingMemory) return;
    setIsDeleting(true);

    try {
      // 1. Delete Supabase PostgreSQL row
      await deleteMemoryDocument(deletingMemory.id);

      // 2. Clean up Storage files
      const result = await uploadManager.deleteMemoryWithFiles(deletingMemory);
      if (result.storageWarning) {
        showToast('Memory removed, but some storage files could not be deleted.', 'info');
      } else {
        showToast('Memory and media files deleted successfully.', 'success');
      }
      setDeletingMemory(null);
    } catch (err: any) {
      showToast(err.message || 'Failed to delete memory', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmDeleteAllMemories = async () => {
    setIsDeletingAll(true);
    try {
      const result = await uploadManager.deleteAllMemoriesWithFiles();
      setMemories([]);
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-[85vh]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/familyadmin/dashboard')}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-white border border-slate-200 transition"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900">
              Manage Memories ({filteredMemories.length})
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Edit captions, move albums, or remove media items.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {memories.length > 0 && (
            <button
              type="button"
              onClick={() => setIsConfirmDeleteAllOpen(true)}
              disabled={isDeletingAll}
              className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete All ({memories.length})</span>
            </button>
          )}
          <button
            onClick={() => navigate('/familyadmin/upload')}
            className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-xs transition"
          >
            Add More Media
          </button>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs mb-6 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title, caption, filename..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-sky-200 transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Type filter */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as any)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:bg-white transition"
          >
            <option value="all">All Types</option>
            <option value="photo">Photos Only</option>
            <option value="video">Videos Only</option>
          </select>

          {/* Album filter */}
          <select
            value={selectedAlbumId}
            onChange={(e) => setSelectedAlbumId(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:bg-white transition"
          >
            <option value="">All Albums</option>
            {albums.map((album) => (
              <option key={album.id} value={album.id}>
                {album.name}
              </option>
            ))}
          </select>

          {/* Sort order */}
          <button
            onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-100 flex items-center gap-1.5 transition"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-sky-500" />
            <span>{sortOrder === 'newest' ? 'Newest' : 'Oldest'}</span>
          </button>
        </div>
      </div>

      {/* Memory Table / Cards */}
      {isLoading ? (
        <div className="text-center py-16 text-slate-400 text-sm">Loading memories...</div>
      ) : filteredMemories.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredMemories.map((m) => {
            const formattedDate = (() => {
              try {
                if (!m.memoryDate) return '';
                const d =
                  typeof (m.memoryDate as any).toDate === 'function'
                    ? (m.memoryDate as any).toDate()
                    : new Date(m.memoryDate as any);
                return d.toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                });
              } catch {
                return '';
              }
            })();

            return (
              <div
                key={m.id}
                className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs hover:shadow-md transition flex flex-col justify-between"
              >
                {/* Media preview */}
                <div className="relative aspect-4/3 bg-slate-900 overflow-hidden">
                  {m.type === 'video' ? (
                    <>
                      {m.posterUrl || m.thumbnailUrl ? (
                        <img
                          src={m.posterUrl || m.thumbnailUrl || ''}
                          alt={m.title}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      ) : m.mediaUrl ? (
                        <video
                          src={m.mediaUrl}
                          preload="metadata"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-900 text-sky-400">
                          <Film className="w-10 h-10" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center pointer-events-none">
                        <div className="w-10 h-10 rounded-full bg-white/90 text-sky-600 flex items-center justify-center shadow-md">
                          <Film className="w-5 h-5 fill-sky-600" />
                        </div>
                      </div>
                    </>
                  ) : (
                    <img
                      src={m.thumbnailUrl || m.mediaUrl}
                      alt={m.title}
                      loading="lazy"
                      className="w-full h-full object-cover bg-slate-100"
                    />
                  )}
                  <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/60 text-white text-[10px] font-semibold">
                    {m.type === 'video' ? 'VIDEO' : 'PHOTO'}
                  </div>
                  {m.albumId && albumMap.has(m.albumId) && (
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-white/90 text-slate-700 text-[10px] font-semibold truncate max-w-[120px]">
                      {albumMap.get(m.albumId)}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-3.5 flex-1 flex flex-col justify-between">
                  <div>
                    <span className="text-[11px] text-sky-600 font-medium">{formattedDate}</span>
                    <h3 className="text-sm font-semibold text-slate-800 line-clamp-1 mt-0.5">
                      {m.title || 'Untitled'}
                    </h3>
                    {m.caption && (
                      <p className="text-xs text-slate-500 line-clamp-2 mt-1 font-light">
                        {m.caption}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                    <a
                      href={m.mediaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-slate-400 hover:text-sky-600 rounded-lg hover:bg-sky-50 transition"
                      title="View original media"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(m)}
                        className="px-2.5 py-1 text-xs font-semibold text-sky-600 bg-sky-50 hover:bg-sky-100 rounded-lg flex items-center gap-1 transition"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>

                      <button
                        onClick={() => setDeletingMemory(m)}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title="Delete memory"
                        aria-label="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 text-slate-400 text-sm">
          No memories found matching your search and filter criteria.
        </div>
      )}

      {/* Edit Memory Modal */}
      {editingMemory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Edit Memory Details</h3>
              <button
                onClick={() => setEditingMemory(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Title</label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Caption</label>
              <textarea
                rows={3}
                value={editCaption}
                onChange={(e) => setEditCaption(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Media Type</label>
                <select
                  value={editType}
                  onChange={(e) => setEditType(e.target.value as 'photo' | 'video')}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:bg-white"
                >
                  <option value="photo">Photo</option>
                  <option value="video">Video</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Album</label>
                <select
                  value={editAlbumId}
                  onChange={(e) => setEditAlbumId(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:bg-white"
                >
                  <option value="">None (Unorganized)</option>
                  {albums.map((album) => (
                    <option key={album.id} value={album.id}>
                      {album.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Memory Date
                </label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:bg-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-3">
              <button
                type="button"
                onClick={() => setEditingMemory(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
                className="px-5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 rounded-xl shadow-xs transition flex items-center gap-1.5"
              >
                {isSavingEdit ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deletingMemory !== null}
        title="Delete Memory"
        message={`Are you sure you want to delete "${
          deletingMemory?.title || 'this memory'
        }"? This will permanently delete the metadata and media file from Cloud Storage.`}
        confirmLabel="Delete Memory"
        isDestructive={true}
        isLoading={isDeleting}
        onConfirm={confirmDeleteMemory}
        onCancel={() => {
          if (!isDeleting) setDeletingMemory(null);
        }}
      />

      {/* Delete All Memories Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isConfirmDeleteAllOpen}
        title="Delete All Memories"
        message={`Are you sure you want to permanently delete all ${memories.length} memories (photos and videos)? This will remove every record from the database and delete all associated media files from Supabase Storage. This action cannot be undone.`}
        confirmLabel={`Yes, Delete All (${memories.length})`}
        cancelLabel="Cancel"
        isDestructive={true}
        isLoading={isDeletingAll}
        onConfirm={confirmDeleteAllMemories}
        onCancel={() => {
          if (!isDeletingAll) setIsConfirmDeleteAllOpen(false);
        }}
      />
    </div>
  );
};
