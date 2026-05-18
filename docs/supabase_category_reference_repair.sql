-- MyCost Supabase category reference repair
-- Run manually in Supabase SQL Editor after deploying the app fix.
--
-- Purpose:
-- - Move expenses, budgets, and recurring expenses off archived duplicate
--   categories when an active category with the same name exists.
-- - Merge duplicate budget rows without violating
--   budgets_user_id_category_id_month_key_key.
-- - Leave active "Other" rows untouched; those need user judgment.

-- 1. Audit stale references before changing anything.

with category_alias as (
  select
    source.user_id,
    source.id as source_category_id,
    source.name as source_name,
    source.deleted_at as source_deleted_at,
    canonical.id as canonical_category_id,
    canonical.name as canonical_name
  from public.categories source
  join lateral (
    select target.*
    from public.categories target
    where target.user_id = source.user_id
      and coalesce(target.normalized_name, lower(regexp_replace(trim(target.name), '\s+', ' ', 'g'))) =
          coalesce(source.normalized_name, lower(regexp_replace(trim(source.name), '\s+', ' ', 'g')))
    order by target.deleted_at is not null, target.updated_at desc, target.created_at, target.id
    limit 1
  ) canonical on true
  where source.id <> canonical.id
    and canonical.deleted_at is null
)
select
  a.user_id,
  a.source_category_id,
  a.source_name,
  a.source_deleted_at,
  a.canonical_category_id,
  a.canonical_name,
  count(distinct e.id) as expense_count,
  count(distinct b.id) as budget_count,
  count(distinct r.id) as recurring_count
from category_alias a
left join public.expenses e
  on e.user_id = a.user_id
 and e.category_id = a.source_category_id
 and e.deleted_at is null
left join public.budgets b
  on b.user_id = a.user_id
 and b.category_id = a.source_category_id
left join public.recurring_expenses r
  on r.user_id = a.user_id
 and r.category_id = a.source_category_id
 and r.is_active = 1
group by
  a.user_id,
  a.source_category_id,
  a.source_name,
  a.source_deleted_at,
  a.canonical_category_id,
  a.canonical_name
having count(distinct e.id) > 0
    or count(distinct b.id) > 0
    or count(distinct r.id) > 0
order by a.user_id, a.source_name;

-- 2. Audit active placeholder budgets. Do not auto-fix these unless you know
-- exactly which real category they should move to.

select
  b.user_id,
  b.id as budget_id,
  b.month_key,
  b.amount_cents,
  c.id as category_id,
  c.name as category_name,
  c.deleted_at
from public.budgets b
join public.categories c
  on c.user_id = b.user_id
 and c.id = b.category_id
where lower(trim(c.name)) in ('category', 'other')
  and b.amount_cents <> 0
order by b.user_id, b.month_key, c.name;

-- 3. Apply stale-reference repair.

begin;

with category_alias as (
  select
    source.user_id,
    source.id as source_category_id,
    canonical.id as canonical_category_id
  from public.categories source
  join lateral (
    select target.*
    from public.categories target
    where target.user_id = source.user_id
      and coalesce(target.normalized_name, lower(regexp_replace(trim(target.name), '\s+', ' ', 'g'))) =
          coalesce(source.normalized_name, lower(regexp_replace(trim(source.name), '\s+', ' ', 'g')))
    order by target.deleted_at is not null, target.updated_at desc, target.created_at, target.id
    limit 1
  ) canonical on true
  where source.id <> canonical.id
    and canonical.deleted_at is null
)
update public.expenses e
set
  category_id = a.canonical_category_id,
  updated_at = to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  version = e.version + 1
from category_alias a
where e.user_id = a.user_id
  and e.category_id = a.source_category_id;

with category_alias as (
  select
    source.user_id,
    source.id as source_category_id,
    canonical.id as canonical_category_id
  from public.categories source
  join lateral (
    select target.*
    from public.categories target
    where target.user_id = source.user_id
      and coalesce(target.normalized_name, lower(regexp_replace(trim(target.name), '\s+', ' ', 'g'))) =
          coalesce(source.normalized_name, lower(regexp_replace(trim(source.name), '\s+', ' ', 'g')))
    order by target.deleted_at is not null, target.updated_at desc, target.created_at, target.id
    limit 1
  ) canonical on true
  where source.id <> canonical.id
    and canonical.deleted_at is null
)
update public.recurring_expenses r
set
  category_id = a.canonical_category_id,
  updated_at = to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
from category_alias a
where r.user_id = a.user_id
  and r.category_id = a.source_category_id;

-- Move budget rows that do not collide with an existing canonical budget.
with category_alias as (
  select
    source.user_id,
    source.id as source_category_id,
    canonical.id as canonical_category_id
  from public.categories source
  join lateral (
    select target.*
    from public.categories target
    where target.user_id = source.user_id
      and coalesce(target.normalized_name, lower(regexp_replace(trim(target.name), '\s+', ' ', 'g'))) =
          coalesce(source.normalized_name, lower(regexp_replace(trim(source.name), '\s+', ' ', 'g')))
    order by target.deleted_at is not null, target.updated_at desc, target.created_at, target.id
    limit 1
  ) canonical on true
  where source.id <> canonical.id
    and canonical.deleted_at is null
)
update public.budgets b
set
  category_id = a.canonical_category_id,
  updated_at = to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
from category_alias a
where b.user_id = a.user_id
  and b.category_id = a.source_category_id
  and not exists (
    select 1
    from public.budgets target
    where target.user_id = b.user_id
      and target.category_id = a.canonical_category_id
      and target.month_key = b.month_key
      and target.id <> b.id
  );

-- Merge budget rows that would collide after moving.
with category_alias as (
  select
    source.user_id,
    source.id as source_category_id,
    canonical.id as canonical_category_id
  from public.categories source
  join lateral (
    select target.*
    from public.categories target
    where target.user_id = source.user_id
      and coalesce(target.normalized_name, lower(regexp_replace(trim(target.name), '\s+', ' ', 'g'))) =
          coalesce(source.normalized_name, lower(regexp_replace(trim(source.name), '\s+', ' ', 'g')))
    order by target.deleted_at is not null, target.updated_at desc, target.created_at, target.id
    limit 1
  ) canonical on true
  where source.id <> canonical.id
    and canonical.deleted_at is null
),
budget_conflicts as (
  select
    source.id as source_budget_id,
    target.id as target_budget_id,
    source.amount_cents as source_amount_cents,
    source.updated_at as source_updated_at,
    target.updated_at as target_updated_at
  from public.budgets source
  join category_alias a
    on a.user_id = source.user_id
   and a.source_category_id = source.category_id
  join public.budgets target
    on target.user_id = source.user_id
   and target.category_id = a.canonical_category_id
   and target.month_key = source.month_key
   and target.id <> source.id
)
update public.budgets target
set
  amount_cents = case
    when budget_conflicts.source_updated_at::timestamptz > budget_conflicts.target_updated_at::timestamptz
      then budget_conflicts.source_amount_cents
    else target.amount_cents
  end,
  updated_at = case
    when budget_conflicts.source_updated_at::timestamptz > budget_conflicts.target_updated_at::timestamptz
      then to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    else target.updated_at
  end
from budget_conflicts
where target.id = budget_conflicts.target_budget_id;

with category_alias as (
  select
    source.user_id,
    source.id as source_category_id,
    canonical.id as canonical_category_id
  from public.categories source
  join lateral (
    select target.*
    from public.categories target
    where target.user_id = source.user_id
      and coalesce(target.normalized_name, lower(regexp_replace(trim(target.name), '\s+', ' ', 'g'))) =
          coalesce(source.normalized_name, lower(regexp_replace(trim(source.name), '\s+', ' ', 'g')))
    order by target.deleted_at is not null, target.updated_at desc, target.created_at, target.id
    limit 1
  ) canonical on true
  where source.id <> canonical.id
    and canonical.deleted_at is null
),
budget_conflicts as (
  select source.id as source_budget_id
  from public.budgets source
  join category_alias a
    on a.user_id = source.user_id
   and a.source_category_id = source.category_id
  join public.budgets target
    on target.user_id = source.user_id
   and target.category_id = a.canonical_category_id
   and target.month_key = source.month_key
   and target.id <> source.id
)
delete from public.budgets b
using budget_conflicts
where b.id = budget_conflicts.source_budget_id;

commit;
