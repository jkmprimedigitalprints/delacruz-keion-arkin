export type MediaType = 'photo' | 'video';

export interface Album {
  id: string;
  name: string;
  description: string;
  coverUrl: string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  sortOrder: number;
  published: boolean;
  itemCount?: number;
}

export interface Memory {
  id: string;
  type: MediaType;
  title: string;
  caption: string;
  albumId: string | null;
  mediaUrl: string;
  storagePath: string;
  thumbnailUrl: string | null;
  posterUrl: string | null;
  fileName: string;
  fileSize: number;
  mimeType: string;
  memoryDate: Date | string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  sortOrder: number;
  published: boolean;
}

export interface BabySettings {
  babyName: string;
  birthDate: string;
  heroQuote: string;
  heroSubtitle: string;
  coverPhotoUrl: string | null;
  updatedAt?: Date | string | null;
}

export type UploadStatus =
  | 'queued'
  | 'starting'
  | 'uploading'
  | 'finalizing'
  | 'syncing'
  | 'retrying'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface UploadItem {
  id: string;
  file: File;
  name: string;
  size: number;
  type: MediaType;
  progress: number;
  bytesTransferred?: number;
  totalBytes?: number;
  status: UploadStatus;
  retryAttempt?: number;
  error?: string;
  isStalled?: boolean;
  previewUrl: string;
  storagePath?: string;
  recordId?: string;
  uploadedMedia?: {
    mediaUrl: string;
    storagePath: string;
    thumbnailUrl: string | null;
    posterUrl: string | null;
    mimeType: string;
  };
  title?: string;
  caption?: string;
  albumId?: string;
  memoryDate?: string;
  cancelTask?: () => void;
}

export interface AdminAuthState {
  isAuthenticated: boolean;
  isAdmin: boolean;
  method: 'pin' | 'google' | null;
  userEmail: string | null;
  userId: string | null;
  token: string | null;
}
