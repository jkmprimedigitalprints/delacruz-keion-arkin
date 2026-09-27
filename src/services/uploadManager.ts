import { saveMemoryDocument, formatSupabaseErrorMessage } from '../supabase/database';
import { checkAdminSession } from '../supabase/auth';
import { UploadItem, Memory } from '../types';
import { validateMediaFile } from './mediaOptimizer';
import {
  uploadMediaFileToCloud,
  deleteCloudMediaFiles,
} from './cloudMediaStorage';

export const MAX_IMAGE_UPLOADS = 3;
export const MAX_VIDEO_UPLOADS = 1;

export type QueueSubscriber = (items: UploadItem[]) => void;

export interface StagedUploadFileInput {
  file: File;
  title?: string;
  caption?: string;
  albumId?: string;
  memoryDate?: string;
}

class UploadManager {
  private queue: UploadItem[] = [];
  private subscribers: Set<QueueSubscriber> = new Set();
  private cancelMap: Map<string, () => void> = new Map();
  private watchdogMap: Map<string, ReturnType<typeof setInterval>> = new Map();
  private notifyThrottleTimeout: ReturnType<typeof setTimeout> | null = null;
  private lastNotifyTime = 0;

  public subscribe(fn: QueueSubscriber): () => void {
    this.subscribers.add(fn);
    fn(this.getItems());
    return () => {
      this.subscribers.delete(fn);
    };
  }

  public getItems(): UploadItem[] {
    return [...this.queue];
  }

  /**
   * Throttled UI notifications to keep the main thread responsive
   */
  private notify(immediate = false) {
    const now = Date.now();
    const throttleMs = 80;

    if (immediate || now - this.lastNotifyTime >= throttleMs) {
      if (this.notifyThrottleTimeout) {
        clearTimeout(this.notifyThrottleTimeout);
        this.notifyThrottleTimeout = null;
      }
      this.lastNotifyTime = now;
      const items = this.getItems();
      this.subscribers.forEach((fn) => fn(items));
    } else if (!this.notifyThrottleTimeout) {
      this.notifyThrottleTimeout = setTimeout(() => {
        this.notifyThrottleTimeout = null;
        this.lastNotifyTime = Date.now();
        const items = this.getItems();
        this.subscribers.forEach((fn) => fn(items));
      }, throttleMs - (now - this.lastNotifyTime));
    }
  }

  private isDuplicateActiveFile(file: File): boolean {
    return this.queue.some(
      (item) =>
        (item.status === 'queued' ||
          item.status === 'starting' ||
          item.status === 'uploading' ||
          item.status === 'finalizing' ||
          item.status === 'syncing' ||
          item.status === 'retrying') &&
        item.file.name === file.name &&
        item.file.size === file.size &&
        item.file.lastModified === file.lastModified
    );
  }

  public addFiles(
    inputs: Array<File | StagedUploadFileInput>,
    sharedMetadata?: {
      title?: string;
      caption?: string;
      albumId?: string;
      memoryDate?: string;
    }
  ) {
    const newItems: UploadItem[] = [];

    for (const entry of inputs) {
      const isFileInstance = entry instanceof File;
      const file = isFileInstance ? entry : entry.file;
      const itemTitle = (!isFileInstance && entry.title) || sharedMetadata?.title || '';
      const itemCaption =
        (!isFileInstance && entry.caption !== undefined ? entry.caption : sharedMetadata?.caption) || '';
      const itemAlbumId = (!isFileInstance && entry.albumId) || sharedMetadata?.albumId || undefined;
      const itemMemoryDate =
        (!isFileInstance && entry.memoryDate) ||
        sharedMetadata?.memoryDate ||
        new Date().toISOString().split('T')[0];

      if (this.isDuplicateActiveFile(file)) {
        console.info(`[SUPABASE] Skipped duplicate active upload: ${file.name}`);
        continue;
      }

      const validation = validateMediaFile(file);

      // Deterministic ID per queued item; preserved across retries so retries never duplicate rows
      const rawId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `upload-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
      const id = rawId.replace(/[^a-zA-Z0-9_-]/g, '');

      const previewUrl = URL.createObjectURL(file);

      const item: UploadItem = {
        id,
        file,
        name: file.name,
        size: file.size,
        type: validation.type,
        progress: 0,
        bytesTransferred: 0,
        totalBytes: file.size,
        status: validation.valid ? 'queued' : 'failed',
        error: validation.error,
        previewUrl,
        title: itemTitle,
        caption: itemCaption,
        albumId: itemAlbumId,
        memoryDate: itemMemoryDate,
      };

      newItems.push(item);
    }

    if (newItems.length === 0) return;

    this.queue = [...this.queue, ...newItems];
    this.notify(true);
    this.processQueue();
  }

  public retry(id: string) {
    const item = this.queue.find((i) => i.id === id);
    if (!item) return;

    console.log(`[SUPABASE] Manual retry requested (id: ${item.id}, file: ${item.name})`);
    this.clearWatchdog(id);
    const existingCancel = this.cancelMap.get(id);
    if (existingCancel) {
      existingCancel();
      this.cancelMap.delete(id);
    }

    const validation = validateMediaFile(item.file);
    if (!validation.valid) {
      item.status = 'failed';
      item.error = validation.error;
      this.notify(true);
      return;
    }

    // Reuse the exact same item.id so retrying upserts the same Supabase row without duplicates
    item.status = 'queued';
    item.progress = 0;
    item.bytesTransferred = 0;
    item.retryAttempt = undefined;
    item.error = undefined;
    item.isStalled = false;
    this.notify(true);
    this.processQueue();
  }

  public cancel(id: string) {
    const item = this.queue.find((i) => i.id === id);
    if (!item) return;

    this.clearWatchdog(id);

    const cancelFn = this.cancelMap.get(id);
    if (cancelFn) {
      cancelFn();
      this.cancelMap.delete(id);
    }

    item.status = 'cancelled';
    item.retryAttempt = undefined;
    item.error = undefined;
    item.isStalled = false;
    this.notify(true);
    this.processQueue();
  }

  public clearCompleted() {
    this.queue = this.queue.filter((item) => {
      const shouldRemove = item.status === 'completed' || item.status === 'cancelled';
      if (shouldRemove && item.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
      }
      return !shouldRemove;
    });
    this.notify(true);
  }

  public clearAll() {
    this.cancelMap.forEach((cancelFn) => cancelFn());
    this.cancelMap.clear();
    this.watchdogMap.forEach((t) => clearInterval(t));
    this.watchdogMap.clear();

    this.queue.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
    this.queue = [];
    this.notify(true);
  }

  private getActiveUploadCounts() {
    let images = 0;
    let videos = 0;

    for (const item of this.queue) {
      if (
        item.status === 'starting' ||
        item.status === 'uploading' ||
        item.status === 'finalizing' ||
        item.status === 'syncing' ||
        item.status === 'retrying'
      ) {
        if (item.type === 'video') videos++;
        else images++;
      }
    }

    return { images, videos };
  }

  private processQueue() {
    let { images, videos } = this.getActiveUploadCounts();

    while (videos < MAX_VIDEO_UPLOADS) {
      const nextVideo = this.queue.find((item) => item.status === 'queued' && item.type === 'video');
      if (!nextVideo) break;

      nextVideo.status = 'starting';
      nextVideo.progress = 0;
      nextVideo.isStalled = false;
      videos++;
      this.startUpload(nextVideo);
    }

    while (images < MAX_IMAGE_UPLOADS) {
      const nextImage = this.queue.find((item) => item.status === 'queued' && item.type === 'photo');
      if (!nextImage) break;

      nextImage.status = 'starting';
      nextImage.progress = 0;
      nextImage.isStalled = false;
      images++;
      this.startUpload(nextImage);
    }

    this.notify(false);
  }

  private clearWatchdog(id: string) {
    const existing = this.watchdogMap.get(id);
    if (existing) {
      clearInterval(existing);
      this.watchdogMap.delete(id);
    }
  }

  private async startUpload(item: UploadItem) {
    const uniqueId = item.id;

    // 1. Session verification check
    const isSessionActive = await checkAdminSession();
    if (!isSessionActive) {
      item.status = 'failed';
      item.error = 'Sync Failed: Admin session expired. Please sign in again.';
      this.notify(true);
      this.processQueue();
      return;
    }

    // 2. Setup Watchdog for UI stall indicator during large file preparation
    let lastBytes = 0;
    let lastProgressTime = Date.now();

    const watchdog = setInterval(() => {
      const timeSinceProgress = Date.now() - lastProgressTime;
      if (timeSinceProgress > 15000 && item.status === 'uploading') {
        item.isStalled = true;
        this.notify(true);
      }
    }, 4000);

    this.watchdogMap.set(uniqueId, watchdog);

    try {
      item.status = 'uploading';
      item.retryAttempt = undefined;
      this.notify(true);

      // 3. Upload file to Supabase Storage (with hard timeout & 3 retries)
      const uploadResult = await uploadMediaFileToCloud(
        uniqueId,
        item.file,
        item.type,
        ({ bytesTransferred, totalBytes, progress }) => {
          if (item.status === ('cancelled' as any)) return;
          item.bytesTransferred = bytesTransferred;
          item.totalBytes = totalBytes;
          if (bytesTransferred > lastBytes) {
            lastBytes = bytesTransferred;
            lastProgressTime = Date.now();
            item.isStalled = false;
          }
          if (item.status !== 'retrying') {
            item.status = 'uploading';
          }
          item.progress = Math.min(92, progress);
          this.notify(false);
        },
        (attempt) => {
          if (item.status === ('cancelled' as any)) return;
          item.status = 'retrying';
          item.retryAttempt = attempt;
          item.isStalled = false;
          lastProgressTime = Date.now();
          this.notify(true);
        },
        (cancelFn) => {
          this.cancelMap.set(uniqueId, cancelFn);
        }
      );

      if (item.status === ('cancelled' as any)) {
        return;
      }

      // 4. Write authoritative record to Supabase PostgreSQL (10s timeout + max 3 attempts)
      item.status = 'syncing';
      item.retryAttempt = undefined;
      item.progress = 95;
      this.notify(true);

      const memoryDateObj = item.memoryDate ? new Date(item.memoryDate) : new Date();
      const cleanDefaultTitle = item.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');

      const memoryPayload: Partial<Memory> = {
        type: item.type,
        title: (item.title || cleanDefaultTitle).slice(0, 150),
        caption: (item.caption || '').slice(0, 1000),
        albumId: item.albumId || null,
        mediaUrl: uploadResult.mediaUrl,
        storagePath: uploadResult.storagePath,
        thumbnailUrl: uploadResult.thumbnailUrl,
        posterUrl: uploadResult.posterUrl,
        fileName: item.name.slice(0, 255),
        fileSize: item.size,
        mimeType: uploadResult.mimeType,
        memoryDate: memoryDateObj,
        published: true,
        sortOrder: Date.now(),
      };

      await saveMemoryDocument(uniqueId, memoryPayload, {
        timeoutMs: 10_000,
        maxAttempts: 3,
        isCancelled: () => item.status === ('cancelled' as any),
        onRetry: (attempt) => {
          if (item.status === ('cancelled' as any)) return;
          item.status = 'retrying';
          item.retryAttempt = attempt;
          this.notify(true);
        },
      });

      // 5. Mark Completed ONLY after Supabase confirms the database write succeeded
      item.storagePath = uploadResult.storagePath;
      item.recordId = uniqueId;
      item.retryAttempt = undefined;
      item.error = undefined;
      item.progress = 100;
      item.bytesTransferred = item.size;
      item.status = 'completed';
    } catch (err: any) {
      if (err?.message === 'UPLOAD_CANCELLED' || item.status === ('cancelled' as any)) {
        item.status = 'cancelled';
        item.retryAttempt = undefined;
        item.error = undefined;
      } else {
        item.status = 'failed';
        item.retryAttempt = undefined;
        item.error = formatSupabaseErrorMessage(err);
      }
    } finally {
      this.clearWatchdog(uniqueId);
      this.cancelMap.delete(uniqueId);
      this.notify(true);
      this.processQueue();
    }
  }

  public async deleteMemoryWithFiles(
    memory: Memory
  ): Promise<{ success: boolean; storageWarning?: boolean }> {
    return deleteCloudMediaFiles(memory.storagePath, memory.id);
  }
}

export const uploadManager = new UploadManager();
