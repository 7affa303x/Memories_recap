-- Rename Polar billing columns to Paddle equivalents (idempotent).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'billing_users' and column_name = 'polar_customer_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'billing_users' and column_name = 'paddle_customer_id'
  ) then
    alter table public.billing_users rename column polar_customer_id to paddle_customer_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'subscriptions' and column_name = 'polar_subscription_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'subscriptions' and column_name = 'paddle_subscription_id'
  ) then
    alter table public.subscriptions rename column polar_subscription_id to paddle_subscription_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'subscriptions' and column_name = 'polar_product_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'subscriptions' and column_name = 'paddle_price_id'
  ) then
    alter table public.subscriptions rename column polar_product_id to paddle_price_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'transactions' and column_name = 'polar_event_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'transactions' and column_name = 'paddle_event_id'
  ) then
    alter table public.transactions rename column polar_event_id to paddle_event_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'transactions' and column_name = 'polar_order_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'transactions' and column_name = 'paddle_transaction_id'
  ) then
    alter table public.transactions rename column polar_order_id to paddle_transaction_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'credit_lots' and column_name = 'polar_event_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'credit_lots' and column_name = 'paddle_event_id'
  ) then
    alter table public.credit_lots rename column polar_event_id to paddle_event_id;
  end if;
end $$;
