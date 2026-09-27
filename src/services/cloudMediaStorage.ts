import {
  supabase,
  SUPABASE_STORAGE_BUCKET,
  assertSupabaseConfigured,
  extractSupabaseErrorMessage,
} from '../supabase/client';
import {
  executeSupabaseWriteWithRetry,
  withHardTimeout,
  SUPABASE_WRITE_TIMEOUT_MS,
} from '../supabase/database';
import {
  generateImageThumbnail,
  optimizeImageForCloud,
  generateVideoPosterBlob,
  resolveFileMimeAndType,
} from './mediaOptimizer';

export interface CloudUploadProgress {
  bytesTransferred: number;
  totalBytes: number;
  progress: number;
}

export interface CloudUploadResult {
  mediaUrl: string;
  storagePath: string;
  thumbnailUrl: string | null;
  posterUrl: string | null;
  mimeType: string;
}

function buildSafeStorageFileName(originalName: string, fallbackExt: string): string {
  const trimmed = (originalName || 'file').trim();
  const lastDot = trimmed.lastIndexOf('.');
  const baseRaw = lastDot > 0 ? trimmed.slice(0, lastDot) : trimmed;
  const extRaw = lastDot > 0 ? trimmed.slice(lastDot + 1) : fallbackExt;

  const cleanBase =
    baseRaw
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 80) || 'media';
  const cleanExt =
    extRaw
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 10) || fallbackExt;

  return `${cleanBase}.${cleanExt}`;
}

/**
 * Uploads a photo or video directly to Supabase Storage bucket `media`:
 * - Never converts videos to base64 or loads entire videos into memory
 * - Uses dynamic timeout scaled to file size for large video files
 * - Uploads optional lightweight poster/thumbnail Blob to Storage bucket `media`
 * - Returns the final Storage path, public URL, and accurate MIME type
 */
export async function uploadMediaFileToCloud(
  memoryId: string,
  file: File,
  type: 'photo' | 'video',
  onProgress: (p: CloudUploadProgress) => void,
  onRetry: (attempt: number, maxAttempts: number, err: Error) => void,
  registerCancel: (cancelFn: () => void) => void
): Promise<CloudUploadResult> {
  assertSupabaseConfigured();

  let cancelled = false;
  registerCancel(() => {
    cancelled = true;
  });

  const totalOriginalBytes = file.size;
  const resolvedInfo = resolveFileMimeAndType(file);
  const safeFileName = buildSafeStorageFileName(
    file.name,
    resolvedInfo.extension || (type === 'video' ? 'mp4' : 'jpg')
  );

  let finalMimeType =
    resolvedInfo.mimeType || (type === 'photo' ? 'image/jpeg' : 'video/mp4');
  let uploadBlob: Blob = file;
  let thumbBlobToUpload: Blob | null = null;

  onProgress({
    bytesTransferred: Math.round(totalOriginalBytes * 0.05),
    totalBytes: totalOriginalBytes,
    progress: 5,
  });

  // 1. Prepare media (optimize photo or extract lightweight video poster Blob — no base64 conversion)
  if (type === 'photo') {
    const [thumbBlob, optimizedBlob] = await Promise.all([
      generateImageThumbnail(file, 480, 480, 0.78),
      optimizeImageForCloud(file, 1800, 1800, 0.86),
    ]);

    if (cancelled) throw new Error('UPLOAD_CANCELLED');

    thumbBlobToUpload = thumbBlob;
    uploadBlob = optimizedBlob;
    if (optimizedBlob.type) {
      finalMimeType = optimizedBlob.type.split(';')[0].trim();
    }
  } else {
    // Keep original video File intact; extract optional first-frame poster Blob
    uploadBlob = file;
    thumbBlobToUpload = await generateVideoPosterBlob(file);
  }

  if (cancelled) throw new Error('UPLOAD_CANCELLED');

  onProgress({
    bytesTransferred: Math.round(totalOriginalBytes * 0.18),
    totalBytes: totalOriginalBytes,
    progress: 18,
  });

  const storagePath = `memories/${memoryId}/${safeFileName}`;

  // Scale timeout dynamically with file size: min 90s + 5s per MB (up to 15 minutes for large videos)
  const fileSizeMb = Math.max(1, Math.ceil(uploadBlob.size / (1024 * 1024)));
  const dynamicStorageTimeoutMs = Math.min(900_000, Math.max(90_000, 60_000 + fileSizeMb * 5_000));

  console.log('[SUPABASE] Upload started', {
    id: memoryId,
    bucket: SUPABASE_STORAGE_BUCKET,
    storagePath,
    type,
    fileName: file.name,
    fileSize: file.size,
    mimeType: finalMimeType,
  });

  // Provide smooth progress heartbeats while binary upload streams to Supabase Storage
  let currentSimulatedPct = 20;
  const progressInterval = setInterval(() => {
    if (cancelled) return;
    if (currentSimulatedPct < 82) {
      const step = fileSizeMb > 25 ? 2 : 5;
      currentSimulatedPct = Math.min(82, currentSimulatedPct + step);
      onProgress({
        bytesTransferred: Math.round((totalOriginalBytes * currentSimulatedPct) / 100),
        totalBytes: totalOriginalBytes,
        progress: currentSimulatedPct,
      });
    }
  }, 900);

  try {
    // 2. Upload actual file to Supabase Storage bucket `media`
    await executeSupabaseWriteWithRetry(
      memoryId,
      `storage.${SUPABASE_STORAGE_BUCKET}`,
      'STORAGE_UPLOAD',
      async () => {
        const { error } = await supabase.storage
          .from(SUPABASE_STORAGE_BUCKET)
          .upload(storagePath, uploadBlob, {
            contentType: finalMimeType,
            cacheControl: '3600',
            upsert: true,
          });

        if (error) {
          const errMsg = extractSupabaseErrorMessage(error).toLowerCase();
          // If bucket restricts unfamiliar video MIME types, retry immediately with standard video/mp4 Content-Type
          if (
            type === 'video' &&
            (errMsg.includes('mime type') || errMsg.includes('content-type') || errMsg.includes('invalid'))
          ) {
            const { error: fallbackMimeErr } = await supabase.storage
              .from(SUPABASE_STORAGE_BUCKET)
              .upload(storagePath, uploadBlob, {
                contentType: 'video/mp4',
                cacheControl: '3600',
                upsert: true,
              });
            if (!fallbackMimeErr) {
              return;
            }
          }
          throw error;
        }
      },
      {
        timeoutMs: dynamicStorageTimeoutMs,
        maxAttempts: 3,
        onRetry,
        isCancelled: () => cancelled,
      }
    );
  } finally {
    clearInterval(progressInterval);
  }

  if (cancelled) throw new Error('UPLOAD_CANCELLED');

  // 3. Obtain the final public Storage URL
  const { data: publicUrlData } = supabase.storage
    .from(SUPABASE_STORAGE_BUCKET)
    .getPublicUrl(storagePath);

  const mediaUrl = publicUrlData?.publicUrl;
  if (!mediaUrl) {
    throw new Error('Supabase Storage did not return a public URL for the uploaded file.');
  }

  let thumbnailUrl: string | null = type === 'photo' ? mediaUrl : null;
  let posterUrl: string | null = null;

  // 4. Upload optional generated thumbnail/poster Blob to Storage bucket `media`
  if (thumbBlobToUpload) {
    const thumbPath = `memories/${memoryId}/thumb_${safeFileName}.webp`;
    try {
      const { error: thumbErr } = await withHardTimeout(
        supabase.storage.from(SUPABASE_STORAGE_BUCKET).upload(thumbPath, thumbBlobToUpload, {
          contentType: thumbBlobToUpload.type || 'image/webp',
          cacheControl: '3600',
          upsert: true,
        }),
        SUPABASE_WRITE_TIMEOUT_MS,
        `THUMB_UPLOAD ${thumbPath}`
      );

      if (!thumbErr) {
        const { data: thumbUrlData } = supabase.storage
          .from(SUPABASE_STORAGE_BUCKET)
          .getPublicUrl(thumbPath);
        if (thumbUrlData?.publicUrl) {
          thumbnailUrl = thumbUrlData.publicUrl;
          if (type === 'video') {
            posterUrl = thumbUrlData.publicUrl;
          }
        }
      }
    } catch {
      // Non-fatal: photo uses mediaUrl; video uses native <video preload="metadata">
    }
  }

  console.log('[SUPABASE] Storage upload completed', {
    id: memoryId,
    bucket: SUPABASE_STORAGE_BUCKET,
    storagePath,
    mediaUrl,
    thumbnailUrl,
    posterUrl,
  });

  onProgress({
    bytesTransferred: Math.round(totalOriginalBytes * 0.88),
    totalBytes: totalOriginalBytes,
    progress: 88,
  });

  return {
    mediaUrl,
    storagePath,
    thumbnailUrl,
    posterUrl,
    mimeType: finalMimeType,
  };
}

/**
 * Deletes associated Supabase Storage objects from bucket `media` when a memory is deleted
 */
export async function deleteCloudMediaFiles(
  storagePath?: string | null,
  memoryId?: string
): Promise<{
  success: boolean;
  storageWarning?: boolean;
}> {
  if (!storagePath) {
    return { success: true };
  }

  let storageWarning = false;

  try {
    const pathsToRemove = [storagePath];
    const parts = storagePath.split('/');
    if (parts.length >= 3) {
      const fileName = parts[parts.length - 1];
      const folder = parts.slice(0, -1).join('/');
      pathsToRemove.push(`${folder}/thumb_${fileName}.webp`);
    }

    const { error } = await withHardTimeout(
      supabase.storage.from(SUPABASE_STORAGE_BUCKET).remove(pathsToRemove),
      SUPABASE_WRITE_TIMEOUT_MS,
      `storage.remove ${storagePath}`
    );
    if (error) {
      console.warn('[SUPABASE] Storage file cleanup warning:', extractSupabaseErrorMessage(error));
      storageWarning = true;
    }
  } catch (err) {
    console.warn('[SUPABASE] Storage file cleanup skipped:', extractSupabaseErrorMessage(err));
    storageWarning = true;
  }

  if (memoryId) {
    memoryBlobUrlCache.delete(memoryId);
  }

  return { success: true, storageWarning };
}

/**
 * Deletes multiple Supabase Storage objects from bucket `media` in batches when deleting all memories
 */
export async function deleteMultipleCloudMediaFiles(
  storagePaths: string[],
  memoryIds?: string[]
): Promise<{
  success: boolean;
  storageWarning?: boolean;
}> {
  if (memoryIds) {
    for (const id of memoryIds) {
      memoryBlobUrlCache.delete(id);
    }
  }

  const validPaths = storagePaths.filter(Boolean);
  if (validPaths.length === 0) {
    return { success: true };
  }

  const allPathsToRemove = new Set<string>();
  for (const storagePath of validPaths) {
    allPathsToRemove.add(storagePath);
    const parts = storagePath.split('/');
    if (parts.length >= 3) {
      const fileName = parts[parts.length - 1];
      const folder = parts.slice(0, -1).join('/');
      allPathsToRemove.add(`${folder}/thumb_${fileName}.webp`);
    }
  }

  const pathList = Array.from(allPathsToRemove);
  let storageWarning = false;
  const chunkSize = 100;

  for (let i = 0; i < pathList.length; i += chunkSize) {
    const chunk = pathList.slice(i, i + chunkSize);
    try {
      const { error } = await withHardTimeout(
        supabase.storage.from(SUPABASE_STORAGE_BUCKET).remove(chunk),
        SUPABASE_WRITE_TIMEOUT_MS,
        `storage.remove batch (${chunk.length} files)`
      );
      if (error) {
        console.warn('[SUPABASE] Batch storage cleanup warning:', extractSupabaseErrorMessage(error));
        storageWarning = true;
      }
    } catch (err) {
      console.warn('[SUPABASE] Batch storage cleanup skipped:', extractSupabaseErrorMessage(err));
      storageWarning = true;
    }
  }

  return { success: true, storageWarning };
}

// ============================================================================
// Client-Side Media URL Resolution & Session Image Preload Cache
// ============================================================================

const memoryBlobUrlCache = new Map<string, string>();
const MAX_CACHED_IMAGES = 80;
const preloadedImagesCache = new Map<string, HTMLImageElement>();
const loadedImageUrls = new Set<string>();
const inFlightPreloads = new Map<string, Promise<boolean>>();
const preloadedVideoMetadataUrls = new Set<string>();

function rememberLoadedImage(url: string, img?: HTMLImageElement) {
  loadedImageUrls.add(url);
  if (img) {
    if (preloadedImagesCache.has(url)) {
      preloadedImagesCache.delete(url);
    } else if (preloadedImagesCache.size >= MAX_CACHED_IMAGES) {
      const oldestKey = preloadedImagesCache.keys().next().value;
      if (oldestKey) {
        preloadedImagesCache.delete(oldestKey);
      }
    }
    preloadedImagesCache.set(url, img);
  }
}

/**
 * Returns true if the given image URL has already been downloaded and decoded in this session.
 */
export function isImageCached(url?: string | null): boolean {
  if (!url) return false;
  return loadedImageUrls.has(url);
}

/**
 * Marks an image URL as loaded in the session cache (e.g., when an <img> fires onLoad).
 */
export function markImageCached(url?: string | null): void {
  if (!url) return;
  rememberLoadedImage(url);
}

/**
 * Preloads a single image URL into browser memory and decodes it asynchronously.
 */
export function preloadImage(
  url?: string | null,
  priority: 'high' | 'low' = 'low'
): Promise<boolean> {
  if (!url) return Promise.resolve(false);
  if (loadedImageUrls.has(url)) return Promise.resolve(true);

  const existingPromise = inFlightPreloads.get(url);
  if (existingPromise) return existingPromise;

  const promise = new Promise<boolean>((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    if ('fetchPriority' in img) {
      (img as any).fetchPriority = priority;
    }

    const finalize = (success: boolean) => {
      inFlightPreloads.delete(url);
      if (success) {
        rememberLoadedImage(url, img);
      }
      resolve(success);
    };

    img.onload = () => {
      if (typeof img.decode === 'function') {
        img
          .decode()
          .then(() => finalize(true))
          .catch(() => finalize(true));
      } else {
        finalize(true);
      }
    };

    img.onerror = () => {
      finalize(false);
    };

    img.src = url;
  });

  inFlightPreloads.set(url, promise);
  return promise;
}

/**
 * Lightweight metadata-only warmup for adjacent video items without downloading the full video.
 */
function preloadVideoMetadataOnly(videoUrl?: string | null) {
  if (!videoUrl || typeof document === 'undefined') return;
  if (preloadedVideoMetadataUrls.has(videoUrl)) return;
  preloadedVideoMetadataUrls.add(videoUrl);

  try {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.src = videoUrl;
  } catch {
    // Ignore metadata warmup errors
  }
}

/**
 * Preloads only the specific window of memories around the active item:
 * - current (index)
 * - previous (index - 1)
 * - next (index + 1)
 * - next + 1 (index + 2)
 * Never preloads the entire gallery.
 */
export function preloadViewerWindow(
  memoriesList: Array<{
    type: 'photo' | 'video';
    mediaUrl?: string | null;
    thumbnailUrl?: string | null;
    posterUrl?: string | null;
  }>,
  currentIndex: number
): void {
  if (currentIndex < 0 || currentIndex >= memoriesList.length) return;

  const indicesToPreload: Array<{ idx: number; priority: 'high' | 'low' }> = [
    { idx: currentIndex, priority: 'high' },
    { idx: currentIndex + 1, priority: 'high' },
    { idx: currentIndex - 1, priority: 'high' },
    { idx: currentIndex + 2, priority: 'low' },
  ];

  for (const { idx, priority } of indicesToPreload) {
    if (idx < 0 || idx >= memoriesList.length) continue;
    const item = memoriesList[idx];
    if (!item) continue;

    if (item.type === 'video') {
      const poster = item.posterUrl || item.thumbnailUrl;
      if (poster) {
        preloadImage(poster, priority);
      }
      if (idx === currentIndex + 1 && item.mediaUrl) {
        preloadVideoMetadataOnly(item.mediaUrl);
      }
    } else {
      if (item.thumbnailUrl && item.thumbnailUrl !== item.mediaUrl) {
        preloadImage(item.thumbnailUrl, priority);
      }
      if (item.mediaUrl) {
        preloadImage(item.mediaUrl, priority);
      }
    }
  }
}

export function useResolvedMediaUrl(rawUrl?: string | null): {
  resolvedUrl: string | null;
  isResolving: boolean;
} {
  return {
    resolvedUrl: rawUrl || null,
    isResolving: false,
  };
}
