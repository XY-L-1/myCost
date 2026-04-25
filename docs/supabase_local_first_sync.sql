-- MyCost local-first sync schema hardening
-- Run this in Supabase SQL Editor.
-- It is intentionally idempotent except for the active category unique index,
-- which can fail if you already have duplicate active normalized category names.

-- Optional preflight: this should return zero rows before the unique index section.
select user_id, normalized_name, count(*) as duplicate_count
from public.categories
where deleted_at is null
  and normalized_name is not null
group by user_id, normalized_name
having count(*) > 1;

-- Existing tables: data defaults and indexes.
update public.categories
set budget = 0
where budget is null;

alter table public.categories
alter column budget set default 0;

create index if not exists expenses_user_updated_idx
on public.expenses(user_id, updated_at);

create index if not exists expenses_user_date_idx
on public.expenses(user_id, expense_date);

create index if not exists expenses_user_category_idx
on public.expenses(user_id, category_id);

create index if not exists categories_user_updated_idx
on public.categories(user_id, updated_at);

create index if not exists categories_user_normalized_idx
on public.categories(user_id, normalized_name);

create unique index if not exists categories_user_normalized_active_unique
on public.categories(user_id, normalized_name)
where deleted_at is null and normalized_name is not null;

-- New sync tables.
create table if not exists public.budgets (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null,
  month_key text not null check (month_key ~ '^[0-9]{4}-[0-9]{2}$'),
  amount_cents int4 not null check (amount_cents >= 0),
  created_at text not null,
  updated_at text not null,
  unique(user_id, category_id, month_key)
);

create index if not exists budgets_user_updated_idx
on public.budgets(user_id, updated_at);

create index if not exists budgets_user_month_idx
on public.budgets(user_id, month_key);

create table if not exists public.recurring_expenses (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  amount_cents int4 not null check (amount_cents > 0),
  currency text not null,
  category_id uuid not null,
  description text,
  frequency text not null check (frequency in ('weekly', 'monthly')),
  next_due_date text not null,
  last_generated_date text,
  is_active int4 not null default 1 check (is_active in (0, 1)),
  created_at text not null,
  updated_at text not null
);

create index if not exists recurring_expenses_user_updated_idx
on public.recurring_expenses(user_id, updated_at);

create index if not exists recurring_expenses_user_due_idx
on public.recurring_expenses(user_id, is_active, next_due_date);

-- Row Level Security.
alter table public.expenses enable row level security;
alter table public.categories enable row level security;
alter table public.budgets enable row level security;
alter table public.recurring_expenses enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'expenses' and policyname = 'expenses_select_own'
  ) then
    create policy expenses_select_own on public.expenses
    for select using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'expenses' and policyname = 'expenses_insert_own'
  ) then
    create policy expenses_insert_own on public.expenses
    for insert with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'expenses' and policyname = 'expenses_update_own'
  ) then
    create policy expenses_update_own on public.expenses
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'categories' and policyname = 'categories_select_own'
  ) then
    create policy categories_select_own on public.categories
    for select using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'categories' and policyname = 'categories_insert_own'
  ) then
    create policy categories_insert_own on public.categories
    for insert with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'categories' and policyname = 'categories_update_own'
  ) then
    create policy categories_update_own on public.categories
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'budgets' and policyname = 'budgets_select_own'
  ) then
    create policy budgets_select_own on public.budgets
    for select using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'budgets' and policyname = 'budgets_insert_own'
  ) then
    create policy budgets_insert_own on public.budgets
    for insert with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'budgets' and policyname = 'budgets_update_own'
  ) then
    create policy budgets_update_own on public.budgets
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'recurring_expenses' and policyname = 'recurring_expenses_select_own'
  ) then
    create policy recurring_expenses_select_own on public.recurring_expenses
    for select using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'recurring_expenses' and policyname = 'recurring_expenses_insert_own'
  ) then
    create policy recurring_expenses_insert_own on public.recurring_expenses
    for insert with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'recurring_expenses' and policyname = 'recurring_expenses_update_own'
  ) then
    create policy recurring_expenses_update_own on public.recurring_expenses
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;
