-- ============================================================================
-- Little Keion Baby Boy Memory Album — Supabase PostgreSQL + Storage Schema
-- Run this entire script in the Supabase SQL Editor (https://supabase.com/dashboard)
-- ============================================================================

-- 1. ALBUMS TABLE
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

-- 2. MEMORIES TABLE
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

-- 3. BABY SETTINGS TABLE
create table if not exists public.baby_settings (
  id text primary key default 'babyProfile',
  baby_name text not null default 'KEION ARKIN DE LA CRUZ',
  birth_date text not null default '2025-10-12',
  hero_quote text not null default 'Little moments, Big memories',
  hero_subtitle text not null default 'Every little smile, crawl, and giggle becomes a treasure worth keeping forever.',
  cover_photo_url text,
  updated_at timestamptz not null default now()
);

-- Seed default baby profile row
insert into public.baby_settings (
  id,
  baby_name,
  birth_date,
  hero_quote,
  hero_subtitle,
  cover_photo_url
)
values (
  'babyProfile',
  'KEION ARKIN DE LA CRUZ',
  '2025-10-12',
  'Little moments, Big memories',
  'Every little smile, crawl, and giggle becomes a treasure worth keeping forever.',
  null
)
on conflict (id) do nothing;

-- 4. ROW LEVEL SECURITY (RLS) POLICIES
alter table public.albums enable row level security;
alter table public.memories enable row level security;
alter table public.baby_settings enable row level security;

-- Public & Family Admin policies for albums
drop policy if exists "Allow public read access on albums" on public.albums;
create policy "Allow public read access on albums"
  on public.albums for select
  to anon, authenticated
  using (true);

drop policy if exists "Allow family admin write access on albums" on public.albums;
create policy "Allow family admin write access on albums"
  on public.albums for all
  to anon, authenticated
  using (true)
  with check (true);

-- Public & Family Admin policies for memories
drop policy if exists "Allow public read access on memories" on public.memories;
create policy "Allow public read access on memories"
  on public.memories for select
  to anon, authenticated
  using (true);

drop policy if exists "Allow family admin write access on memories" on public.memories;
create policy "Allow family admin write access on memories"
  on public.memories for all
  to anon, authenticated
  using (true)
  with check (true);

-- Public & Family Admin policies for baby_settings
drop policy if exists "Allow public read access on baby_settings" on public.baby_settings;
create policy "Allow public read access on baby_settings"
  on public.baby_settings for select
  to anon, authenticated
  using (true);

drop policy if exists "Allow family admin write access on baby_settings" on public.baby_settings;
create policy "Allow family admin write access on baby_settings"
  on public.baby_settings for all
  to anon, authenticated
  using (true)
  with check (true);

-- 5. ENABLE SUPABASE REALTIME FOR ALL TABLES
alter table public.albums replica identity full;
alter table public.memories replica identity full;
alter table public.baby_settings replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'albums'
  ) then
    alter publication supabase_realtime add table public.albums;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'memories'
  ) then
    alter publication supabase_realtime add table public.memories;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'baby_settings'
  ) then
    alter publication supabase_realtime add table public.baby_settings;
  end if;
end $$;

-- 6. SUPABASE STORAGE BUCKETS ('media' and 'memories') & POLICIES
insert into storage.buckets (id, name, public)
values
  ('media', 'media', true),
  ('memories', 'memories', true)
on conflict (id) do update set public = true;

drop policy if exists "Public read access for media buckets" on storage.objects;
drop policy if exists "Public read access for memories bucket" on storage.objects;
create policy "Public read access for media buckets"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id in ('media', 'memories'));

drop policy if exists "Family admin upload access for media buckets" on storage.objects;
drop policy if exists "Family admin upload access for memories bucket" on storage.objects;
create policy "Family admin upload access for media buckets"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id in ('media', 'memories'));

drop policy if exists "Family admin update access for media buckets" on storage.objects;
drop policy if exists "Family admin update access for memories bucket" on storage.objects;
create policy "Family admin update access for media buckets"
  on storage.objects for update
  to anon, authenticated
  using (bucket_id in ('media', 'memories'))
  with check (bucket_id in ('media', 'memories'));

drop policy if exists "Family admin delete access for media buckets" on storage.objects;
drop policy if exists "Family admin delete access for memories bucket" on storage.objects;
create policy "Family admin delete access for media buckets"
  on storage.objects for delete
  to anon, authenticated
  using (bucket_id in ('media', 'memories'));

-- Reload PostgREST schema cache immediately
notify pgrst, 'reload schema';
