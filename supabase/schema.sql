-- Clean schema for Memories Recap using TEXT IDs (nanoid)

-- Extensions
create extension if not exists "pgcrypto";

-- Enums
do $$ begin
  create type public.job_status as enum (
    'pending',
    'uploading',
    'queued',
    'analyzing',
    'selecting',
    'building',
    'rendering',
    'completed',
    'failed',
    'cancelled',
    'retrying'
  );
exception when duplicate_object then null;
end $$;

-- Users
create table if not exists public.users (
  id text primary key,
  email text not null,
  name text,
  image text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Jobs
create table if not exists public.jobs (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  status public.job_status not null default 'pending',
  stage text,
  progress integer not null default 0 check (progress >= 0 and progress <= 100),
  eta_seconds integer,
  error text,
  total_bytes bigint not null default 0,
  file_count integer not null default 0,
  notify_email text,
  pipeline_stage text,
  failed_stage text,
  attempt integer not null default 0,
  recap_options jsonb,
  title text,
  folder text,
  credits_charged integer,
  version integer not null default 0,
  recap_generation integer not null default 0,
  hidden boolean not null default false,
  share_token text,
  share_expires_at timestamptz,
  share_password_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

-- Uploads
create table if not exists public.uploads (
  id text primary key,
  job_id text not null references public.jobs(id) on delete cascade,
  user_id text not null references public.users(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint not null check (size_bytes >= 0),
  duration_seconds numeric,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Recaps
create table if not exists public.recaps (
  id text primary key default gen_random_uuid()::text,
  job_id text not null unique references public.jobs(id) on delete cascade,
  user_id text not null references public.users(id) on delete cascade,
  landscape_path text,
  vertical_path text,
  highlights_path text,
  story_path text,
  tiktok_path text,
  preview_path text,
  duration_seconds numeric,
  expires_at timestamptz,
  current_generation integer,
  rating integer,
  rated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Leases
create table if not exists public.job_leases (
  job_id text primary key,
  user_id text not null,
  owner_id text not null,
  started_at timestamptz not null default now(),
  heartbeat_at timestamptz not null default now(),
  attempt integer not null default 1
);

-- Artifacts
create table if not exists public.job_artifacts (
  id uuid primary key default gen_random_uuid(),
  job_id text not null,
  user_id text not null,
  kind text not null,
  storage_path text not null,
  upload_id text,
  bytes bigint,
  meta jsonb,
  created_at timestamptz not null default now(),
  unique (job_id, kind, storage_path)
);

-- Events
create table if not exists public.pipeline_events (
  id bigserial primary key,
  job_id text not null,
  user_id text not null,
  stage text,
  event text not null,
  detail jsonb,
  created_at timestamptz not null default now()
);

-- Billing (if not already handled by migrations)
create table if not exists public.billing_customers (
  user_id text primary key references public.users(id) on delete cascade,
  email text not null,
  customer_id text,
  provider text,
  created_at timestamptz not null default now()
);

create table if not exists public.billing_subscriptions (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  status text not null,
  price_id text,
  quantity integer,
  cancel_at_period_end boolean,
  created_at timestamptz not null default now(),
  current_period_start timestamptz not null,
  current_period_end timestamptz not null,
  ended_at timestamptz,
  cancel_at timestamptz,
  canceled_at timestamptz,
  trial_start timestamptz,
  trial_end timestamptz
);

-- Indexes
create index if not exists jobs_user_id_idx on public.jobs(user_id);
create index if not exists jobs_status_idx on public.jobs(status);
create index if not exists uploads_job_id_idx on public.uploads(job_id);
create index if not exists uploads_user_id_idx on public.uploads(user_id);
create index if not exists recaps_user_id_idx on public.recaps(user_id);
create index if not exists job_artifacts_job_id_idx on public.job_artifacts(job_id);
create index if not exists job_leases_heartbeat_idx on public.job_leases(heartbeat_at);
create index if not exists pipeline_events_job_id_idx on public.pipeline_events(job_id);

-- Storage Buckets
insert into storage.buckets (id, name, public, file_size_limit)
values
  ('memories', 'memories', false, 5242880000),
  ('recaps', 'recaps', false, 5242880000),
  ('app-data', 'app-data', false, 524288000)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit;

-- RLS
alter table public.users enable row level security;
alter table public.jobs enable row level security;
alter table public.uploads enable row level security;
alter table public.recaps enable row level security;
alter table public.job_leases enable row level security;
alter table public.job_artifacts enable row level security;
alter table public.pipeline_events enable row level security;
