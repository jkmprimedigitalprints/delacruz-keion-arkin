/**
 * Media Optimizer for fast gallery rendering and reliable Supabase Storage uploads.
 * - Generates lightweight WebP/JPEG thumbnails and optimized photos for images.
 * - Never converts video files to base64 or loads full videos into memory.
 * - Extracts an optional first-frame video poster when supported by the browser.
 */

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert media blob to data URL'));
      }
    };
    reader.onerror = () => reject(new Error('Error reading media file'));
    reader.readAsDataURL(blob);
  });
}

async function resizeImageFile(
  file: File,
  maxWidth: number,
  maxHeight: number,
  quality: number
): Promise<Blob> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await Promise.race([
        createImageBitmap(file),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Bitmap decode timeout')), 4500)
        ),
      ]);

      let { width, height } = bitmap;
      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, width);
      canvas.height = Math.max(1, height);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();

        return new Promise<Blob>((resolve) => {
          canvas.toBlob(
            (webpBlob) => {
              if (webpBlob) {
                resolve(webpBlob);
              } else {
                canvas.toBlob((jpegBlob) => resolve(jpegBlob || file), 'image/jpeg', quality);
              }
            },
            'image/webp',
            quality
          );
        });
      }
      bitmap.close();
    } catch {
      // Fallback to Image() below
    }
  }

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    const safetyTimeout = setTimeout(() => {
      URL.revokeObjectURL(url);
      resolve(file);
    }, 4500);

    img.onload = () => {
      clearTimeout(safetyTimeout);
      URL.revokeObjectURL(url);
      let { width, height } = img;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, width);
      canvas.height = Math.max(1, height);

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        (webpBlob) => {
          if (webpBlob) {
            resolve(webpBlob);
          } else {
            canvas.toBlob((jpegBlob) => resolve(jpegBlob || file), 'image/jpeg', quality);
          }
        },
        'image/webp',
        quality
      );
    };

    img.onerror = () => {
      clearTimeout(safetyTimeout);
      URL.revokeObjectURL(url);
      resolve(file);
    };

    img.src = url;
  });
}

export async function generateImageThumbnail(
  file: File,
  maxWidth = 640,
  maxHeight = 640,
  quality = 0.8
): Promise<Blob> {
  return resizeImageFile(file, maxWidth, maxHeight, quality);
}

export async function optimizeImageForCloud(
  file: File,
  maxWidth = 1800,
  maxHeight = 1800,
  quality = 0.85
): Promise<Blob> {
  if (file.type === 'image/gif' && file.size <= 5 * 1024 * 1024) {
    return file;
  }
  return resizeImageFile(file, maxWidth, maxHeight, quality);
}

/**
 * Extracts an optional first-frame poster thumbnail Blob for video files
 * without loading the full video into memory.
 */
export async function generateVideoPosterBlob(
  file: File,
  maxWidth = 640,
  maxHeight = 640,
  quality = 0.78
): Promise<Blob | null> {
  if (typeof document === 'undefined') return null;
  // Skip client-side canvas poster extraction for very large videos (>120MB) to preserve browser memory
  if (file.size > 120 * 1024 * 1024) return null;

  return new Promise((resolve) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    let resolved = false;

    const cleanup = () => {
      try {
        URL.revokeObjectURL(url);
        video.removeAttribute('src');
        video.load();
      } catch {}
    };

    const finish = (result: Blob | null) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeoutId);
      cleanup();
      resolve(result);
    };

    const timeoutId = setTimeout(() => {
      finish(null);
    }, 3500);

    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';

    const captureFrame = () => {
      try {
        let width = video.videoWidth || 640;
        let height = video.videoHeight || 360;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          finish(null);
          return;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            finish(blob || null);
          },
          'image/webp',
          quality
        );
      } catch {
        finish(null);
      }
    };

    video.onloadeddata = () => {
      try {
        video.currentTime = Math.min(0.15, (video.duration || 0) / 4);
      } catch {
        captureFrame();
      }
    };

    video.onseeked = captureFrame;
    video.onerror = () => finish(null);
    video.src = url;
  });
}

// ============================================================================
// Video & Photo Validation and MIME / Extension Normalization
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  type: 'photo' | 'video';
  mimeType: string;
  extension: string;
  error?: string;
}

const MAX_IMAGE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500MB

const EXTENSION_TO_VIDEO_MIME: Record<string, string> = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  qt: 'video/quicktime',
  avi: 'video/x-msvideo',
  mkv: 'video/x-matroska',
  '3gp': 'video/3gpp',
  '3g2': 'video/3gpp2',
  ogv: 'video/ogg',
  ogg: 'video/ogg',
  mpeg: 'video/mpeg',
  mpg: 'video/mpeg',
  mts: 'video/mp2t',
  m2ts: 'video/mp2t',
  ts: 'video/mp2t',
};

const EXTENSION_TO_IMAGE_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
  avif: 'image/avif',
};

const MIME_TO_DEFAULT_EXTENSION: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/x-m4v': 'm4v',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'video/x-msvideo': 'avi',
  'video/avi': 'avi',
  'video/msvideo': 'avi',
  'video/x-matroska': 'mkv',
  'video/mkv': 'mkv',
  'video/3gpp': '3gp',
  'video/3gpp2': '3g2',
  'video/ogg': 'ogv',
  'video/mpeg': 'mp4',
  'video/mp2t': 'mts',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/avif': 'avif',
};

export function extractFileExtension(fileName: string): string {
  const trimmed = (fileName || '').trim();
  const lastDot = trimmed.lastIndexOf('.');
  if (lastDot <= 0 || lastDot === trimmed.length - 1) return '';
  return trimmed
    .slice(lastDot + 1)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function resolveFileMimeAndType(file: File): {
  isVideo: boolean;
  isImage: boolean;
  mimeType: string;
  extension: string;
} {
  // Strip any "; codecs=..." parameter from file.type so Supabase Storage never rejects Content-Type
  const rawMime = (file.type || '').split(';')[0].trim().toLowerCase();
  const ext = extractFileExtension(file.name || '');

  // 1. Check explicit MIME prefix first (do not reject valid videos with unfamiliar extensions)
  if (rawMime.startsWith('video/')) {
    const normalizedMime =
      rawMime === 'video/x-m4v'
        ? 'video/mp4'
        : rawMime === 'video/avi' || rawMime === 'video/msvideo'
        ? 'video/x-msvideo'
        : rawMime === 'video/mkv'
        ? 'video/x-matroska'
        : rawMime;
    const finalExt = ext || MIME_TO_DEFAULT_EXTENSION[normalizedMime] || 'mp4';
    return {
      isVideo: true,
      isImage: false,
      mimeType: normalizedMime,
      extension: finalExt,
    };
  }

  if (rawMime.startsWith('image/')) {
    const normalizedMime = rawMime === 'image/jpg' ? 'image/jpeg' : rawMime;
    const finalExt = ext || MIME_TO_DEFAULT_EXTENSION[normalizedMime] || 'jpg';
    return {
      isVideo: false,
      isImage: true,
      mimeType: normalizedMime,
      extension: finalExt,
    };
  }

  // 2. Fallback to extension lookup when browser leaves file.type empty or application/octet-stream
  if (ext && EXTENSION_TO_VIDEO_MIME[ext]) {
    return {
      isVideo: true,
      isImage: false,
      mimeType: EXTENSION_TO_VIDEO_MIME[ext],
      extension: ext,
    };
  }

  if (ext && EXTENSION_TO_IMAGE_MIME[ext]) {
    return {
      isVideo: false,
      isImage: true,
      mimeType: EXTENSION_TO_IMAGE_MIME[ext],
      extension: ext,
    };
  }

  return {
    isVideo: false,
    isImage: false,
    mimeType: rawMime || 'application/octet-stream',
    extension: ext || 'bin',
  };
}

export function validateMediaFile(file: File): ValidationResult {
  if (!file || file.size === 0) {
    return {
      valid: false,
      type: 'photo',
      mimeType: 'image/jpeg',
      extension: 'jpg',
      error: `File "${file?.name || 'selected file'}" is empty (0 bytes). Please select a valid file.`,
    };
  }

  const { isVideo, isImage, mimeType, extension } = resolveFileMimeAndType(file);

  if (!isImage && !isVideo) {
    return {
      valid: false,
      type: 'photo',
      mimeType,
      extension,
      error: `Unsupported file type (${file.name}). Please choose a valid photo or video file.`,
    };
  }

  if (isImage && file.size > MAX_IMAGE_SIZE) {
    return {
      valid: false,
      type: 'photo',
      mimeType,
      extension,
      error: `Photo "${file.name}" is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum photo size is 50MB.`,
    };
  }

  if (isVideo && file.size > MAX_VIDEO_SIZE) {
    return {
      valid: false,
      type: 'video',
      mimeType,
      extension,
      error: `Video "${file.name}" is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum video size is 500MB.`,
    };
  }

  return {
    valid: true,
    type: isVideo ? 'video' : 'photo',
    mimeType,
    extension,
  };
}
