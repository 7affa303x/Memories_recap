-- Memory Recap initial schema
-- Apply via /api/setup/migrate or Supabase SQL editor

create extension if not exists "pgcrypto";

create table if not exists public.users (
  id text primary key,
  email text not null,
  name text,
  image text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  create type public.job_status as enum (
    'pending',
    'uploading',
    'analyzing',
    'selecting',
    'building',
    'rendering',
    'completed',
    'failed'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  status public.job_status not null default 'pending',
  stage text,
  progress integer not null default 0 check (progress >= 0 and progress <= 100),
  eta_seconds integer,
  error text,
  total_bytes bigint not null default 0,
  file_count integer not null default 0,
  notify_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.uploads (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  user_id text not null references public.users(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint not null check (size_bytes >= 0),
  duration_seconds numeric,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.recaps (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.jobs(id) on delete cascade,
  user_id text not null references public.users(id) on delete cascade,
  landscape_path text,
  vertical_path text,
  duration_seconds numeric,
  created_at timestamptz not null default now()
);

create index if not exists jobs_user_id_idx on public.jobs(user_id);
create index if not exists jobs_status_idx on public.jobs(status);
create index if not exists uploads_job_id_idx on public.uploads(job_id);
create index if not exists uploads_user_id_idx on public.uploads(user_id);
create index if not exists recaps_user_id_idx on public.recaps(user_id);

alter table public.users enable row level security;
alter table public.jobs enable row level security;
alter table public.uploads enable row level security;
alter table public.recaps enable row level security;

-- No anon/authenticated policies on purpose.
-- The app uses Auth.js sessions + the Supabase service role on the server.
-- RLS stays enabled so direct PostgREST access with the anon key is denied.

insert into storage.buckets (id, name, public, file_size_limit)
values
  ('memories', 'memories', false, 5242880000),
  ('recaps', 'recaps', true, 5242880000)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit;

drop policy if exists memories_select on storage.objects;
drop policy if exists memories_insert on storage.objects;
drop policy if exists memories_update on storage.objects;
drop policy if exists memories_delete on storage.objects;
drop policy if exists recaps_public_read on storage.objects;
drop policy if exists recaps_insert on storage.objects;
drop policy if exists recaps_update on storage.objects;

-- Public read for finished recaps only. Writes go through the service role.
create policy recaps_public_read on storage.objects
  for select using (bucket_id = 'recaps');
