import React, { useState, useEffect } from 'react';
import {
  listenToAlbums,
  saveAlbumDocument,
  updateAlbumDocument,
  deleteAlbumDocument,
} from '../supabase/database';
import { Album } from '../types';
import {
  FolderHeart,
  Plus,
  Edit3,
  Trash2,
  Check,
  X,
  ArrowLeft,
  RefreshCw,
  Image as ImageIcon,
} from 'lucide-react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';

interface AdminAlbumsProps {
  navigate: (path: string) => void;
}

export const AdminAlbums: React.FC<AdminAlbumsProps> = ({ navigate }) => {
  const { showToast } = useToast();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal State (Create or Edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState<Album | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [sortOrder, setSortOrder] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);

  // Delete State
  const [deletingAlbum, setDeletingAlbum] = useState<Album | null>(null);

  useEffect(() => {
    const unsub = listenToAlbums((albumList) => {
      setAlbums(albumList);
      setIsLoading(false);
    }, true);
    return unsub;
  }, []);

  const openCreateModal = () => {
    setEditingAlbum(null);
    setName('');
    setDescription('');
    setCoverUrl('');
    setSortOrder(albums.length);
    setIsModalOpen(true);
  };

  const openEditModal = (album: Album) => {
    setEditingAlbum(album);
    setName(album.name);
    setDescription(album.description || '');
    setCoverUrl(album.coverUrl || '');
    setSortOrder(album.sortOrder ?? 0);
    setIsModalOpen(true);
  };

  const handleSaveAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Album name is required', 'error');
      return;
    }

    setIsSaving(true);
    try {
      if (editingAlbum) {
        await updateAlbumDocument(editingAlbum.id, {
          name: name.trim(),
          description: description.trim(),
          coverUrl: coverUrl.trim() || null,
          sortOrder: Number(sortOrder) || 0,
        });
        showToast('Album updated successfully!', 'success');
      } else {
        const id = `album-${Date.now()}`;
        await saveAlbumDocument(id, {
          name: name.trim(),
          description: description.trim(),
          coverUrl: coverUrl.trim() || null,
          sortOrder: Number(sortOrder) || 0,
          published: true,
        });
        showToast('New album created!', 'success');
      }
      setIsModalOpen(false);
    } catch (err: any) {
      showToast(err.message || 'Failed to save album', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDeleteAlbum = async () => {
    if (!deletingAlbum) return;

    try {
      await deleteAlbumDocument(deletingAlbum.id);
      showToast('Album deleted successfully', 'success');
      setDeletingAlbum(null);
    } catch (err: any) {
      showToast(err.message || 'Failed to delete album', 'error');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-[85vh]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-slate-200/80">
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
              Manage Albums
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Create and organize milestones, growth months, and special events.
            </p>
          </div>
        </div>

        <button
          onClick={openCreateModal}
          className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-md shadow-sky-200 flex items-center gap-2 transition"
        >
          <Plus className="w-4 h-4" />
          <span>New Album</span>
        </button>
      </div>

      {/* Album List */}
      {isLoading ? (
        <div className="text-center py-16 text-slate-400 text-sm">Loading albums...</div>
      ) : albums.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {albums.map((album) => (
            <div
              key={album.id}
              className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="relative aspect-16/10 rounded-xl overflow-hidden bg-slate-100 mb-3">
                  {album.coverUrl ? (
                    <img
                      src={album.coverUrl}
                      alt={album.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-sky-50 text-sky-500">
                      <FolderHeart className="w-10 h-10 mb-1" />
                      <span className="text-[11px] font-medium text-slate-400">No cover image</span>
                    </div>
                  )}
                  <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/60 text-white text-[10px] font-medium">
                    Order: {album.sortOrder}
                  </span>
                </div>

                <h3 className="font-semibold text-slate-800 text-base">{album.name}</h3>
                {album.description && (
                  <p className="text-xs text-slate-500 font-light mt-1 line-clamp-2">
                    {album.description}
                  </p>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  onClick={() => openEditModal(album)}
                  className="px-3 py-1.5 text-xs font-semibold text-sky-600 bg-sky-50 hover:bg-sky-100 rounded-xl flex items-center gap-1 transition"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
                <button
                  onClick={() => setDeletingAlbum(album)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                  title="Delete album"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 max-w-md mx-auto">
          <FolderHeart className="w-12 h-12 text-sky-400 mx-auto mb-3" />
          <h3 className="font-serif text-lg font-bold text-slate-800">No Albums Yet</h3>
          <p className="text-xs text-slate-500 mt-1 mb-6">
            Create albums like "Month 1", "Christening", "First Words" to organize memories.
          </p>
          <button
            onClick={openCreateModal}
            className="px-5 py-2.5 bg-sky-600 text-white text-xs font-semibold rounded-xl hover:bg-sky-700 transition"
          >
            Create Your First Album
          </button>
        </div>
      )}

      {/* Album Modal (Create or Edit) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <form
            onSubmit={handleSaveAlbum}
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {editingAlbum ? 'Edit Album' : 'Create New Album'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Album Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Month 6: First Bites"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Description
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief sentimental note about this album chapter..."
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Cover Image URL (optional)
              </label>
              <input
                type="url"
                value={coverUrl}
                onChange={(e) => setCoverUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Display Order (e.g. 0, 1, 2...)
              </label>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 rounded-xl shadow-xs transition flex items-center gap-1.5"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Save Album</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deletingAlbum !== null}
        title="Delete Album"
        message={`Are you sure you want to delete album "${deletingAlbum?.name}"? Memories in this album will remain in the gallery but become unorganized.`}
        confirmLabel="Delete Album"
        isDestructive={true}
        onConfirm={confirmDeleteAlbum}
        onCancel={() => setDeletingAlbum(null)}
      />
    </div>
  );
};
