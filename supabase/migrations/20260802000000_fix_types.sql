-- Fix ID types to match nanoid(26) used in code
-- Also ensure all tables exist and have correct columns

-- Users table
create table if not exists public.users (
  id text primary key,
  email text not null,
  name text,
  image text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Jobs table
alter table if exists public.jobs drop constraint if exists jobs_user_id_fkey;
alter table if exists public.jobs alter column id type text;
alter table if exists public.jobs alter column user_id type text;
alter table if exists public.jobs add column if not exists hidden boolean not null default false;
alter table if exists public.jobs add column if not exists version integer not null default 0;
alter table if exists public.jobs add column if not exists recap_generation integer not null default 0;

-- Uploads table
alter table if exists public.uploads drop constraint if exists uploads_job_id_fkey;
alter table if exists public.uploads drop constraint if exists uploads_user_id_fkey;
alter table if exists public.uploads alter column id type text;
alter table if exists public.uploads alter column job_id type text;
alter table if exists public.uploads alter column user_id type text;

-- Recaps table
alter table if exists public.recaps drop constraint if exists recaps_job_id_fkey;
alter table if exists public.recaps drop constraint if exists recaps_user_id_fkey;
alter table if exists public.recaps alter column id type text;
alter table if exists public.recaps alter column job_id type text;
alter table if exists public.recaps alter column user_id type text;
alter table if exists public.recaps add column if not exists expires_at timestamptz;
alter table if exists public.recaps add column if not exists current_generation integer;
alter table if exists public.recaps add column if not exists updated_at timestamptz not null default now();
alter table if exists public.recaps add column if not exists highlights_path text;
alter table if exists public.recaps add column if not exists story_path text;
alter table if exists public.recaps add column if not exists tiktok_path text;
alter table if exists public.recaps add column if not exists preview_path text;
alter table if exists public.recaps add column if not exists rating integer;
alter table if exists public.recaps add column if not exists rated_at timestamptz;

-- Re-add constraints
alter table public.jobs add constraint jobs_user_id_fkey foreign key (user_id) references public.users(id) on delete cascade;
alter table public.uploads add constraint uploads_job_id_fkey foreign key (job_id) references public.jobs(id) on delete cascade;
alter table public.uploads add constraint uploads_user_id_fkey foreign key (user_id) references public.users(id) on delete cascade;
alter table public.recaps add constraint recaps_job_id_fkey foreign key (job_id) references public.jobs(id) on delete cascade;
alter table public.recaps add constraint recaps_user_id_fkey foreign key (user_id) references public.users(id) on delete cascade;
