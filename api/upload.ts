import {
  supabase,
  isSupabaseConfigured,
  assertSupabaseConfigured,
  extractSupabaseErrorMessage,
} from './client';
import { Album, Memory, BabySettings } from '../types';

const MEMORIES_TABLE = 'memories';
const ALBUMS_TABLE = 'albums';
const SETTINGS_TABLE = 'baby_settings';
const BABY_PROFILE_ID = 'babyProfile';

export const SUPABASE_WRITE_TIMEOUT_MS = 15_000; // 15 seconds hard timeout per DB attempt
export const MAX_SUPABASE_RETRIES = 3;

export const DEFAULT_BABY_SETTINGS: BabySettings = {
  babyName: 'KEION ARKIN DE LA CRUZ',
  birthDate: '2025-10-12',
  heroQuote: 'Little moments, Big memories',
  heroSubtitle:
    'Every little smile, crawl, and giggle becomes a treasure worth keeping forever.',
  coverPhotoUrl: null,
};

export const SUPABASE_SETUP_SQL = `-- Run this in your Supabase SQL Editor to create all tables, RLS policies, Realtime, and Storage buckets
create table if not exists public.albums (
  id text primary key,
  name text not null,
  description text not null default '',
  cover_url text,
  sort_order integer not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_albums_sort_order on public.albums (sort_order asc);

create table if not exists public.memories (
  id text primary key,
  type text not null default 'photo' check (type in ('photo', 'video')),
  title text not null default '',
  caption text not null default '',
  album_id text references public.albums(id) on delete set null,
  media_url text not null,
  storage_path text not null default '',
  thumbnail_url text,
  poster_url text,
  file_name text not null default 'file',
  file_size bigint not null default 0,
  mime_type text not null default 'image/jpeg',
  memory_date timestamptz not null default now(),
  sort_order bigint not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_memories_album_id on public.memories (album_id);
create index if not exists idx_memories_memory_date on public.memories (memory_date desc);
create index if not exists idx_memories_sort_order on public.memories (sort_order desc);

create table if not exists public.baby_settings (
  id text primary key default 'babyProfile',
  baby_name text not null default 'KEION ARKIN DE LA CRUZ',
  birth_date text not null default '2025-10-12',
  hero_quote text not null default 'Little moments, Big memories',
  hero_subtitle text not null default 'Every little smile, crawl, and giggle becomes a treasure worth keeping forever.',
  cover_photo_url text,
  updated_at timestamptz not null default now()
);

insert into public.baby_settings (id, baby_name, birth_date, hero_quote, hero_subtitle, cover_photo_url)
values ('babyProfile', 'KEION ARKIN DE LA CRUZ', '2025-10-12', 'Little moments, Big memories', 'Every little smile, crawl, and giggle becomes a treasure worth keeping forever.', null)
on conflict (id) do nothing;`;

export interface MemoriesListenerCallbacks {
  onInitialLoad?: (memories: Memory[]) => void;
  onAdded?: (memory: Memory, isInitial: boolean) => void;
  onModified?: (memory: Memory) => void;
  onRemoved?: (memoryId: string) => void;
  onError?: (error: Error) => void;
}

export interface MemoryStatistics {
  totalMemories: number;
  totalPhotos: number;
  totalVideos: number;
  totalAlbums: number;
  latestMemory: Memory | null;
}

export interface RetryOptions {
  timeoutMs?: number;
  maxAttempts?: number;
  onRetry?: (attempt: number, maxAttempts: number, err: Error) => void;
  isCancelled?: () => boolean;
}

// ============================================================================
// Schema Provisioning Status
// ============================================================================

let supabaseSchemaMissing = false;
const schemaStatusSubscribers = new Set<(missing: boolean) => void>();

function setSupabaseSchemaMissing(missing: boolean) {
  if (supabaseSchemaMissing !== missing) {
    supabaseSchemaMissing = missing;
    schemaStatusSubscribers.forEach((cb) => {
      try {
        cb(missing);
      } catch {}
    });
  }
}

export function subscribeToSupabaseSchemaStatus(
  cb: (missing: boolean) => void
): () => void {
  schemaStatusSubscribers.add(cb);
  cb(supabaseSchemaMissing);
  return () => {
    schemaStatusSubscribers.delete(cb);
  };
}

export function isMissingTableOrSchemaError(error: unknown): boolean {
  const err = error as { code?: string; message?: string };
  const code = String(err?.code || '').toLowerCase();
  const msg = extractSupabaseErrorMessage(error).toLowerCase();

  return (
    code === 'pgrst205' ||
    code === '42p01' ||
    msg.includes('schema cache') ||
    msg.includes('could not find the table') ||
    (msg.includes('relation') && msg.includes('does not exist'))
  );
}

export function logSupabaseDatabaseError(context: string, error: unknown): void {
  const err = error as {
    message?: string;
    details?: string | null;
    hint?: string | null;
    code?: string;
  };
  console.warn(context, {
    message: err?.message || extractSupabaseErrorMessage(error),
    details: err?.details ?? null,
    hint: err?.hint ?? null,
    code: err?.code ?? null,
  });
}

// ============================================================================
// Row <-> Domain Model Mappers (PostgreSQL snake_case <-> TypeScript camelCase)
// ============================================================================

export function mapRowToMemory(row: Record<string, any>): Memory {
  return {
    id: String(row.id),
    type: row.type === 'video' ? 'video' : 'photo',
    title: row.title ?? '',
    caption: row.caption ?? '',
    albumId: row.album_id ?? row.albumId ?? null,
    mediaUrl: row.media_url ?? row.mediaUrl ?? '',
    storagePath: row.storage_path ?? row.storagePath ?? '',
    thumbnailUrl: row.thumbnail_url ?? row.thumbnailUrl ?? null,
    posterUrl: row.poster_url ?? row.posterUrl ?? null,
    fileName: row.file_name ?? row.fileName ?? 'file',
    fileSize: Number(row.file_size ?? row.fileSize ?? 0),
    mimeType: row.mime_type ?? row.mimeType ?? 'image/jpeg',
    memoryDate: row.memory_date ?? row.memoryDate ?? row.created_at ?? new Date().toISOString(),
    createdAt: row.created_at ?? row.createdAt ?? null,
    updatedAt: row.updated_at ?? row.updatedAt ?? null,
    sortOrder: Number(row.sort_order ?? row.sortOrder ?? 0),
    published: row.published !== false,
  };
}

export function mapRowToAlbum(row: Record<string, any>): Album {
  return {
    id: String(row.id),
    name: row.name ?? 'Untitled Album',
    description: row.description ?? '',
    coverUrl: row.cover_url ?? row.coverUrl ?? null,
    sortOrder: Number(row.sort_order ?? row.sortOrder ?? 0),
    published: row.published !== false,
    createdAt: row.created_at ?? row.createdAt ?? null,
    updatedAt: row.updated_at ?? row.updatedAt ?? null,
  };
}

export function mapRowToBabySettings(row: Record<string, any>): BabySettings {
  return {
    babyName: row.baby_name ?? row.babyName ?? DEFAULT_BABY_SETTINGS.babyName,
    birthDate: row.birth_date ?? row.birthDate ?? DEFAULT_BABY_SETTINGS.birthDate,
    heroQuote: row.hero_quote ?? row.heroQuote ?? DEFAULT_BABY_SETTINGS.heroQuote,
    heroSubtitle: row.hero_subtitle ?? row.heroSubtitle ?? DEFAULT_BABY_SETTINGS.heroSubtitle,
    coverPhotoUrl: row.cover_photo_url ?? row.coverPhotoUrl ?? null,
    updatedAt: row.updated_at ?? row.updatedAt ?? null,
  };
}

// ============================================================================
// Error Classification, Hard Timeout & Retry Engine
// ============================================================================

export function formatSupabaseErrorMessage(error: unknown): string {
  const err = error as {
    message?: string;
    details?: string | null;
    hint?: string | null;
    code?: string;
  };
  const code = String(err?.code || '').trim();
  const msg = extractSupabaseErrorMessage(error);
  const details = typeof err?.details === 'string' && err.details.trim() ? err.details.trim() : '';
  const hint = typeof err?.hint === 'string' && err.hint.trim() ? err.hint.trim() : '';
  const lowerMsg = msg.toLowerCase();

  const extraParts: string[] = [];
  if (code) extraParts.push(`code: ${code}`);
  if (details) extraParts.push(`details: ${details}`);
  if (hint) extraParts.push(`hint: ${hint}`);
  const suffix = extraParts.length > 0 ? ` (${extraParts.join(' | ')})` : '';

  if (msg.includes('SUPABASE_NOT_CONFIGURED')) {
    return 'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment variables.';
  }
  if (msg.includes('SUPABASE_TIMEOUT')) {
    return 'Supabase did not respond in time. Check your connection and click Retry.';
  }
  if (code.toLowerCase() === '42501' || lowerMsg.includes('row-level security')) {
    return `Permission denied by Supabase Row Level Security: ${msg}${suffix}`;
  }
  if (isMissingTableOrSchemaError(error)) {
    return `Table not found in Supabase: ${msg}${suffix}`;
  }
  if (lowerMsg.includes('failed to fetch') || lowerMsg.includes('network')) {
    return 'Unable to reach Supabase server. Check your internet connection.';
  }
  if (lowerMsg.includes('jwt') || lowerMsg.includes('invalid api key')) {
    return 'Invalid Supabase API key. Check VITE_SUPABASE_ANON_KEY.';
  }

  return `${msg}${suffix}`;
}

function isNonRetryableSupabaseError(error: unknown): boolean {
  const err = error as { code?: string };
  const code = String(err?.code || '').toLowerCase();
  const msg = extractSupabaseErrorMessage(error).toLowerCase();

  return (
    isMissingTableOrSchemaError(error) ||
    msg.includes('supabase_not_configured') ||
    msg.includes('upload_cancelled') ||
    msg.includes('bucket not found') ||
    code === '42501' || // RLS violation
    code === '42p01' || // Undefined table
    code === 'pgrst205' || // Table not in PostgREST schema cache
    code === '23503' || // Foreign key violation
    msg.includes('row-level security') ||
    msg.includes('invalid api key')
  );
}

/**
 * Wraps a single promise with a hard timeout.
 */
export function withHardTimeout<T>(
  promiseLike: PromiseLike<T>,
  timeoutMs: number,
  label: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`SUPABASE_TIMEOUT: ${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([Promise.resolve(promiseLike), timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/**
 * Executes an idempotent Supabase write operation with hard timeout & up to 3 attempts
 */
export async function executeSupabaseWriteWithRetry<T>(
  recordId: string,
  table: string,
  operationLabel: string,
  operationFn: (attempt: number) => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  assertSupabaseConfigured();

  const timeoutMs = options.timeoutMs ?? SUPABASE_WRITE_TIMEOUT_MS;
  const maxAttempts = options.maxAttempts ?? MAX_SUPABASE_RETRIES;

  let lastError: unknown = new Error('Supabase write failed');

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (options.isCancelled?.()) {
      throw new Error('UPLOAD_CANCELLED');
    }

    try {
      const result = await withHardTimeout(
        operationFn(attempt),
        timeoutMs,
        `${operationLabel} ${table}/${recordId}`
      );
      return result;
    } catch (err: any) {
      lastError = err;
      const errMsg = extractSupabaseErrorMessage(err);

      if (options.isCancelled?.() || errMsg === 'UPLOAD_CANCELLED') {
        throw new Error('UPLOAD_CANCELLED');
      }

      if (isNonRetryableSupabaseError(err)) {
        break;
      }

      if (attempt < maxAttempts) {
        const backoffMs = attempt === 1 ? 1500 : 3500 * Math.pow(1.5, attempt - 2);
        const nextAttempt = attempt + 1;
        console.warn(
          `[SUPABASE] Retry scheduled (table: ${table}, id: ${recordId}, attempt: ${nextAttempt}/${maxAttempts}, backoffMs: ${backoffMs})`
        );
        options.onRetry?.(nextAttempt, maxAttempts, new Error(errMsg));
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }
  }

  throw lastError;
}

// ============================================================================
// Active Listener Registry for Confirmed Database Writes + Realtime
// ============================================================================

type MemoryEventSubscriber = (
  eventType: 'INSERT' | 'UPDATE' | 'DELETE',
  memory: Memory | null,
  deletedId?: string
) => void;
type AlbumEventSubscriber = () => void;
type SettingsEventSubscriber = (settings: BabySettings) => void;
type StatisticsEventSubscriber = () => void;

const memoryEventSubscribers = new Set<MemoryEventSubscriber>();
const albumEventSubscribers = new Set<AlbumEventSubscriber>();
const settingsEventSubscribers = new Set<SettingsEventSubscriber>();
const statisticsEventSubscribers = new Set<StatisticsEventSubscriber>();

function notifyStatisticsRefresh() {
  statisticsEventSubscribers.forEach((cb) => {
    try {
      cb();
    } catch {}
  });
}

function broadcastConfirmedMemoryChange(
  eventType: 'INSERT' | 'UPDATE' | 'DELETE',
  memory: Memory | null,
  deletedId?: string
) {
  memoryEventSubscribers.forEach((cb) => {
    try {
      cb(eventType, memory, deletedId);
    } catch {}
  });
  notifyStatisticsRefresh();
}

function broadcastConfirmedAlbumChange() {
  albumEventSubscribers.forEach((cb) => {
    try {
      cb();
    } catch {}
  });
  notifyStatisticsRefresh();
}

function broadcastConfirmedSettingsChange(settings: BabySettings) {
  settingsEventSubscribers.forEach((cb) => {
    try {
      cb(settings);
    } catch {}
  });
}

// ============================================================================
// Authoritative Database Statistics (`public.memories` & `public.albums`)
// ============================================================================

/**
 * Queries exact COUNT(*) statistics directly from `public.memories` and `public.albums`
 * in Supabase PostgreSQL — never relying on paginated arrays or local caches.
 */
export async function fetchMemoryStatistics(_isAdmin = true): Promise<MemoryStatistics> {
  assertSupabaseConfigured();

  const totalQuery = supabase.from(MEMORIES_TABLE).select('*', { count: 'exact', head: true });
  const photoQuery = supabase
    .from(MEMORIES_TABLE)
    .select('*', { count: 'exact', head: true })
    .eq('type', 'photo');
  const videoQuery = supabase
    .from(MEMORIES_TABLE)
    .select('*', { count: 'exact', head: true })
    .eq('type', 'video');
  const albumQuery = supabase.from(ALBUMS_TABLE).select('*', { count: 'exact', head: true });
  const latestQuery = supabase
    .from(MEMORIES_TABLE)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const [totalRes, photoRes, videoRes, albumRes, latestRes] = await withHardTimeout(
    Promise.all([totalQuery, photoQuery, videoQuery, albumQuery, latestQuery]),
    SUPABASE_WRITE_TIMEOUT_MS,
    'COUNT public.memories statistics'
  );

  if (totalRes.error) {
    logSupabaseDatabaseError('[SUPABASE] Statistics count error (memories):', totalRes.error);
    throw totalRes.error;
  }
  if (photoRes.error) {
    logSupabaseDatabaseError('[SUPABASE] Statistics count error (photos):', photoRes.error);
    throw photoRes.error;
  }
  if (videoRes.error) {
    logSupabaseDatabaseError('[SUPABASE] Statistics count error (videos):', videoRes.error);
    throw videoRes.error;
  }
  if (albumRes.error) {
    logSupabaseDatabaseError('[SUPABASE] Statistics count error (albums):', albumRes.error);
    throw albumRes.error;
  }

  const totalPhotos = photoRes.count ?? 0;
  const totalVideos = videoRes.count ?? 0;
  const totalMemories = totalRes.count ?? totalPhotos + totalVideos;
  const totalAlbums = albumRes.count ?? 0;
  const latestMemory = latestRes.data ? mapRowToMemory(latestRes.data) : null;

  const stats: MemoryStatistics = {
    totalMemories,
    totalPhotos,
    totalVideos,
    totalAlbums,
    latestMemory,
  };

  console.log('[SUPABASE] Statistics refreshed', stats);
  return stats;
}

/**
 * Subscribes to live authoritative statistics from `public.memories` and `public.albums`.
 * Automatically refreshes on INSERT, UPDATE, and DELETE across all connected devices.
 */
export function listenToMemoryStatistics(
  onStatsUpdate: (stats: MemoryStatistics) => void,
  onError?: (error: Error) => void,
  isAdmin = true
): () => void {
  let active = true;

  const refresh = async () => {
    if (!active) return;
    if (!isSupabaseConfigured) {
      onError?.(new Error('Supabase is not configured.'));
      return;
    }

    try {
      const stats = await fetchMemoryStatistics(isAdmin);
      if (!active) return;
      setSupabaseSchemaMissing(false);
      onStatsUpdate(stats);
    } catch (err: any) {
      if (!active) return;
      if (isMissingTableOrSchemaError(err)) {
        setSupabaseSchemaMissing(true);
      }
      onError?.(new Error(formatSupabaseErrorMessage(err)));
    }
  };

  refresh();
  statisticsEventSubscribers.add(refresh);

  const channelName = `realtime:stats:${Math.random().toString(36).slice(2, 9)}`;
  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: MEMORIES_TABLE },
      () => {
        if (active) refresh();
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: ALBUMS_TABLE },
      () => {
        if (active) refresh();
      }
    )
    .subscribe();

  return () => {
    active = false;
    statisticsEventSubscribers.delete(refresh);
    supabase.removeChannel(channel).catch(() => {});
  };
}

// ============================================================================
// Realtime Subscriptions (Authoritative Supabase PostgreSQL + Realtime)
// ============================================================================

/**
 * Fetches all memories directly from `public.memories` and subscribes to
 * Supabase Realtime `postgres_changes` (INSERT, UPDATE, DELETE).
 */
export function listenToMemories(
  callbacks: MemoriesListenerCallbacks,
  options: {
    albumId?: string | null;
    type?: 'photo' | 'video' | 'all';
    pageSize?: number;
    sortOrder?: 'newest' | 'oldest';
    isAdmin?: boolean;
  } = {}
): () => void {
  let active = true;

  if (!isSupabaseConfigured) {
    callbacks.onInitialLoad?.([]);
    return () => {
      active = false;
    };
  }

  // 1. Initial read directly from `public.memories` (loads all records without artificial 100-item cap)
  const fetchInitialMemories = async () => {
    try {
      console.log('[SUPABASE] Loading memories');
      const ascending = options.sortOrder === 'oldest';

      let queryBuilder = supabase
        .from(MEMORIES_TABLE)
        .select('*')
        .order('memory_date', { ascending })
        .order('created_at', { ascending });

      if (!options.isAdmin) {
        queryBuilder = queryBuilder.neq('published', false);
      }
      if (options.albumId) {
        queryBuilder = queryBuilder.eq('album_id', options.albumId);
      }
      if (options.type && options.type !== 'all') {
        queryBuilder = queryBuilder.eq('type', options.type);
      }
      if (options.pageSize && options.pageSize > 0) {
        queryBuilder = queryBuilder.limit(options.pageSize);
      } else {
        queryBuilder = queryBuilder.limit(10000);
      }

      const { data, error } = await withHardTimeout(
        queryBuilder,
        SUPABASE_WRITE_TIMEOUT_MS,
        `SELECT ${MEMORIES_TABLE}`
      );

      if (!active) return;

      if (error) {
        if (isMissingTableOrSchemaError(error)) {
          setSupabaseSchemaMissing(true);
        }
        logSupabaseDatabaseError(`[SUPABASE] Initial query error (${MEMORIES_TABLE}):`, error);
        callbacks.onInitialLoad?.([]);
        callbacks.onError?.(new Error(formatSupabaseErrorMessage(error)));
        return;
      }

      setSupabaseSchemaMissing(false);
      const list: Memory[] = (data || []).map(mapRowToMemory);
      console.log('[SUPABASE] Memories loaded', { count: list.length });
      callbacks.onInitialLoad?.(list);
    } catch (err: any) {
      if (!active) return;
      logSupabaseDatabaseError(`[SUPABASE] Initial load failed (${MEMORIES_TABLE}):`, err);
      callbacks.onInitialLoad?.([]);
      callbacks.onError?.(err instanceof Error ? err : new Error(formatSupabaseErrorMessage(err)));
    }
  };

  fetchInitialMemories();

  // 2. Handle confirmed DB writes in current client + Supabase Realtime events across devices
  const handleMemoryEvent: MemoryEventSubscriber = (eventType, memory, deletedId) => {
    if (!active) return;

    if (eventType === 'DELETE' && deletedId) {
      callbacks.onRemoved?.(deletedId);
      return;
    }

    if (!memory) return;

    if (!options.isAdmin && memory.published === false) {
      callbacks.onRemoved?.(memory.id);
      return;
    }

    if (eventType === 'INSERT') {
      callbacks.onAdded?.(memory, false);
    } else if (eventType === 'UPDATE') {
      callbacks.onModified?.(memory);
    }
  };

  memoryEventSubscribers.add(handleMemoryEvent);

  // 3. Subscribe to Supabase Realtime channel for `public.memories` (INSERT, UPDATE, DELETE)
  const channelName = `realtime:memories:${Math.random().toString(36).slice(2, 9)}`;
  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: MEMORIES_TABLE,
      },
      (payload) => {
        if (!active) return;

        if (payload.eventType === 'INSERT' && payload.new) {
          console.log('[SUPABASE] Realtime INSERT received', {
            table: MEMORIES_TABLE,
            id: (payload.new as any)?.id,
          });
          const memory = mapRowToMemory(payload.new as Record<string, any>);
          handleMemoryEvent('INSERT', memory);
        } else if (payload.eventType === 'UPDATE' && payload.new) {
          console.log('[SUPABASE] Realtime UPDATE received', {
            table: MEMORIES_TABLE,
            id: (payload.new as any)?.id,
          });
          const memory = mapRowToMemory(payload.new as Record<string, any>);
          handleMemoryEvent('UPDATE', memory);
        } else if (payload.eventType === 'DELETE') {
          const oldRow = payload.old as Record<string, any> | undefined;
          console.log('[SUPABASE] Realtime DELETE received', {
            table: MEMORIES_TABLE,
            id: oldRow?.id,
          });
          if (oldRow?.id) {
            handleMemoryEvent('DELETE', null, String(oldRow.id));
          }
        }
      }
    )
    .subscribe();

  return () => {
    active = false;
    memoryEventSubscribers.delete(handleMemoryEvent);
    supabase.removeChannel(channel).catch(() => {});
  };
}

/**
 * Realtime listener for `public.albums` using Supabase PostgreSQL & `postgres_changes`
 */
export function listenToAlbums(
  onAlbumsUpdate: (albums: Album[]) => void,
  isAdmin = false
): () => void {
  let active = true;

  if (!isSupabaseConfigured) {
    onAlbumsUpdate([]);
    return () => {
      active = false;
    };
  }

  const fetchAlbums = async () => {
    try {
      let queryBuilder = supabase
        .from(ALBUMS_TABLE)
        .select('*')
        .order('sort_order', { ascending: true });

      if (!isAdmin) {
        queryBuilder = queryBuilder.eq('published', true);
      }

      const { data, error } = await withHardTimeout(
        queryBuilder,
        SUPABASE_WRITE_TIMEOUT_MS,
        `SELECT ${ALBUMS_TABLE}`
      );

      if (!active) return;

      if (error) {
        if (isMissingTableOrSchemaError(error)) {
          setSupabaseSchemaMissing(true);
        }
        logSupabaseDatabaseError(`[SUPABASE] Query error (${ALBUMS_TABLE}):`, error);
        onAlbumsUpdate([]);
        return;
      }

      setSupabaseSchemaMissing(false);
      const albums = (data || []).map(mapRowToAlbum);
      albums.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      onAlbumsUpdate(albums);
    } catch (err: any) {
      if (!active) return;
      logSupabaseDatabaseError(`[SUPABASE] Failed to load albums:`, err);
      onAlbumsUpdate([]);
    }
  };

  fetchAlbums();

  const handleLocalRefresh = () => {
    if (active) fetchAlbums();
  };
  albumEventSubscribers.add(handleLocalRefresh);

  const channelName = `realtime:albums:${Math.random().toString(36).slice(2, 9)}`;
  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: ALBUMS_TABLE,
      },
      (payload) => {
        if (!active) return;
        if (payload.eventType === 'INSERT') {
          console.log('[SUPABASE] Realtime INSERT received', { table: ALBUMS_TABLE });
        } else if (payload.eventType === 'UPDATE') {
          console.log('[SUPABASE] Realtime UPDATE received', { table: ALBUMS_TABLE });
        } else if (payload.eventType === 'DELETE') {
          console.log('[SUPABASE] Realtime DELETE received', { table: ALBUMS_TABLE });
        }
        fetchAlbums();
      }
    )
    .subscribe();

  return () => {
    active = false;
    albumEventSubscribers.delete(handleLocalRefresh);
    supabase.removeChannel(channel).catch(() => {});
  };
}

/**
 * Realtime listener for `public.baby_settings` using Supabase PostgreSQL & `postgres_changes`
 */
export function listenToBabySettings(
  onSettingsUpdate: (settings: BabySettings) => void
): () => void {
  let active = true;

  if (!isSupabaseConfigured) {
    onSettingsUpdate(DEFAULT_BABY_SETTINGS);
    return () => {
      active = false;
    };
  }

  const fetchSettings = async () => {
    try {
      const { data, error } = await withHardTimeout(
        supabase.from(SETTINGS_TABLE).select('*').eq('id', BABY_PROFILE_ID).maybeSingle(),
        SUPABASE_WRITE_TIMEOUT_MS,
        `SELECT ${SETTINGS_TABLE}`
      );

      if (!active) return;

      if (error) {
        if (isMissingTableOrSchemaError(error)) {
          setSupabaseSchemaMissing(true);
        }
        logSupabaseDatabaseError(`[SUPABASE] Query error (${SETTINGS_TABLE}):`, error);
        onSettingsUpdate(DEFAULT_BABY_SETTINGS);
        return;
      }

      setSupabaseSchemaMissing(false);
      if (data) {
        onSettingsUpdate(mapRowToBabySettings(data));
      } else {
        onSettingsUpdate(DEFAULT_BABY_SETTINGS);
      }
    } catch (err: any) {
      if (!active) return;
      logSupabaseDatabaseError(`[SUPABASE] Failed to load baby settings:`, err);
      onSettingsUpdate(DEFAULT_BABY_SETTINGS);
    }
  };

  fetchSettings();

  const handleSettingsBroadcast: SettingsEventSubscriber = (newSettings) => {
    if (active) {
      onSettingsUpdate(newSettings);
    }
  };
  settingsEventSubscribers.add(handleSettingsBroadcast);

  const channelName = `realtime:settings:${Math.random().toString(36).slice(2, 9)}`;
  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: SETTINGS_TABLE,
      },
      (payload) => {
        if (!active) return;
        if (payload.eventType === 'INSERT') {
          console.log('[SUPABASE] Realtime INSERT received', { table: SETTINGS_TABLE });
        } else if (payload.eventType === 'UPDATE') {
          console.log('[SUPABASE] Realtime UPDATE received', { table: SETTINGS_TABLE });
        } else if (payload.eventType === 'DELETE') {
          console.log('[SUPABASE] Realtime DELETE received', { table: SETTINGS_TABLE });
        }
        if (payload.new && Object.keys(payload.new).length > 0) {
          onSettingsUpdate(mapRowToBabySettings(payload.new as Record<string, any>));
        } else {
          fetchSettings();
        }
      }
    )
    .subscribe();

  return () => {
    active = false;
    settingsEventSubscribers.delete(handleSettingsBroadcast);
    supabase.removeChannel(channel).catch(() => {});
  };
}

// ============================================================================
// Authoritative Supabase Write Operations (`public.memories`, `public.albums`, `public.baby_settings`)
// ============================================================================

/**
 * Inserts/upserts a memory record directly into `public.memories`.
 * Never marks an upload as completed unless Supabase PostgreSQL confirms the row exists.
 * Prevents duplicate rows across retries using the deterministic `memoryId`.
 */
export async function saveMemoryDocument(
  memoryId: string,
  memoryData: Partial<Memory>,
  retryOptions?: RetryOptions
): Promise<Memory> {
  const nowIso = new Date().toISOString();
  const memoryDateIso = memoryData.memoryDate
    ? memoryData.memoryDate instanceof Date
      ? memoryData.memoryDate.toISOString()
      : new Date(memoryData.memoryDate).toISOString()
    : nowIso;
  const createdAtIso = memoryData.createdAt
    ? memoryData.createdAt instanceof Date
      ? memoryData.createdAt.toISOString()
      : new Date(memoryData.createdAt).toISOString()
    : nowIso;

  const insertPayload = {
    id: memoryId,
    type: memoryData.type || 'photo',
    title: memoryData.title || '',
    caption: memoryData.caption || '',
    album_id: memoryData.albumId || null,
    media_url: memoryData.mediaUrl || '',
    storage_path: memoryData.storagePath || '',
    thumbnail_url: memoryData.thumbnailUrl || null,
    poster_url: memoryData.posterUrl || null,
    file_name: memoryData.fileName || 'file',
    file_size: memoryData.fileSize || 0,
    mime_type: memoryData.mimeType || 'image/jpeg',
    memory_date: memoryDateIso,
    sort_order: memoryData.sortOrder || 0,
    published: memoryData.published !== false,
    created_at: createdAtIso,
    updated_at: nowIso,
  };

  try {
    const savedMemory = await executeSupabaseWriteWithRetry(
      memoryId,
      MEMORIES_TABLE,
      'INSERT',
      async (attempt) => {
        console.log('[SUPABASE] Database insert started', {
          id: insertPayload.id,
          type: insertPayload.type,
          file_name: insertPayload.file_name,
          storage_path: insertPayload.storage_path,
          attempt,
        });

        const { data, error } = await supabase
          .from(MEMORIES_TABLE)
          .insert(insertPayload)
          .select()
          .single();

        if (error) {
          // If a retry occurs for an ID that was already inserted, upsert on `id` to prevent duplicates
          if (String(error.code) === '23505') {
            const { data: upsertData, error: upsertError } = await supabase
              .from(MEMORIES_TABLE)
              .upsert(insertPayload, { onConflict: 'id' })
              .select()
              .single();

            if (upsertError) {
              logSupabaseDatabaseError('[SUPABASE] Database insert failed', upsertError);
              throw upsertError;
            }

            if (!upsertData) {
              throw new Error('Supabase did not return the saved memory record.');
            }

            console.log('[SUPABASE] Database insert completed', {
              id: upsertData.id,
              type: upsertData.type,
              media_url: upsertData.media_url,
            });
            return mapRowToMemory(upsertData);
          }

          logSupabaseDatabaseError('[SUPABASE] Database insert failed', error);
          throw error;
        }

        if (!data) {
          throw new Error('Supabase did not return the inserted memory record.');
        }

        console.log('[SUPABASE] Database insert completed', {
          id: data.id,
          type: data.type,
          media_url: data.media_url,
        });

        return mapRowToMemory(data);
      },
      retryOptions
    );

    setSupabaseSchemaMissing(false);
    broadcastConfirmedMemoryChange('INSERT', savedMemory);
    return savedMemory;
  } catch (err: any) {
    if (isMissingTableOrSchemaError(err)) {
      setSupabaseSchemaMissing(true);
    }
    throw new Error(formatSupabaseErrorMessage(err));
  }
}

/**
 * Update memory record in `public.memories`
 */
export async function updateMemoryDocument(
  memoryId: string,
  updates: Partial<Memory>
): Promise<void> {
  const nowIso = new Date().toISOString();
  const updateRow: Record<string, any> = {
    updated_at: nowIso,
  };

  if (updates.title !== undefined) updateRow.title = updates.title;
  if (updates.caption !== undefined) updateRow.caption = updates.caption;
  if (updates.albumId !== undefined) updateRow.album_id = updates.albumId || null;
  if (updates.published !== undefined) updateRow.published = updates.published;
  if (updates.sortOrder !== undefined) updateRow.sort_order = updates.sortOrder;
  if (updates.type !== undefined) updateRow.type = updates.type;
  if (updates.memoryDate !== undefined && updates.memoryDate !== null) {
    updateRow.memory_date =
      updates.memoryDate instanceof Date
        ? updates.memoryDate.toISOString()
        : new Date(updates.memoryDate).toISOString();
  }

  try {
    const updatedMemory = await executeSupabaseWriteWithRetry(
      memoryId,
      MEMORIES_TABLE,
      'UPDATE',
      async () => {
        const { data, error } = await supabase
          .from(MEMORIES_TABLE)
          .update(updateRow)
          .eq('id', memoryId)
          .select('*')
          .single();

        if (error) {
          logSupabaseDatabaseError('[SUPABASE] Memory update failed', error);
          throw error;
        }
        return mapRowToMemory(data);
      }
    );

    broadcastConfirmedMemoryChange('UPDATE', updatedMemory);
  } catch (err: any) {
    throw new Error(formatSupabaseErrorMessage(err));
  }
}

/**
 * Delete memory record from `public.memories`
 */
export async function deleteMemoryDocument(memoryId: string): Promise<void> {
  try {
    await executeSupabaseWriteWithRetry(memoryId, MEMORIES_TABLE, 'DELETE', async () => {
      const { error } = await supabase.from(MEMORIES_TABLE).delete().eq('id', memoryId);
      if (error) {
        logSupabaseDatabaseError('[SUPABASE] Memory delete failed', error);
        throw error;
      }
    });

    broadcastConfirmedMemoryChange('DELETE', null, memoryId);
  } catch (err: any) {
    throw new Error(formatSupabaseErrorMessage(err));
  }
}

/**
 * Save / Create Album in `public.albums`
 */
export async function saveAlbumDocument(
  albumId: string,
  albumData: Partial<Album>
): Promise<void> {
  const nowIso = new Date().toISOString();
  const dbRow = {
    id: albumId,
    name: albumData.name || 'New Album',
    description: albumData.description || '',
    cover_url: albumData.coverUrl || null,
    sort_order: albumData.sortOrder ?? 0,
    published: albumData.published ?? true,
    created_at: nowIso,
    updated_at: nowIso,
  };

  try {
    await executeSupabaseWriteWithRetry(albumId, ALBUMS_TABLE, 'UPSERT', async () => {
      const { error } = await supabase.from(ALBUMS_TABLE).upsert(dbRow, { onConflict: 'id' });
      if (error) {
        logSupabaseDatabaseError('[SUPABASE] Album upsert failed', error);
        throw error;
      }
    });

    broadcastConfirmedAlbumChange();
  } catch (err: any) {
    throw new Error(formatSupabaseErrorMessage(err));
  }
}

/**
 * Update Album in `public.albums`
 */
export async function updateAlbumDocument(
  albumId: string,
  updates: Partial<Album>
): Promise<void> {
  const updateRow: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.name !== undefined) updateRow.name = updates.name;
  if (updates.description !== undefined) updateRow.description = updates.description;
  if (updates.coverUrl !== undefined) updateRow.cover_url = updates.coverUrl;
  if (updates.sortOrder !== undefined) updateRow.sort_order = updates.sortOrder;
  if (updates.published !== undefined) updateRow.published = updates.published;

  try {
    await executeSupabaseWriteWithRetry(albumId, ALBUMS_TABLE, 'UPDATE', async () => {
      const { error } = await supabase.from(ALBUMS_TABLE).update(updateRow).eq('id', albumId);
      if (error) {
        logSupabaseDatabaseError('[SUPABASE] Album update failed', error);
        throw error;
      }
    });

    broadcastConfirmedAlbumChange();
  } catch (err: any) {
    throw new Error(formatSupabaseErrorMessage(err));
  }
}

/**
 * Delete Album from `public.albums`
 */
export async function deleteAlbumDocument(albumId: string): Promise<void> {
  try {
    await executeSupabaseWriteWithRetry(albumId, ALBUMS_TABLE, 'DELETE', async () => {
      await supabase.from(MEMORIES_TABLE).update({ album_id: null }).eq('album_id', albumId);

      const { error } = await supabase.from(ALBUMS_TABLE).delete().eq('id', albumId);
      if (error) {
        logSupabaseDatabaseError('[SUPABASE] Album delete failed', error);
        throw error;
      }
    });

    broadcastConfirmedAlbumChange();
  } catch (err: any) {
    throw new Error(formatSupabaseErrorMessage(err));
  }
}

/**
 * Save Baby Profile Settings in `public.baby_settings`
 */
export async function saveBabySettings(settings: Partial<BabySettings>): Promise<void> {
  const nowIso = new Date().toISOString();
  const dbRow = {
    id: BABY_PROFILE_ID,
    baby_name: settings.babyName || DEFAULT_BABY_SETTINGS.babyName,
    birth_date: settings.birthDate || DEFAULT_BABY_SETTINGS.birthDate,
    hero_quote: settings.heroQuote || DEFAULT_BABY_SETTINGS.heroQuote,
    hero_subtitle: settings.heroSubtitle || DEFAULT_BABY_SETTINGS.heroSubtitle,
    cover_photo_url: settings.coverPhotoUrl ?? null,
    updated_at: nowIso,
  };

  try {
    const savedSettings = await executeSupabaseWriteWithRetry(
      BABY_PROFILE_ID,
      SETTINGS_TABLE,
      'UPSERT',
      async () => {
        const { data, error } = await supabase
          .from(SETTINGS_TABLE)
          .upsert(dbRow, { onConflict: 'id' })
          .select('*')
          .single();

        if (error) {
          logSupabaseDatabaseError('[SUPABASE] Baby settings upsert failed', error);
          throw error;
        }
        return mapRowToBabySettings(data || dbRow);
      }
    );

    broadcastConfirmedSettingsChange(savedSettings);
  } catch (err: any) {
    throw new Error(formatSupabaseErrorMessage(err));
  }
}
