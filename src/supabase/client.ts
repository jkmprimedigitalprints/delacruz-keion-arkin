import { createClient, SupabaseClient } from '@supabase/supabase-js';

const env = (import.meta as any).env || {};

const rawSupabaseUrl = (env.VITE_SUPABASE_URL || '').trim();
const rawSupabaseAnonKey = (env.VITE_SUPABASE_ANON_KEY || '').trim();

export const SUPABASE_STORAGE_BUCKET = (env.VITE_SUPABASE_STORAGE_BUCKET || 'media').trim();

/**
 * Checks whether valid Supabase credentials have been provided via VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
 * Note: Never use or expose a service-role key in frontend code.
 */
export const isSupabaseConfigured: boolean = Boolean(
  rawSupabaseUrl &&
    rawSupabaseAnonKey &&
    rawSupabaseUrl.startsWith('http') &&
    !rawSupabaseUrl.includes('your-project-id.supabase.co') &&
    rawSupabaseAnonKey !== 'your-supabase-anon-public-key'
);

if (!isSupabaseConfigured) {
  console.info(
    '[SUPABASE] VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY are not configured yet. ' +
      'Set them in your .env file or Vercel Environment Variables to enable Supabase PostgreSQL & Storage.'
  );
}

/**
 * Extracts the Supabase project reference ID from VITE_SUPABASE_URL if present
 */
export const supabaseProjectRef: string | null = (() => {
  try {
    if (!isSupabaseConfigured) return null;
    const host = new URL(rawSupabaseUrl).hostname;
    const parts = host.split('.');
    if (parts.length >= 3 && parts[1] === 'supabase') {
      return parts[0];
    }
    return null;
  } catch {
    return null;
  }
})();

export function getSupabaseSqlEditorUrl(): string {
  if (supabaseProjectRef) {
    return `https://supabase.com/dashboard/project/${supabaseProjectRef}/sql/new`;
  }
  return 'https://supabase.com/dashboard';
}

/**
 * Safely extracts a human-readable string from any Error, PostgrestError, or StorageError object
 * so it never serializes to "[object Object]".
 */
export function extractSupabaseErrorMessage(error: unknown): string {
  if (!error) return 'Unknown Supabase error';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;

  if (typeof error === 'object') {
    const obj = error as Record<string, any>;
    if (typeof obj.message === 'string' && obj.message.trim()) {
      return obj.message;
    }
    if (typeof obj.error_description === 'string' && obj.error_description.trim()) {
      return obj.error_description;
    }
    if (typeof obj.error === 'string' && obj.error.trim()) {
      return obj.error;
    }
    if (typeof obj.details === 'string' && obj.details.trim()) {
      return obj.details;
    }
    try {
      return JSON.stringify(error);
    } catch {
      return 'Unknown Supabase error';
    }
  }

  return String(error);
}

// Safe fallback URL/key so createClient() does not crash the React bundle at import time
// before environment variables are configured. All operations check `assertSupabaseConfigured()`.
const clientUrl = isSupabaseConfigured
  ? rawSupabaseUrl
  : 'https://unconfigured-project.supabase.co';
const clientAnonKey = isSupabaseConfigured
  ? rawSupabaseAnonKey
  : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.unconfigured';

export const supabase: SupabaseClient = createClient(clientUrl, clientAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export function assertSupabaseConfigured(): void {
  if (!isSupabaseConfigured) {
    throw new Error(
      'SUPABASE_NOT_CONFIGURED: Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Please configure your Supabase environment variables.'
    );
  }
}
