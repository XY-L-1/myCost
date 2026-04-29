-- MyCost Supabase category data repair
-- Run this manually in Supabase SQL Editor.
--
-- Purpose:
-- 1. Audit expenses that still point at legacy placeholder categories named
--    "Category" or "Other".
-- 2. Repoint only obvious rows to an existing real category, based on the same
--    conservative keyword rules used by the app.
-- 3. Leave unclear rows untouched.
--
-- Recommended workflow:
-- - Run section 1 first and inspect the result.
-- - Run section 2 to preview the exact rows that would change.
-- - Only run section 3 after the preview looks right.

-- 1. Audit current category duplicates and placeholders.

select
  user_id,
  coalesce(normalized_name, lower(regexp_replace(trim(name), '\s+', ' ', 'g'))) as normalized_name,
  count(*) as row_count,
  count(*) filter (where deleted_at is null) as active_count,
  jsonb_agg(
    jsonb_build_object(
      'id', id,
      'name', name,
      'deleted_at', deleted_at,
      'created_at', created_at,
      'updated_at', updated_at
    )
    order by deleted_at is not null, created_at, id
  ) as rows
from public.categories
group by user_id, coalesce(normalized_name, lower(regexp_replace(trim(name), '\s+', ' ', 'g')))
having count(*) > 1
order by user_id, normalized_name;

select
  c.user_id,
  c.id as category_id,
  c.name,
  c.deleted_at,
  count(e.id) as active_expense_count,
  coalesce(sum(e.amount_cents), 0) as active_expense_total_cents
from public.categories c
left join public.expenses e
  on e.user_id = c.user_id
 and e.category_id = c.id
 and e.deleted_at is null
where lower(trim(c.name)) in ('category', 'other')
group by c.user_id, c.id, c.name, c.deleted_at
order by c.user_id, lower(trim(c.name)), c.deleted_at is not null, c.created_at;

-- 2. Preview rows that can be safely repointed.
-- If any row looks wrong, do not run section 3 yet.

with inferred_expenses as (
  select
    e.id,
    e.user_id,
    e.category_id as old_category_id,
    c.name as old_category_name,
    e.description,
    e.expense_date,
    e.amount_cents,
    case
      when lower(coalesce(e.description, '')) like '%gas%'
        or lower(coalesce(e.description, '')) like '%fuel%'
        or lower(coalesce(e.description, '')) like '%shell%'
        or lower(coalesce(e.description, '')) like '%chevron%'
        or lower(coalesce(e.description, '')) like '%exxon%'
        or lower(coalesce(e.description, '')) like '%mobil%'
        or lower(coalesce(e.description, '')) like '%76%'
        then 'gas'
      when lower(coalesce(e.description, '')) like '%kaiser%'
        or lower(coalesce(e.description, '')) like '%health%'
        or lower(coalesce(e.description, '')) like '%doctor%'
        or lower(coalesce(e.description, '')) like '%medical%'
        or lower(coalesce(e.description, '')) like '%pharmacy%'
        or lower(coalesce(e.description, '')) like '%dental%'
        then 'healthcare'
      when lower(coalesce(e.description, '')) like '%food%'
        or lower(coalesce(e.description, '')) like '%pizza%'
        or lower(coalesce(e.description, '')) like '%restaurant%'
        or lower(coalesce(e.description, '')) like '%costco%'
        or lower(coalesce(e.description, '')) like '%grocery%'
        or lower(coalesce(e.description, '')) like '%groceries%'
        or lower(coalesce(e.description, '')) like '%meal%'
        or lower(coalesce(e.description, '')) like '%dining%'
        or lower(coalesce(e.description, '')) like '%dinner%'
        or lower(coalesce(e.description, '')) like '%lunch%'
        or lower(coalesce(e.description, '')) like '%eating%'
        or lower(coalesce(e.description, '')) like '%chick-fil-a%'
        or lower(coalesce(e.description, '')) like '%chick fil a%'
        or lower(coalesce(e.description, '')) like '%mcdonald%'
        or lower(coalesce(e.description, '')) like '%85c%'
        or lower(coalesce(e.description, '')) like '%99 ranch%'
        then 'food'
      when lower(coalesce(e.description, '')) like '%rent%'
        or lower(coalesce(e.description, '')) like '%mortgage%'
        or lower(coalesce(e.description, '')) like '%housing%'
        or lower(coalesce(e.description, '')) like '%apartment%'
        or lower(coalesce(e.description, '')) like '%lease%'
        then 'housing'
      when lower(coalesce(e.description, '')) like '%visible%'
        or lower(coalesce(e.description, '')) like '%sim card%'
        or lower(coalesce(e.description, '')) like '%subscription%'
        or lower(coalesce(e.description, '')) like '%membership%'
        then 'subscription'
      when lower(coalesce(e.description, '')) like '%amazon%'
        or lower(coalesce(e.description, '')) like '%target%'
        or lower(coalesce(e.description, '')) like '%walmart%'
        or lower(coalesce(e.description, '')) like '%shopping%'
        then 'shopping'
      when lower(coalesce(e.description, '')) like '%uber%'
        or lower(coalesce(e.description, '')) like '%lyft%'
        or lower(coalesce(e.description, '')) like '%parking%'
        or lower(coalesce(e.description, '')) like '%transit%'
        or lower(coalesce(e.description, '')) like '%transport%'
        then 'transport'
      when lower(coalesce(e.description, '')) like '%movie%'
        or lower(coalesce(e.description, '')) like '%cinema%'
        or lower(coalesce(e.description, '')) like '%game%'
        or lower(coalesce(e.description, '')) like '%netflix%'
        or lower(coalesce(e.description, '')) like '%spotify%'
        or lower(coalesce(e.description, '')) like '%entertainment%'
        then 'entertainment'
      when lower(coalesce(e.description, '')) like '%gift%'
        or lower(coalesce(e.description, '')) like '%present%'
        or lower(coalesce(e.description, '')) like '%donation%'
        then 'gift'
      else null
    end as inferred_normalized_name
  from public.expenses e
  join public.categories c
    on c.user_id = e.user_id
   and c.id = e.category_id
  where e.deleted_at is null
    and lower(trim(c.name)) in ('category', 'other')
),
targets as (
  select distinct on (user_id, coalesce(normalized_name, lower(regexp_replace(trim(name), '\s+', ' ', 'g'))))
    id,
    user_id,
    name,
    coalesce(normalized_name, lower(regexp_replace(trim(name), '\s+', ' ', 'g'))) as normalized_name
  from public.categories
  where deleted_at is null
  order by
    user_id,
    coalesce(normalized_name, lower(regexp_replace(trim(name), '\s+', ' ', 'g'))),
    created_at,
    id
)
select
  i.user_id,
  i.id as expense_id,
  i.description,
  i.expense_date,
  i.amount_cents,
  i.old_category_name,
  i.old_category_id,
  t.name as new_category_name,
  t.id as new_category_id
from inferred_expenses i
join targets t
  on t.user_id = i.user_id
 and t.normalized_name = i.inferred_normalized_name
where i.inferred_normalized_name is not null
  and t.id <> i.old_category_id
order by i.user_id, i.expense_date desc, i.description;

-- Rows below have a clear inference but no active target category exists.
-- Create/restore that category in the app first, then rerun the preview.
with inferred_expenses as (
  select
    e.id,
    e.user_id,
    e.description,
    case
      when lower(coalesce(e.description, '')) like '%gas%' then 'gas'
      when lower(coalesce(e.description, '')) like '%kaiser%' then 'healthcare'
      when lower(coalesce(e.description, '')) like '%food%'
        or lower(coalesce(e.description, '')) like '%pizza%'
        or lower(coalesce(e.description, '')) like '%costco%'
        or lower(coalesce(e.description, '')) like '%dinner%'
        or lower(coalesce(e.description, '')) like '%lunch%'
        or lower(coalesce(e.description, '')) like '%chick-fil-a%'
        or lower(coalesce(e.description, '')) like '%chick fil a%'
        or lower(coalesce(e.description, '')) like '%mcdonald%'
        or lower(coalesce(e.description, '')) like '%85c%'
        or lower(coalesce(e.description, '')) like '%99 ranch%'
        then 'food'
      else null
    end as inferred_normalized_name
  from public.expenses e
  join public.categories c
    on c.user_id = e.user_id
   and c.id = e.category_id
  where e.deleted_at is null
    and lower(trim(c.name)) in ('category', 'other')
)
select distinct
  i.user_id,
  i.inferred_normalized_name as missing_category,
  count(*) as affected_expense_count
from inferred_expenses i
where i.inferred_normalized_name is not null
  and not exists (
    select 1
    from public.categories c
    where c.user_id = i.user_id
      and c.deleted_at is null
      and coalesce(c.normalized_name, lower(regexp_replace(trim(c.name), '\s+', ' ', 'g'))) = i.inferred_normalized_name
  )
group by i.user_id, i.inferred_normalized_name
order by i.user_id, i.inferred_normalized_name;

-- 3. Apply the safe repair.
-- This only updates rows from section 2 that have an existing active target category.

begin;

with inferred_expenses as (
  select
    e.id,
    e.user_id,
    e.category_id as old_category_id,
    case
      when lower(coalesce(e.description, '')) like '%gas%'
        or lower(coalesce(e.description, '')) like '%fuel%'
        or lower(coalesce(e.description, '')) like '%shell%'
        or lower(coalesce(e.description, '')) like '%chevron%'
        or lower(coalesce(e.description, '')) like '%exxon%'
        or lower(coalesce(e.description, '')) like '%mobil%'
        or lower(coalesce(e.description, '')) like '%76%'
        then 'gas'
      when lower(coalesce(e.description, '')) like '%kaiser%'
        or lower(coalesce(e.description, '')) like '%health%'
        or lower(coalesce(e.description, '')) like '%doctor%'
        or lower(coalesce(e.description, '')) like '%medical%'
        or lower(coalesce(e.description, '')) like '%pharmacy%'
        or lower(coalesce(e.description, '')) like '%dental%'
        then 'healthcare'
      when lower(coalesce(e.description, '')) like '%food%'
        or lower(coalesce(e.description, '')) like '%pizza%'
        or lower(coalesce(e.description, '')) like '%restaurant%'
        or lower(coalesce(e.description, '')) like '%costco%'
        or lower(coalesce(e.description, '')) like '%grocery%'
        or lower(coalesce(e.description, '')) like '%groceries%'
        or lower(coalesce(e.description, '')) like '%meal%'
        or lower(coalesce(e.description, '')) like '%dining%'
        or lower(coalesce(e.description, '')) like '%dinner%'
        or lower(coalesce(e.description, '')) like '%lunch%'
        or lower(coalesce(e.description, '')) like '%eating%'
        or lower(coalesce(e.description, '')) like '%chick-fil-a%'
        or lower(coalesce(e.description, '')) like '%chick fil a%'
        or lower(coalesce(e.description, '')) like '%mcdonald%'
        or lower(coalesce(e.description, '')) like '%85c%'
        or lower(coalesce(e.description, '')) like '%99 ranch%'
        then 'food'
      when lower(coalesce(e.description, '')) like '%rent%'
        or lower(coalesce(e.description, '')) like '%mortgage%'
        or lower(coalesce(e.description, '')) like '%housing%'
        or lower(coalesce(e.description, '')) like '%apartment%'
        or lower(coalesce(e.description, '')) like '%lease%'
        then 'housing'
      when lower(coalesce(e.description, '')) like '%visible%'
        or lower(coalesce(e.description, '')) like '%sim card%'
        or lower(coalesce(e.description, '')) like '%subscription%'
        or lower(coalesce(e.description, '')) like '%membership%'
        then 'subscription'
      when lower(coalesce(e.description, '')) like '%amazon%'
        or lower(coalesce(e.description, '')) like '%target%'
        or lower(coalesce(e.description, '')) like '%walmart%'
        or lower(coalesce(e.description, '')) like '%shopping%'
        then 'shopping'
      when lower(coalesce(e.description, '')) like '%uber%'
        or lower(coalesce(e.description, '')) like '%lyft%'
        or lower(coalesce(e.description, '')) like '%parking%'
        or lower(coalesce(e.description, '')) like '%transit%'
        or lower(coalesce(e.description, '')) like '%transport%'
        then 'transport'
      when lower(coalesce(e.description, '')) like '%movie%'
        or lower(coalesce(e.description, '')) like '%cinema%'
        or lower(coalesce(e.description, '')) like '%game%'
        or lower(coalesce(e.description, '')) like '%netflix%'
        or lower(coalesce(e.description, '')) like '%spotify%'
        or lower(coalesce(e.description, '')) like '%entertainment%'
        then 'entertainment'
      when lower(coalesce(e.description, '')) like '%gift%'
        or lower(coalesce(e.description, '')) like '%present%'
        or lower(coalesce(e.description, '')) like '%donation%'
        then 'gift'
      else null
    end as inferred_normalized_name
  from public.expenses e
  join public.categories c
    on c.user_id = e.user_id
   and c.id = e.category_id
  where e.deleted_at is null
    and lower(trim(c.name)) in ('category', 'other')
),
targets as (
  select distinct on (user_id, coalesce(normalized_name, lower(regexp_replace(trim(name), '\s+', ' ', 'g'))))
    id,
    user_id,
    coalesce(normalized_name, lower(regexp_replace(trim(name), '\s+', ' ', 'g'))) as normalized_name
  from public.categories
  where deleted_at is null
  order by
    user_id,
    coalesce(normalized_name, lower(regexp_replace(trim(name), '\s+', ' ', 'g'))),
    created_at,
    id
),
updates as (
  select
    i.id as expense_id,
    i.user_id,
    t.id as new_category_id
  from inferred_expenses i
  join targets t
    on t.user_id = i.user_id
   and t.normalized_name = i.inferred_normalized_name
  where i.inferred_normalized_name is not null
    and t.id <> i.old_category_id
)
update public.expenses e
set
  category_id = updates.new_category_id,
  updated_at = to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
from updates
where e.id = updates.expense_id
  and e.user_id = updates.user_id;

-- Review how many rows were changed before commit.
-- Supabase SQL Editor shows the update row count above.

commit;
