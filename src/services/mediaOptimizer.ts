/**
 * Media Optimizer for fast gallery rendering and reliable cloud storage.
 * Generates lightweight WebP/JPEG thumbnails, high-resolution optimized photos,
 * and first-frame video posters asynchronously on the client without blocking the UI.
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
  // Use createImageBitmap if available for high-speed multi-threaded decoding
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

  // Fallback via Image() element with safety timeout
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
  quality = 0.80
): Promise<Blob> {
  return resizeImageFile(file, maxWidth, maxHeight, quality);
}

export async function optimizeImageForCloud(
  file: File,
  maxWidth = 1800,
  maxHeight = 1800,
  quality = 0.85
): Promise<Blob> {
  // Keep animated GIFs intact if small enough
  if (file.type === 'image/gif' && file.size <= 2 * 1024 * 1024) {
    return file;
  }
  return resizeImageFile(file, maxWidth, maxHeight, quality);
}

/**
 * Extracts a first-frame poster thumbnail Data URL for video files
 */
export async function generateVideoPoster(
  file: File,
  maxWidth = 640,
  maxHeight = 640,
  quality = 0.78
): Promise<string | null> {
  if (typeof document === 'undefined') return null;

  return new Promise((resolve) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    let resolved = false;

    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.removeAttribute('src');
      video.load();
    };

    const finish = (result: string | null) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeoutId);
      cleanup();
      resolve(result);
    };

    const timeoutId = setTimeout(() => {
      finish(null);
    }, 4500);

    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';

    video.onloadeddata = () => {
      try {
        video.currentTime = Math.min(0.15, (video.duration || 0) / 4);
      } catch {
        captureFrame();
      }
    };

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
        const dataUrl = canvas.toDataURL('image/webp', quality);
        finish(dataUrl.startsWith('data:image/') ? dataUrl : null);
      } catch {
        finish(null);
      }
    };

    video.onseeked = captureFrame;
    video.onerror = () => finish(null);
    video.src = url;
  });
}

/**
 * Comprehensive file validation for empty, unsupported, or oversized files
 */
export interface ValidationResult {
  valid: boolean;
  type: 'photo' | 'video';
  error?: string;
}

const MAX_IMAGE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_VIDEO_SIZE = 300 * 1024 * 1024; // 300MB

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/gif',
];

const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-m4v',
  'video/3gpp',
];

export function validateMediaFile(file: File): ValidationResult {
  if (!file || file.size === 0) {
    return {
      valid: false,
      type: 'photo',
      error: `File "${file?.name || 'selected file'}" is empty (0 bytes). Please select a valid file.`,
    };
  }

  const mimeType = (file.type || '').toLowerCase();

  const isImage =
    ALLOWED_IMAGE_TYPES.includes(mimeType) ||
    file.name.match(/\.(jpe?g|png|webp|heic|heif|gif)$/i) !== null;

  const isVideo =
    ALLOWED_VIDEO_TYPES.includes(mimeType) ||
    file.name.match(/\.(mp4|webm|mov|m4v|3gp)$/i) !== null;

  if (!isImage && !isVideo) {
    return {
      valid: false,
      type: 'photo',
      error: `Unsupported file type (${file.name}). Please choose a valid photo (JPG, PNG, WebP, HEIC, GIF) or video (MP4, MOV, WebM).`,
    };
  }

  if (isImage && file.size > MAX_IMAGE_SIZE) {
    return {
      valid: false,
      type: 'photo',
      error: `Photo "${file.name}" is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum photo size is 50MB.`,
    };
  }

  if (isVideo && file.size > MAX_VIDEO_SIZE) {
    return {
      valid: false,
      type: 'video',
      error: `Video "${file.name}" is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum video size is 300MB.`,
    };
  }

  return {
    valid: true,
    type: isVideo ? 'video' : 'photo',
  };
}
