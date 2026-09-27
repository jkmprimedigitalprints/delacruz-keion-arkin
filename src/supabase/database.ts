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

export const SUPABASE_WRITE_TIMEOUT_MS = 10_000; // 10 seconds hard timeout per attempt
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
on conflict (id) do nothing;

alter table public.albums enable row level security;
alter table public.memories enable row level security;
alter table public.baby_settings enable row level security;

drop policy if exists "Allow public read access on albums" on public.albums;
create policy "Allow public read access on albums" on public.albums for select to anon, authenticated using (true);
drop policy if exists "Allow family admin write access on albums" on public.albums;
create policy "Allow family admin write access on albums" on public.albums for all to anon, authenticated using (true) with check (true);

drop policy if exists "Allow public read access on memories" on public.memories;
create policy "Allow public read access on memories" on public.memories for select to anon, authenticated using (true);
drop policy if exists "Allow family admin write access on memories" on public.memories;
create policy "Allow family admin write access on memories" on public.memories for all to anon, authenticated using (true) with check (true);

drop policy if exists "Allow public read access on baby_settings" on public.baby_settings;
create policy "Allow public read access on baby_settings" on public.baby_settings for select to anon, authenticated using (true);
drop policy if exists "Allow family admin write access on baby_settings" on public.baby_settings;
create policy "Allow family admin write access on baby_settings" on public.baby_settings for all to anon, authenticated using (true) with check (true);

alter table public.albums replica identity full;
alter table public.memories replica identity full;
alter table public.baby_settings replica identity full;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'albums') then
    alter publication supabase_realtime add table public.albums;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'memories') then
    alter publication supabase_realtime add table public.memories;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'baby_settings') then
    alter publication supabase_realtime add table public.baby_settings;
  end if;
end $$;

insert into storage.buckets (id, name, public)
values ('media', 'media', true), ('memories', 'memories', true)
on conflict (id) do update set public = true;

drop policy if exists "Public read access for media buckets" on storage.objects;
create policy "Public read access for media buckets" on storage.objects for select to anon, authenticated using (bucket_id in ('media', 'memories'));
drop policy if exists "Family admin upload access for media buckets" on storage.objects;
create policy "Family admin upload access for media buckets" on storage.objects for insert to anon, authenticated with check (bucket_id in ('media', 'memories'));
drop policy if exists "Family admin update access for media buckets" on storage.objects;
create policy "Family admin update access for media buckets" on storage.objects for update to anon, authenticated using (bucket_id in ('media', 'memories')) with check (bucket_id in ('media', 'memories'));
drop policy if exists "Family admin delete access for media buckets" on storage.objects;
create policy "Family admin delete access for media buckets" on storage.objects for delete to anon, authenticated using (bucket_id in ('media', 'memories'));

notify pgrst, 'reload schema';`;

export interface MemoriesListenerCallbacks {
  onInitialLoad?: (memories: Memory[]) => void;
  onAdded?: (memory: Memory, isInitial: boolean) => void;
  onModified?: (memory: Memory) => void;
  onRemoved?: (memoryId: string) => void;
  onError?: (error: Error) => void;
}

export interface RetryOptions {
  timeoutMs?: number;
  maxAttempts?: number;
  onRetry?: (attempt: number, maxAttempts: number, err: Error) => void;
  isCancelled?: () => boolean;
}

// ============================================================================
// Schema Provisioning Status & Fallback Store (Before SQL Script is Executed)
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

// IndexedDB + Server API Fallback Store so uploads/edits never fail if tables are not yet created
const IDB_NAME = 'keion_supabase_fallback_v1';
const IDB_STORE = 'kv';

function openFallbackIdb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openFallbackIdb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbSet<T>(key: string, value: T): Promise<void> {
  const db = await openFallbackIdb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

interface FallbackDatabaseState {
  memories: Record<string, Record<string, any>>;
  albums: Record<string, Record<string, any>>;
  baby_settings: Record<string, any> | null;
}

async function loadFallbackDatabaseState(): Promise<FallbackDatabaseState> {
  const localState = (await idbGet<FallbackDatabaseState>('db_state')) || {
    memories: {},
    albums: {},
    baby_settings: null,
  };

  try {
    const res = await fetch('/api/db');
    if (res.ok) {
      const serverState = await res.json();
      const merged: FallbackDatabaseState = {
        memories: { ...(serverState?.memories || {}), ...(localState.memories || {}) },
        albums: { ...(serverState?.albums || {}), ...(localState.albums || {}) },
        baby_settings: localState.baby_settings || serverState?.baby_settings || null,
      };
      await idbSet('db_state', merged);
      return merged;
    }
  } catch {}

  return localState;
}

async function saveFallbackDatabaseEntry(
  table: 'memories' | 'albums' | 'baby_settings',
  action: 'upsert' | 'delete',
  row?: Record<string, any>,
  id?: string
): Promise<void> {
  const current = (await idbGet<FallbackDatabaseState>('db_state')) || {
    memories: {},
    albums: {},
    baby_settings: null,
  };

  if (table === 'memories') {
    if (action === 'delete' && id) {
      delete current.memories[id];
    } else if (row && row.id) {
      current.memories[row.id] = { ...(current.memories[row.id] || {}), ...row };
    }
  } else if (table === 'albums') {
    if (action === 'delete' && id) {
      delete current.albums[id];
    } else if (row && row.id) {
      current.albums[row.id] = { ...(current.albums[row.id] || {}), ...row };
    }
  } else if (table === 'baby_settings' && row) {
    current.baby_settings = { ...(current.baby_settings || {}), ...row };
  }

  await idbSet('db_state', current);

  try {
    await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table, action, row, id }),
    });
  } catch {}
}

/**
 * When Supabase PostgreSQL tables become available after running supabase/schema.sql,
 * automatically sync any fallback rows into Supabase PostgreSQL.
 */
let isAutoSyncingFallback = false;
async function syncFallbackRecordsToSupabase(): Promise<void> {
  if (isAutoSyncingFallback || !isSupabaseConfigured) return;
  isAutoSyncingFallback = true;

  try {
    const state = await idbGet<FallbackDatabaseState>('db_state');
    if (!state) return;

    const albumRows = Object.values(state.albums || {});
    if (albumRows.length > 0) {
      const { error } = await supabase.from(ALBUMS_TABLE).upsert(albumRows, { onConflict: 'id' });
      if (!error) {
        state.albums = {};
      }
    }

    const memoryRows = Object.values(state.memories || {});
    if (memoryRows.length > 0) {
      const { error } = await supabase
        .from(MEMORIES_TABLE)
        .upsert(memoryRows, { onConflict: 'id' });
      if (!error) {
        state.memories = {};
      }
    }

    if (state.baby_settings) {
      const { error } = await supabase
        .from(SETTINGS_TABLE)
        .upsert(state.baby_settings, { onConflict: 'id' });
      if (!error) {
        state.baby_settings = null;
      }
    }

    await idbSet('db_state', state);
  } catch {
    // Ignore background migration errors
  } finally {
    isAutoSyncingFallback = false;
  }
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
  const err = error as { code?: string };
  const code = String(err?.code || '').toLowerCase();
  const msg = extractSupabaseErrorMessage(error);
  const lowerMsg = msg.toLowerCase();

  if (msg.includes('SUPABASE_NOT_CONFIGURED')) {
    return 'Sync Failed: Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment variables.';
  }
  if (msg.includes('SUPABASE_TIMEOUT')) {
    return 'Sync Failed: Supabase did not respond within 10 seconds. Check your connection and click Retry.';
  }
  if (code === '42501' || lowerMsg.includes('row-level security')) {
    return 'Sync Failed: Permission denied by Supabase Row Level Security (RLS). Run supabase/schema.sql in your Supabase SQL Editor.';
  }
  if (isMissingTableOrSchemaError(error)) {
    return 'Sync Failed: Supabase tables do not exist yet. Run supabase/schema.sql in your Supabase SQL Editor.';
  }
  if (lowerMsg.includes('failed to fetch') || lowerMsg.includes('network')) {
    return 'Sync Failed: Unable to reach Supabase server. Check your internet connection and VITE_SUPABASE_URL.';
  }
  if (lowerMsg.includes('jwt') || lowerMsg.includes('invalid api key')) {
    return 'Sync Failed: Invalid VITE_SUPABASE_ANON_KEY. Check your Supabase project API keys.';
  }

  return msg.startsWith('Sync Failed:') ? msg : `Sync Failed: ${msg}`;
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
    msg.includes('the resource was not found') ||
    code === '42501' || // RLS violation
    code === '42p01' || // Undefined table
    code === 'pgrst205' || // Table not in PostgREST schema cache
    code === '23503' || // Foreign key violation
    msg.includes('row-level security') ||
    msg.includes('invalid api key')
  );
}

/**
 * Wraps a single promise with a hard timeout (default 10s).
 * Rejects with an explicit SUPABASE_TIMEOUT error if Supabase does not respond in time.
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
 * Executes an idempotent Supabase write operation with:
 * - Hard timeout per attempt (10s default)
 * - Up to 3 attempts with exponential backoff (1.5s -> 3.5s) for transient failures
 * - Immediate exit (no wasted retries) for non-retryable schema/bucket errors
 */
export async function executeSupabaseWriteWithRetry<T>(
  recordId: string,
  table: string,
  operationLabel: string,
  operationFn: () => Promise<T>,
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

    console.info(
      `[SUPABASE] write started (table: ${table}, id: ${recordId}, op: ${operationLabel}, attempt: ${attempt}/${maxAttempts})`
    );

    try {
      const result = await withHardTimeout(
        operationFn(),
        timeoutMs,
        `${operationLabel} ${table}/${recordId}`
      );
      console.info(
        `[SUPABASE] write completed (table: ${table}, id: ${recordId}, op: ${operationLabel}, attempt: ${attempt}/${maxAttempts})`
      );
      return result;
    } catch (err: any) {
      lastError = err;
      const errMsg = extractSupabaseErrorMessage(err);

      if (options.isCancelled?.() || errMsg === 'UPLOAD_CANCELLED') {
        throw new Error('UPLOAD_CANCELLED');
      }

      if (isNonRetryableSupabaseError(err)) {
        console.info(
          `[SUPABASE] non-retryable response (table: ${table}, id: ${recordId}, op: ${operationLabel}): ${errMsg}`
        );
        break;
      }

      console.warn(
        `[SUPABASE] write attempt ${attempt}/${maxAttempts} failed (table: ${table}, id: ${recordId}, op: ${operationLabel}): ${errMsg}`
      );

      if (attempt < maxAttempts) {
        const backoffMs = attempt === 1 ? 1500 : 3500 * Math.pow(1.5, attempt - 2);
        const nextAttempt = attempt + 1;
        console.info(
          `[SUPABASE] retry (table: ${table}, id: ${recordId}, attempt: ${nextAttempt}/${maxAttempts}, backoffMs: ${backoffMs})`
        );
        options.onRetry?.(nextAttempt, maxAttempts, new Error(errMsg));
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }
  }

  throw lastError;
}

// ============================================================================
// Active Listener Registry + Supabase Realtime Broadcast Channel
// ============================================================================

type MemoryEventSubscriber = (
  eventType: 'INSERT' | 'UPDATE' | 'DELETE',
  memory: Memory | null,
  deletedId?: string
) => void;
type AlbumEventSubscriber = () => void;
type SettingsEventSubscriber = (settings: BabySettings) => void;

const memoryEventSubscribers = new Set<MemoryEventSubscriber>();
const albumEventSubscribers = new Set<AlbumEventSubscriber>();
const settingsEventSubscribers = new Set<SettingsEventSubscriber>();

let broadcastChannel: ReturnType<typeof supabase.channel> | null = null;

function ensureRealtimeBroadcastChannel() {
  if (!isSupabaseConfigured || broadcastChannel) return broadcastChannel;

  broadcastChannel = supabase
    .channel('keion-live-broadcast')
    .on('broadcast', { event: 'memory_change' }, ({ payload }) => {
      if (!payload) return;
      const { eventType, memory, deletedId } = payload;
      memoryEventSubscribers.forEach((cb) => {
        try {
          cb(eventType, memory, deletedId);
        } catch {}
      });
    })
    .on('broadcast', { event: 'album_change' }, () => {
      albumEventSubscribers.forEach((cb) => {
        try {
          cb();
        } catch {}
      });
    })
    .on('broadcast', { event: 'settings_change' }, ({ payload }) => {
      if (!payload?.settings) return;
      settingsEventSubscribers.forEach((cb) => {
        try {
          cb(payload.settings);
        } catch {}
      });
    })
    .subscribe();

  return broadcastChannel;
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

  try {
    const ch = ensureRealtimeBroadcastChannel();
    ch?.send({
      type: 'broadcast',
      event: 'memory_change',
      payload: { eventType, memory, deletedId },
    }).catch(() => {});
  } catch {}
}

function broadcastConfirmedAlbumChange() {
  albumEventSubscribers.forEach((cb) => {
    try {
      cb();
    } catch {}
  });

  try {
    const ch = ensureRealtimeBroadcastChannel();
    ch?.send({
      type: 'broadcast',
      event: 'album_change',
      payload: { updatedAt: Date.now() },
    }).catch(() => {});
  } catch {}
}

function broadcastConfirmedSettingsChange(settings: BabySettings) {
  settingsEventSubscribers.forEach((cb) => {
    try {
      cb(settings);
    } catch {}
  });

  try {
    const ch = ensureRealtimeBroadcastChannel();
    ch?.send({
      type: 'broadcast',
      event: 'settings_change',
      payload: { settings },
    }).catch(() => {});
  } catch {}
}

// ============================================================================
// Realtime Subscriptions (Authoritative Supabase PostgreSQL + Realtime)
// ============================================================================

/**
 * Realtime listener for memories using Supabase PostgreSQL & `postgres_changes`.
 * Automatically receives initial rows and live INSERT / UPDATE / DELETE events across all devices.
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
  const pageSize = options.pageSize || 150;

  ensureRealtimeBroadcastChannel();

  const loadFromFallback = async () => {
    const fallbackState = await loadFallbackDatabaseState();
    if (!active) return;

    let list = Object.values(fallbackState.memories || {}).map(mapRowToMemory);
    if (!options.isAdmin) {
      list = list.filter((m) => m.published !== false);
    }
    if (options.albumId) {
      list = list.filter((m) => m.albumId === options.albumId);
    }
    if (options.type && options.type !== 'all') {
      list = list.filter((m) => m.type === options.type);
    }
    list.sort((a, b) => {
      const tA = new Date(a.memoryDate as any).getTime() || 0;
      const tB = new Date(b.memoryDate as any).getTime() || 0;
      return options.sortOrder === 'oldest' ? tA - tB : tB - tA;
    });

    callbacks.onInitialLoad?.(list.slice(0, pageSize));
  };

  if (!isSupabaseConfigured) {
    loadFromFallback();
    return () => {
      active = false;
    };
  }

  // 1. Initial fetch from Supabase PostgreSQL
  const fetchInitialMemories = async () => {
    try {
      let queryBuilder = supabase
        .from(MEMORIES_TABLE)
        .select('*')
        .order('memory_date', { ascending: options.sortOrder === 'oldest' })
        .limit(pageSize);

      if (!options.isAdmin) {
        queryBuilder = queryBuilder.eq('published', true);
      }
      if (options.albumId) {
        queryBuilder = queryBuilder.eq('album_id', options.albumId);
      }
      if (options.type && options.type !== 'all') {
        queryBuilder = queryBuilder.eq('type', options.type);
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
          console.info(
            `[SUPABASE] Table public.${MEMORIES_TABLE} not created yet. Run supabase/schema.sql in Supabase SQL Editor.`
          );
          await loadFromFallback();
          return;
        }

        console.warn(
          `[SUPABASE] Initial query note (${MEMORIES_TABLE}):`,
          extractSupabaseErrorMessage(error)
        );
        await loadFromFallback();
        return;
      }

      setSupabaseSchemaMissing(false);
      await syncFallbackRecordsToSupabase();

      const list: Memory[] = (data || []).map(mapRowToMemory);
      console.info(
        `[SUPABASE] Initial load completed (table: ${MEMORIES_TABLE}, count: ${list.length})`
      );
      callbacks.onInitialLoad?.(list);
    } catch (err: any) {
      if (!active) return;
      console.warn(
        `[SUPABASE] Initial load fallback (${MEMORIES_TABLE}):`,
        extractSupabaseErrorMessage(err)
      );
      await loadFromFallback();
    }
  };

  fetchInitialMemories();

  // 2. Handle confirmed writes in current client + Supabase Realtime events across devices
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

  // 3. Subscribe to Supabase Realtime channel for cross-device postgres_changes updates
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
        console.info(
          `[SUPABASE] realtime event received (table: ${MEMORIES_TABLE}, event: ${payload.eventType})`
        );

        if (payload.eventType === 'INSERT' && payload.new) {
          const memory = mapRowToMemory(payload.new as Record<string, any>);
          handleMemoryEvent('INSERT', memory);
        } else if (payload.eventType === 'UPDATE' && payload.new) {
          const memory = mapRowToMemory(payload.new as Record<string, any>);
          handleMemoryEvent('UPDATE', memory);
        } else if (payload.eventType === 'DELETE') {
          const oldRow = payload.old as Record<string, any> | undefined;
          if (oldRow?.id) {
            handleMemoryEvent('DELETE', null, String(oldRow.id));
          }
        }
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.info(`[SUPABASE] Realtime subscribed (${MEMORIES_TABLE})`);
      }
    });

  return () => {
    active = false;
    memoryEventSubscribers.delete(handleMemoryEvent);
    supabase.removeChannel(channel).catch(() => {});
  };
}

/**
 * Realtime listener for albums using Supabase PostgreSQL & `postgres_changes`
 */
export function listenToAlbums(
  onAlbumsUpdate: (albums: Album[]) => void,
  isAdmin = false
): () => void {
  let active = true;

  ensureRealtimeBroadcastChannel();

  const loadAlbumsFromFallback = async () => {
    const fallbackState = await loadFallbackDatabaseState();
    if (!active) return;
    let albums = Object.values(fallbackState.albums || {}).map(mapRowToAlbum);
    if (!isAdmin) {
      albums = albums.filter((a) => a.published !== false);
    }
    albums.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    onAlbumsUpdate(albums);
  };

  if (!isSupabaseConfigured) {
    loadAlbumsFromFallback();
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
          await loadAlbumsFromFallback();
          return;
        }
        console.warn(`[SUPABASE] Query note (${ALBUMS_TABLE}):`, extractSupabaseErrorMessage(error));
        await loadAlbumsFromFallback();
        return;
      }

      setSupabaseSchemaMissing(false);
      const albums = (data || []).map(mapRowToAlbum);
      albums.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      onAlbumsUpdate(albums);
    } catch (err: any) {
      if (!active) return;
      console.warn(`[SUPABASE] Albums fallback:`, extractSupabaseErrorMessage(err));
      await loadAlbumsFromFallback();
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
        console.info(
          `[SUPABASE] realtime event received (table: ${ALBUMS_TABLE}, event: ${payload.eventType})`
        );
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
 * Realtime listener for baby profile settings using Supabase PostgreSQL & `postgres_changes`
 */
export function listenToBabySettings(
  onSettingsUpdate: (settings: BabySettings) => void
): () => void {
  let active = true;

  ensureRealtimeBroadcastChannel();

  const loadSettingsFromFallback = async () => {
    const fallbackState = await loadFallbackDatabaseState();
    if (!active) return;
    if (fallbackState.baby_settings) {
      onSettingsUpdate(mapRowToBabySettings(fallbackState.baby_settings));
    } else {
      onSettingsUpdate(DEFAULT_BABY_SETTINGS);
    }
  };

  if (!isSupabaseConfigured) {
    loadSettingsFromFallback();
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
          await loadSettingsFromFallback();
          return;
        }
        console.warn(
          `[SUPABASE] Query note (${SETTINGS_TABLE}):`,
          extractSupabaseErrorMessage(error)
        );
        await loadSettingsFromFallback();
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
      console.warn(`[SUPABASE] Baby settings fallback:`, extractSupabaseErrorMessage(err));
      await loadSettingsFromFallback();
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
        console.info(
          `[SUPABASE] realtime event received (table: ${SETTINGS_TABLE}, event: ${payload.eventType})`
        );
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
// Authoritative Supabase Write Operations (Idempotent + Timeout + Retry)
// ============================================================================

/**
 * Save memory to Supabase PostgreSQL (`memories` table).
 * Idempotent via deterministic `memoryId` (`upsert` on primary key `id`).
 * Properly awaits Supabase confirmation with 10s hard timeout & 3 retry attempts.
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

  const dbRow = {
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
    sort_order: memoryData.sortOrder ?? Date.now(),
    published: memoryData.published ?? true,
    created_at: nowIso,
    updated_at: nowIso,
  };

  try {
    const savedMemory = await executeSupabaseWriteWithRetry(
      memoryId,
      MEMORIES_TABLE,
      'UPSERT',
      async () => {
        const { data, error } = await supabase
          .from(MEMORIES_TABLE)
          .upsert(dbRow, { onConflict: 'id' })
          .select('*')
          .single();

        if (error) {
          throw error;
        }
        return mapRowToMemory(data || dbRow);
      },
      retryOptions
    );

    setSupabaseSchemaMissing(false);
    broadcastConfirmedMemoryChange('INSERT', savedMemory);
    return savedMemory;
  } catch (err: any) {
    if (isMissingTableOrSchemaError(err)) {
      setSupabaseSchemaMissing(true);
      await saveFallbackDatabaseEntry('memories', 'upsert', dbRow, memoryId);
      const fallbackMemory = mapRowToMemory(dbRow);
      broadcastConfirmedMemoryChange('INSERT', fallbackMemory);
      return fallbackMemory;
    }
    throw new Error(formatSupabaseErrorMessage(err));
  }
}

/**
 * Update memory record in Supabase PostgreSQL (`memories` table)
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
          throw error;
        }
        return mapRowToMemory(data);
      }
    );

    broadcastConfirmedMemoryChange('UPDATE', updatedMemory);
  } catch (err: any) {
    if (isMissingTableOrSchemaError(err)) {
      setSupabaseSchemaMissing(true);
      const state = await loadFallbackDatabaseState();
      const existing = state.memories[memoryId] || { id: memoryId };
      const merged = { ...existing, ...updateRow, id: memoryId };
      await saveFallbackDatabaseEntry('memories', 'upsert', merged, memoryId);
      broadcastConfirmedMemoryChange('UPDATE', mapRowToMemory(merged));
      return;
    }
    throw new Error(formatSupabaseErrorMessage(err));
  }
}

/**
 * Delete memory record from Supabase PostgreSQL (`memories` table)
 */
export async function deleteMemoryDocument(memoryId: string): Promise<void> {
  try {
    await executeSupabaseWriteWithRetry(memoryId, MEMORIES_TABLE, 'DELETE', async () => {
      const { error } = await supabase.from(MEMORIES_TABLE).delete().eq('id', memoryId);
      if (error) {
        throw error;
      }
    });

    broadcastConfirmedMemoryChange('DELETE', null, memoryId);
  } catch (err: any) {
    if (isMissingTableOrSchemaError(err)) {
      setSupabaseSchemaMissing(true);
      await saveFallbackDatabaseEntry('memories', 'delete', undefined, memoryId);
      broadcastConfirmedMemoryChange('DELETE', null, memoryId);
      return;
    }
    throw new Error(formatSupabaseErrorMessage(err));
  }
}

/**
 * Save / Create Album in Supabase PostgreSQL (`albums` table)
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
        throw error;
      }
    });

    broadcastConfirmedAlbumChange();
  } catch (err: any) {
    if (isMissingTableOrSchemaError(err)) {
      setSupabaseSchemaMissing(true);
      await saveFallbackDatabaseEntry('albums', 'upsert', dbRow, albumId);
      broadcastConfirmedAlbumChange();
      return;
    }
    throw new Error(formatSupabaseErrorMessage(err));
  }
}

/**
 * Update Album in Supabase PostgreSQL (`albums` table)
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
        throw error;
      }
    });

    broadcastConfirmedAlbumChange();
  } catch (err: any) {
    if (isMissingTableOrSchemaError(err)) {
      setSupabaseSchemaMissing(true);
      const state = await loadFallbackDatabaseState();
      const existing = state.albums[albumId] || { id: albumId };
      const merged = { ...existing, ...updateRow, id: albumId };
      await saveFallbackDatabaseEntry('albums', 'upsert', merged, albumId);
      broadcastConfirmedAlbumChange();
      return;
    }
    throw new Error(formatSupabaseErrorMessage(err));
  }
}

/**
 * Delete Album from Supabase PostgreSQL (`albums` table)
 */
export async function deleteAlbumDocument(albumId: string): Promise<void> {
  try {
    await executeSupabaseWriteWithRetry(albumId, ALBUMS_TABLE, 'DELETE', async () => {
      await supabase.from(MEMORIES_TABLE).update({ album_id: null }).eq('album_id', albumId);

      const { error } = await supabase.from(ALBUMS_TABLE).delete().eq('id', albumId);
      if (error) {
        throw error;
      }
    });

    broadcastConfirmedAlbumChange();
  } catch (err: any) {
    if (isMissingTableOrSchemaError(err)) {
      setSupabaseSchemaMissing(true);
      await saveFallbackDatabaseEntry('albums', 'delete', undefined, albumId);
      broadcastConfirmedAlbumChange();
      return;
    }
    throw new Error(formatSupabaseErrorMessage(err));
  }
}

/**
 * Save Baby Profile Settings in Supabase PostgreSQL (`baby_settings` table)
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
          throw error;
        }
        return mapRowToBabySettings(data || dbRow);
      }
    );

    broadcastConfirmedSettingsChange(savedSettings);
  } catch (err: any) {
    if (isMissingTableOrSchemaError(err)) {
      setSupabaseSchemaMissing(true);
      await saveFallbackDatabaseEntry('baby_settings', 'upsert', dbRow, BABY_PROFILE_ID);
      broadcastConfirmedSettingsChange(mapRowToBabySettings(dbRow));
      return;
    }
    throw new Error(formatSupabaseErrorMessage(err));
  }
}
