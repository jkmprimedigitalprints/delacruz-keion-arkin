import React, { useState, useEffect, useRef } from 'react';
import {
  UploadCloud,
  Camera,
  Image as ImageIcon,
  Film,
  FolderHeart,
  X,
  ArrowLeft,
} from 'lucide-react';
import { uploadManager } from '../services/uploadManager';
import { validateMediaFile } from '../services/mediaOptimizer';
import { listenToAlbums } from '../supabase/database';
import { checkAdminSession } from '../supabase/auth';
import { Album } from '../types';
import { useToast } from '../components/Toast';

interface AdminUploadProps {
  navigate: (path: string) => void;
}

interface StagedFile {
  id: string;
  file: File;
  previewUrl: string;
  type: 'photo' | 'video';
  title: string;
  caption: string;
}

export const AdminUpload: React.FC<AdminUploadProps> = ({ navigate }) => {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [albums, setAlbums] = useState<Album[]>([]);
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [sharedAlbumId, setSharedAlbumId] = useState<string>('');
  const [sharedMemoryDate, setSharedMemoryDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [sharedCaption, setSharedCaption] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const unsub = listenToAlbums((albumList) => {
      setAlbums(albumList);
    }, true);
    return unsub;
  }, []);

  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newStaged: StagedFile[] = [];
    let skippedInvalid = 0;
    let skippedDuplicate = 0;
    let firstValidationError = '';

    Array.from(files).forEach((file) => {
      // Check for duplicate in current staged list
      const alreadyStaged =
        stagedFiles.some(
          (s) =>
            s.file.name === file.name &&
            s.file.size === file.size &&
            s.file.lastModified === file.lastModified
        ) ||
        newStaged.some(
          (s) =>
            s.file.name === file.name &&
            s.file.size === file.size &&
            s.file.lastModified === file.lastModified
        );

      if (alreadyStaged) {
        skippedDuplicate++;
        return;
      }

      const validation = validateMediaFile(file);
      if (!validation.valid) {
        skippedInvalid++;
        if (!firstValidationError && validation.error) {
          firstValidationError = validation.error;
        }
        return;
      }

      const previewUrl = URL.createObjectURL(file);
      const cleanTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');

      newStaged.push({
        id: `staged-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        file,
        previewUrl,
        type: validation.type,
        title: cleanTitle,
        caption: sharedCaption,
      });
    });

    // Reset input value so selecting the same file again after removing works
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';

    if (skippedInvalid > 0 && firstValidationError) {
      showToast(firstValidationError, 'error');
    } else if (skippedDuplicate > 0 && newStaged.length === 0) {
      showToast('Selected file is already in the upload list.', 'info');
    }

    if (newStaged.length > 0) {
      setStagedFiles((prev) => [...prev, ...newStaged]);
      showToast(
        `Added ${newStaged.length} ${newStaged.length === 1 ? 'file' : 'files'} to staging queue`,
        'info'
      );
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      handleFilesSelected(e.dataTransfer.files);
    }
  };

  const removeStagedFile = (id: string) => {
    setStagedFiles((prev) => {
      const item = prev.find((f) => f.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((f) => f.id !== id);
    });
  };

  const updateStagedItem = (id: string, updates: Partial<StagedFile>) => {
    setStagedFiles((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  const handleStartUpload = async () => {
    if (isSubmitting) return;
    if (stagedFiles.length === 0) {
      showToast('Please select at least one photo or video', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const isSessionActive = await checkAdminSession();
      if (!isSessionActive) {
        showToast('Your admin session has expired. Please sign in again.', 'error');
        navigate('/familyadmin');
        return;
      }

      const uploadInputs = stagedFiles.map((sf) => ({
        file: sf.file,
        title: sf.title.trim(),
        caption: sf.caption.trim() || sharedCaption.trim(),
        albumId: sharedAlbumId || undefined,
        memoryDate: sharedMemoryDate,
      }));

      uploadManager.addFiles(uploadInputs, {
        albumId: sharedAlbumId || undefined,
        memoryDate: sharedMemoryDate,
        caption: sharedCaption.trim(),
      });

      // Cleanup staging object URLs
      stagedFiles.forEach((f) => URL.revokeObjectURL(f.previewUrl));
      setStagedFiles([]);

      showToast(
        `Cloud upload started for ${uploadInputs.length} ${
          uploadInputs.length === 1 ? 'file' : 'files'
        }. Realtime updates will sync automatically.`,
        'success'
      );

      // Redirect to dashboard
      navigate('/familyadmin/dashboard');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-[85vh]">
      {/* Navigation header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/familyadmin/dashboard')}
          className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-white border border-slate-200 transition"
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900">
            Upload Baby Memories
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Add multiple photos and videos with fast background cloud synchronization.
          </p>
        </div>
      </div>

      {/* Main Dropzone / Selection Box */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center transition-all duration-200 ${
          isDragging
            ? 'border-sky-500 bg-sky-50/80 scale-[1.01]'
            : 'border-slate-200 bg-white hover:border-sky-300 hover:bg-sky-50/30'
        }`}
      >
        <div className="w-16 h-16 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center mx-auto mb-4 shadow-xs">
          <UploadCloud className="w-8 h-8" />
        </div>

        <h3 className="text-lg font-semibold text-slate-800 mb-1">
          Drag & drop photos and videos here
        </h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto mb-6">
          High-resolution photos (JPG, PNG, WebP, HEIC) and videos (MP4, MOV, WebM).
        </p>

        {/* Buttons: File Picker & Camera Picker */}
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*,.mp4,.mov,.webm,.avi,.mkv,.m4v,.3gp,.heic,.heif,.avif"
            className="hidden"
            onChange={(e) => handleFilesSelected(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs sm:text-sm shadow-md shadow-sky-200 flex items-center gap-2 transition"
          >
            <ImageIcon className="w-4 h-4" />
            <span>Select Photos & Videos</span>
          </button>

          {/* Camera input for mobile capture */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handleFilesSelected(e.target.files)}
          />
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-medium text-xs sm:text-sm flex items-center gap-2 transition"
          >
            <Camera className="w-4 h-4 text-sky-600" />
            <span>Take Photo</span>
          </button>
        </div>
      </div>

      {/* Shared Batch Metadata Section */}
      <div className="mt-8 bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs">
        <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
          <FolderHeart className="w-4 h-4 text-sky-600" />
          <span>Batch Details (Applied to selected files)</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Target Album */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Assign to Album
            </label>
            <select
              value={sharedAlbumId}
              onChange={(e) => setSharedAlbumId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-sky-200 transition"
            >
              <option value="">None (Unorganized)</option>
              {albums.map((album) => (
                <option key={album.id} value={album.id}>
                  {album.name}
                </option>
              ))}
            </select>
          </div>

          {/* Memory Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Memory Date
            </label>
            <input
              type="date"
              value={sharedMemoryDate}
              onChange={(e) => setSharedMemoryDate(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-sky-200 transition"
            />
          </div>

          {/* Shared Caption */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Shared Caption / Story
            </label>
            <textarea
              rows={2}
              value={sharedCaption}
              onChange={(e) => setSharedCaption(e.target.value)}
              placeholder="e.g. Grandma's first visit, crawling in the living room..."
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-sky-200 transition"
            />
          </div>
        </div>
      </div>

      {/* Selected Files Preview Grid */}
      {stagedFiles.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-800">
              Selected Files ({stagedFiles.length})
            </h3>
            <button
              onClick={() => {
                stagedFiles.forEach((f) => URL.revokeObjectURL(f.previewUrl));
                setStagedFiles([]);
              }}
              className="text-xs text-rose-600 hover:text-rose-800 font-medium"
            >
              Clear All
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {stagedFiles.map((staged) => (
              <div
                key={staged.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-2xs flex flex-col justify-between"
              >
                <div className="relative aspect-4/3 rounded-xl overflow-hidden bg-slate-900 mb-3">
                  {staged.type === 'photo' ? (
                    <img
                      src={staged.previewUrl}
                      alt={staged.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full relative flex flex-col items-center justify-center bg-slate-900 text-sky-400">
                      <video
                        src={staged.previewUrl}
                        preload="metadata"
                        muted
                        playsInline
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/25 flex items-center justify-center pointer-events-none">
                        <div className="w-9 h-9 rounded-full bg-white/90 text-sky-600 flex items-center justify-center shadow-sm">
                          <Film className="w-4 h-4 fill-sky-600" />
                        </div>
                      </div>
                      <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/60 text-white text-[10px] font-semibold">
                        VIDEO
                      </span>
                    </div>
                  )}

                  <button
                    onClick={() => removeStagedFile(staged.id)}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-slate-900/60 hover:bg-rose-600 text-white transition"
                    title="Remove file"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-2">
                  <input
                    type="text"
                    value={staged.title}
                    onChange={(e) => updateStagedItem(staged.id, { title: e.target.value })}
                    placeholder="Title"
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:bg-white"
                  />
                  <input
                    type="text"
                    value={staged.caption}
                    onChange={(e) => updateStagedItem(staged.id, { caption: e.target.value })}
                    placeholder="Caption (optional)"
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 focus:bg-white"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Action button */}
          <div className="mt-8 flex justify-end">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleStartUpload}
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:bg-sky-400 text-white font-semibold text-sm shadow-lg shadow-sky-200 flex items-center justify-center gap-2 transition"
            >
              <UploadCloud className="w-5 h-5" />
              <span>
                {isSubmitting
                  ? 'Starting Upload...'
                  : `Start Fast Upload (${stagedFiles.length} ${
                      stagedFiles.length === 1 ? 'file' : 'files'
                    })`}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
