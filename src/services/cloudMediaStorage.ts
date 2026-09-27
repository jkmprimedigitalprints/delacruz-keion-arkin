import { useState, useEffect } from 'react';
import {
  supabase,
  SUPABASE_STORAGE_BUCKET,
  isSupabaseConfigured,
  extractSupabaseErrorMessage,
} from '../supabase/client';
import {
  executeSupabaseWriteWithRetry,
  withHardTimeout,
  SUPABASE_WRITE_TIMEOUT_MS,
} from '../supabase/database';
import {
  blobToDataUrl,
  generateImageThumbnail,
  optimizeImageForCloud,
  generateVideoPoster,
} from './mediaOptimizer';

const STORAGE_UPLOAD_TIMEOUT_MS = 20_000; // 20s hard timeout for binary storage upload
const MAX_POSTGRES_INLINE_BYTES = 15 * 1024 * 1024; // 15MB inline Data URL threshold

// Cache bucket availability for 60s when "Bucket not found" occurs so batch uploads
// do not repeatedly hit a non-existent bucket endpoint.
let storageBucketMissingUntil = 0;

export function resetStorageBucketCheck(): void {
  storageBucketMissingUntil = 0;
}

function isBucketMissingOrBlockedError(err: unknown): boolean {
  const msg = extractSupabaseErrorMessage(err).toLowerCase();
  return (
    msg.includes('bucket not found') ||
    msg.includes('the resource was not found') ||
    msg.includes('row-level security') ||
    msg.includes('does not exist')
  );
}

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

/**
 * Uploads a photo or video to Supabase Storage (`media` / `memories` bucket) with:
 * - Hard timeout & automatic 3-attempt retry with exponential backoff for transient errors
 * - Immediate fallback (no wasted retries) if the Storage bucket has not been created yet
 * - Public URL generation via `supabase.storage.from(bucket).getPublicUrl()`
 */
export async function uploadMediaFileToCloud(
  memoryId: string,
  file: File,
  type: 'photo' | 'video',
  onProgress: (p: CloudUploadProgress) => void,
  onRetry: (attempt: number, maxAttempts: number, err: Error) => void,
  registerCancel: (cancelFn: () => void) => void
): Promise<CloudUploadResult> {
  let cancelled = false;
  registerCancel(() => {
    cancelled = true;
  });

  const totalOriginalBytes = file.size;
  const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  let finalMimeType = file.type || (type === 'photo' ? 'image/jpeg' : 'video/mp4');
  let uploadBlob: Blob = file;
  let thumbnailUrl: string | null = null;
  let posterUrl: string | null = null;

  onProgress({
    bytesTransferred: Math.round(totalOriginalBytes * 0.12),
    totalBytes: totalOriginalBytes,
    progress: 12,
  });

  // 1. Generate client-side preview thumbnail / video poster & optimize photo
  if (type === 'photo') {
    const [thumbBlob, optimizedBlob] = await Promise.all([
      generateImageThumbnail(file, 480, 480, 0.78),
      optimizeImageForCloud(file, 1600, 1600, 0.85),
    ]);

    if (cancelled) throw new Error('UPLOAD_CANCELLED');

    thumbnailUrl = await blobToDataUrl(thumbBlob);
    uploadBlob = optimizedBlob;
    finalMimeType = optimizedBlob.type || finalMimeType;
  } else {
    posterUrl = await generateVideoPoster(file);
    thumbnailUrl = posterUrl;
  }

  if (cancelled) throw new Error('UPLOAD_CANCELLED');

  onProgress({
    bytesTransferred: Math.round(totalOriginalBytes * 0.35),
    totalBytes: totalOriginalBytes,
    progress: 35,
  });

  const storagePath = `memories/${memoryId}/${cleanFileName}`;
  const shouldAttemptBucketUpload =
    isSupabaseConfigured && Date.now() > storageBucketMissingUntil;

  // 2. Upload binary file to Supabase Storage bucket if available
  if (shouldAttemptBucketUpload) {
    try {
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
            throw error;
          }
        },
        {
          timeoutMs: STORAGE_UPLOAD_TIMEOUT_MS,
          maxAttempts: 3,
          onRetry,
          isCancelled: () => cancelled,
        }
      );

      if (cancelled) throw new Error('UPLOAD_CANCELLED');

      const { data: publicUrlData } = supabase.storage
        .from(SUPABASE_STORAGE_BUCKET)
        .getPublicUrl(storagePath);

      const mediaUrl = publicUrlData?.publicUrl;
      if (!mediaUrl) {
        throw new Error('Supabase Storage did not return a public URL.');
      }

      onProgress({
        bytesTransferred: Math.round(totalOriginalBytes * 0.9),
        totalBytes: totalOriginalBytes,
        progress: 90,
      });

      return {
        mediaUrl,
        storagePath,
        thumbnailUrl: thumbnailUrl || mediaUrl,
        posterUrl,
        mimeType: finalMimeType,
      };
    } catch (storageErr: any) {
      if (cancelled || storageErr?.message === 'UPLOAD_CANCELLED') {
        throw new Error('UPLOAD_CANCELLED');
      }

      if (isBucketMissingOrBlockedError(storageErr)) {
        storageBucketMissingUntil = Date.now() + 60_000;
        console.info(
          `[SUPABASE] Storage bucket "${SUPABASE_STORAGE_BUCKET}" not provisioned yet. Using optimized inline media payload.`
        );
      } else {
        console.warn(
          `[SUPABASE] Storage upload fallback triggered (${extractSupabaseErrorMessage(
            storageErr
          )}).`
        );
      }
    }
  }

  // 3. Fallback when Storage bucket is not yet created:
  // First try server stream endpoint (/api/upload) for large videos, otherwise inline Data URL
  if (type === 'video' && uploadBlob.size > 4 * 1024 * 1024) {
    try {
      const response = await fetch(
        `/api/upload?id=${encodeURIComponent(memoryId)}&name=${encodeURIComponent(cleanFileName)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': finalMimeType },
          body: uploadBlob,
        }
      );
      if (response.ok) {
        const resJson = await response.json();
        if (resJson?.success && resJson?.mediaUrl) {
          onProgress({
            bytesTransferred: Math.round(totalOriginalBytes * 0.88),
            totalBytes: totalOriginalBytes,
            progress: 88,
          });
          return {
            mediaUrl: resJson.mediaUrl,
            storagePath: resJson.storagePath || `uploads/${memoryId}/${cleanFileName}`,
            thumbnailUrl: thumbnailUrl || posterUrl,
            posterUrl,
            mimeType: finalMimeType,
          };
        }
      }
    } catch {
      // Fall through to inline data URL below
    }
  }

  if (uploadBlob.size <= MAX_POSTGRES_INLINE_BYTES) {
    const fullDataUrl = await blobToDataUrl(uploadBlob);
    if (cancelled) throw new Error('UPLOAD_CANCELLED');

    onProgress({
      bytesTransferred: Math.round(totalOriginalBytes * 0.88),
      totalBytes: totalOriginalBytes,
      progress: 88,
    });

    return {
      mediaUrl: fullDataUrl,
      storagePath: `supabase_db_inline/${memoryId}`,
      thumbnailUrl: thumbnailUrl || (type === 'photo' ? fullDataUrl : null),
      posterUrl,
      mimeType: finalMimeType,
    };
  }

  throw new Error(
    `Sync Failed: Supabase Storage bucket "${SUPABASE_STORAGE_BUCKET}" was not found. Please run supabase/schema.sql in your Supabase SQL Editor to enable large video uploads.`
  );
}

/**
 * Deletes associated Supabase Storage objects when a memory is deleted
 */
export async function deleteCloudMediaFiles(
  storagePath?: string | null,
  memoryId?: string
): Promise<{
  success: boolean;
  storageWarning?: boolean;
}> {
  if (
    !storagePath ||
    storagePath.startsWith('supabase_db_inline/') ||
    storagePath.startsWith('uploads/')
  ) {
    return { success: true };
  }

  let storageWarning = false;

  if (storagePath.startsWith('memories/') && Date.now() > storageBucketMissingUntil) {
    try {
      const { error } = await withHardTimeout(
        supabase.storage.from(SUPABASE_STORAGE_BUCKET).remove([storagePath]),
        SUPABASE_WRITE_TIMEOUT_MS,
        `storage.remove ${storagePath}`
      );
      if (error) {
        console.info('[SUPABASE] Storage file cleanup note:', extractSupabaseErrorMessage(error));
        storageWarning = true;
      }
    } catch (err) {
      console.info('[SUPABASE] Storage file cleanup skipped:', extractSupabaseErrorMessage(err));
      storageWarning = true;
    }
  }

  if (memoryId) {
    memoryBlobUrlCache.delete(memoryId);
  }

  return { success: true, storageWarning };
}

// ============================================================================
// Client-Side Media URL Resolution Hook
// ============================================================================

const memoryBlobUrlCache = new Map<string, string>();

export function useResolvedMediaUrl(rawUrl?: string | null): {
  resolvedUrl: string | null;
  isResolving: boolean;
} {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(rawUrl || null);

  useEffect(() => {
    setResolvedUrl(rawUrl || null);
  }, [rawUrl]);

  return { resolvedUrl, isResolving: false };
}
