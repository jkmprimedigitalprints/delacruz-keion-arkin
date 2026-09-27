# Little Keion - Baby Boy Memory Album

A fast, realtime baby boy memory album web application with instant multi-device synchronization powered by **Supabase PostgreSQL**, **Supabase Realtime**, and **Supabase Storage**.

---

## 1. Supabase Configuration

The centralized Supabase client is initialized in `src/supabase/client.ts` using `@supabase/supabase-js` and environment variables:

```env
VITE_SUPABASE_URL="https://your-project-id.supabase.co"
VITE_SUPABASE_ANON_KEY="your-supabase-anon-public-key"
VITE_SUPABASE_STORAGE_BUCKET="memories"
VITE_ADMIN_PIN="120825"
ADMIN_PIN="120825"
SESSION_SECRET="baby-boy-memory-album-sec-key-2026"
```

> **Security Note:** Never expose a Supabase `service_role` key in frontend code. Always use the public `anon` key (`VITE_SUPABASE_ANON_KEY`) with Row Level Security (RLS) policies.

---

## 2. Supabase Database & Storage Setup (`supabase/schema.sql`)

Open your [Supabase Dashboard](https://supabase.com/dashboard) → **SQL Editor**, paste the contents of [`supabase/schema.sql`](./supabase/schema.sql), and click **Run**.

This script automatically creates and configures:
1. **`public.albums`** — Curated milestone & monthly chapters.
2. **`public.memories`** — Photos and videos with metadata, captions, dates, and storage paths.
3. **`public.baby_settings`** — Hero profile settings (`KEION ARKIN DE LA CRUZ`, birth date `2025-10-12`, quotes, cover photo).
4. **Row Level Security (RLS) Policies** — Public read access and Family Admin write access.
5. **Supabase Realtime Publication (`supabase_realtime`)** — Live `INSERT`, `UPDATE`, and `DELETE` events across all connected browsers and devices.
6. **Supabase Storage Bucket (`memories`)** — Public media bucket with upload/update/delete storage policies.

---

## 3. Family Admin PIN Authentication

- **Family Admin PIN:** `120825` (6 digits)
- **Route:** `/familyadmin`
- Supports both instant client verification (`VITE_ADMIN_PIN`) and Vercel Serverless verification (`/api/admin/verify-pin`).

---

## 4. Vercel Production Deployment

1. Import the repository into Vercel.
2. Add the following **Environment Variables** in **Vercel Project Settings → Environment Variables**:
   - `VITE_SUPABASE_URL` = `https://<your-project-ref>.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `<your-supabase-anon-key>`
   - `VITE_SUPABASE_STORAGE_BUCKET` = `memories`
   - `VITE_ADMIN_PIN` = `120825`
   - `ADMIN_PIN` = `120825`
   - `SESSION_SECRET` = `baby-boy-memory-album-sec-key-2026`
3. Deploy (`npm run build`).
