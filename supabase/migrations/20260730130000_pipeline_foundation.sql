-- Pipeline foundation: durable job stages, artifacts, and exclusive leases.
-- Runtime still uses Storage JSON today; apply this for Postgres dual-write / cutover.
-- Apply via Supabase SQL editor (MCP auth or dashboard).

create extension if not exists "pgcrypto";

-- Expand job_status if the enum already exists from initial migration
do $$ begin
  alter type public.job_status add value if not exists 'queued';
exception when duplicate_object then null;
end $$;
do $$ begin
  alter type public.job_status add value if not exists 'cancelled';
exception when duplicate_object then null;
end $$;
do $$ begin
  alter type public.job_status add value if not exists 'ingesting';
exception when duplicate_object then null;
end $$;
do $$ begin
  alter type public.job_status add value if not exists 'timeline_ready';
exception when duplicate_object then null;
end $$;
do $$ begin
  alter type public.job_status add value if not exists 'retrying';
exception when duplicate_object then null;
end $$;

alter table if exists public.jobs
  add column if not exists pipeline_stage text,
  add column if not exists failed_stage text,
  add column if not exists attempt integer not null default 0,
  add column if not exists recap_options jsonb,
  add column if not exists title text,
  add column if not exists folder text,
  add column if not exists credits_charged integer,
  add column if not exists version integer not null default 0,
  add column if not exists recap_generation integer not null default 0,
  add column if not exists hidden boolean not null default false,
  add column if not exists share_token text,
  add column if not exists share_expires_at timestamptz,
  add column if not exists share_password_hash text;

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

create index if not exists job_artifacts_job_id_idx on public.job_artifacts(job_id);
create index if not exists job_artifacts_user_id_idx on public.job_artifacts(user_id);
create index if not exists job_artifacts_kind_idx on public.job_artifacts(kind);

create table if not exists public.job_leases (
  job_id text primary key,
  user_id text not null,
  owner_id text not null,
  started_at timestamptz not null default now(),
  heartbeat_at timestamptz not null default now(),
  attempt integer not null default 1
);

create index if not exists job_leases_heartbeat_idx on public.job_leases(heartbeat_at);
create index if not exists job_leases_user_id_idx on public.job_leases(user_id);

create table if not exists public.pipeline_events (
  id bigserial primary key,
  job_id text not null,
  user_id text not null,
  stage text,
  event text not null,
  detail jsonb,
  created_at timestamptz not null default now()
);

create index if not exists pipeline_events_job_id_idx on public.pipeline_events(job_id);
create index if not exists pipeline_events_created_at_idx on public.pipeline_events(created_at desc);

alter table public.job_artifacts enable row level security;
alter table public.job_leases enable row level security;
alter table public.pipeline_events enable row level security;

-- Service role only (Auth.js + server). No anon policies on purpose.

insert into storage.buckets (id, name, public, file_size_limit)
values ('app-data', 'app-data', false, 524288000)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit;
