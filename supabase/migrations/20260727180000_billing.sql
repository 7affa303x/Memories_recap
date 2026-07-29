-- Memory Recap billing schema (Polar + credits)
create extension if not exists "pgcrypto";

create table if not exists public.billing_users (
  user_id text primary key,
  email text not null,
  polar_customer_id text unique,
  free_granted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.billing_users(user_id) on delete cascade,
  polar_subscription_id text not null unique,
  polar_product_id text not null,
  status text not null,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.billing_users(user_id) on delete cascade,
  type text not null,
  amount integer not null,
  polar_event_id text,
  polar_order_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (polar_event_id)
);

create table if not exists public.credit_lots (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.billing_users(user_id) on delete cascade,
  source text not null,
  original_amount integer not null check (original_amount > 0),
  remaining_amount integer not null check (remaining_amount >= 0),
  expires_at timestamptz not null,
  polar_event_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.credit_history (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.billing_users(user_id) on delete cascade,
  lot_id uuid references public.credit_lots(id) on delete set null,
  job_id text,
  delta integer not null,
  reason text not null,
  balance_after integer not null,
  created_at timestamptz not null default now()
);

create table if not exists public.webhook_events (
  id text primary key,
  type text not null,
  processed_at timestamptz not null default now()
);

create table if not exists public.processing_jobs (
  id text primary key,
  user_id text not null references public.billing_users(user_id) on delete cascade,
  credits_charged integer not null default 0,
  credit_status text not null default 'none',
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists credit_lots_user_expires_idx
  on public.credit_lots (user_id, expires_at);

create index if not exists subscriptions_user_idx
  on public.subscriptions (user_id);

create or replace function public.available_credits(p_user_id text)
returns integer
language sql
stable
as $$
  select coalesce(sum(remaining_amount), 0)::integer
  from public.credit_lots
  where user_id = p_user_id
    and remaining_amount > 0
    and expires_at > now();
$$;

create or replace function public.deduct_credits(
  p_user_id text,
  p_amount integer,
  p_job_id text,
  p_reason text default 'processing'
)
returns integer
language plpgsql
as $$
declare
  v_need integer := p_amount;
  v_lot record;
  v_take integer;
  v_balance integer;
begin
  if p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;

  if public.available_credits(p_user_id) < p_amount then
    raise exception 'insufficient_credits';
  end if;

  for v_lot in
    select id, remaining_amount
    from public.credit_lots
    where user_id = p_user_id
      and remaining_amount > 0
      and expires_at > now()
    order by expires_at asc, created_at asc
    for update
  loop
    exit when v_need <= 0;
    v_take := least(v_lot.remaining_amount, v_need);
    update public.credit_lots
      set remaining_amount = remaining_amount - v_take
      where id = v_lot.id;
    v_need := v_need - v_take;
  end loop;

  if v_need > 0 then
    raise exception 'insufficient_credits';
  end if;

  v_balance := public.available_credits(p_user_id);

  insert into public.credit_history (user_id, job_id, delta, reason, balance_after)
  values (p_user_id, p_job_id, -p_amount, p_reason, v_balance);

  return v_balance;
end;
$$;

alter table public.billing_users enable row level security;
alter table public.subscriptions enable row level security;
alter table public.transactions enable row level security;
alter table public.credit_lots enable row level security;
alter table public.credit_history enable row level security;
alter table public.webhook_events enable row level security;
alter table public.processing_jobs enable row level security;
