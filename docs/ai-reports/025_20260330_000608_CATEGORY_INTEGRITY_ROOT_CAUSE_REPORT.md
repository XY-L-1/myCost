# Category Integrity Root Cause Report

## Exact Root Cause

This was a combined category-integrity problem, not a single isolated bug.

The two visible symptoms:
- `UNIQUE constraint failed: categories.id`
- duplicate logical categories showing on the Budget screen

came from the same underlying pattern:

1. legacy or previously merged local data could leave multiple category rows with the same normalized name inside one scope
2. one of those rows could already own the deterministic default-category ID but be archived
3. another row with the same normalized name could still be active and referenced by budgets / expenses / recurring rules
4. the previous repair logic only looked at active rows inside the scope
5. when it tried to recreate the deterministic canonical row, it could insert a row whose `id` already existed in SQLite as an archived row
6. SQLite enforces `categories.id` as a global primary key, so that insert fails with `UNIQUE constraint failed: categories.id`

That same dirty state also explains duplicate category appearance in Budget:
- the scope could contain two category rows with the same logical meaning
- budgets could still point at the non-canonical row
- the Budget screen built rows by category ID, so duplicate logical categories surfaced as duplicate UI rows

## Why Previous Fixes Were Insufficient

Previous fixes addressed parts of the problem, but not the whole category lifecycle.

### Previous gap 1: duplicate repair only considered active rows

In [categoryRepairService.ts](/Users/aic/Desktop/mycostp/expense-tracker/src/services/categoryRepairService.ts), the earlier repair flow queried only:

```sql
SELECT * FROM categories WHERE ownerKey = ? AND deletedAt IS NULL;
```

That meant an archived canonical row was invisible to the repair pass.

If an active duplicate existed at the same normalized name, the old repair logic could try to `INSERT` the deterministic canonical ID again and hit the PK collision.

### Previous gap 2: guest flow skipped full scoped repair

The guest startup path in [useAppRuntime.ts](/Users/aic/Desktop/mycostp/expense-tracker/src/app/useAppRuntime.ts) previously ran:
- invalid scoped default-ID repair
- default seeding

but not the broader duplicate cleanup for the active guest scope.

So duplicate logical categories could persist in guest/local mode.

### Previous gap 3: missing-category repair only repaired expenses

The older `repairMissingCategoryRefs()` fixed only expense references.

It did **not** repair:
- `budgets.categoryId`
- `recurring_expenses.categoryId`

So stale category references could survive in local-only features and keep duplicate/broken rows visible.

### Previous gap 4: Budget screen shaped rows by raw category IDs

[BudgetScreen.tsx](/Users/aic/Desktop/mycostp/expense-tracker/src/screens/BudgetScreen.tsx) previously assembled display rows from:
- active category IDs
- budget category IDs

That meant duplicate logical categories could produce duplicate Budget rows even when the names normalized to the same concept.

## What The Final Fix Changed

### 1. Scoped category repair now works on all rows, not only active rows

[categoryRepairService.ts](/Users/aic/Desktop/mycostp/expense-tracker/src/services/categoryRepairService.ts) now:
- loads all categories for the active `ownerKey`
- groups them by normalized name
- chooses one canonical row per normalized name
- revives the canonical row if needed
- normalizes default-category IDs without inserting into an already-used PK
- repoints `expenses`, `budgets`, and `recurring_expenses`
- deletes duplicate rows

This removes the archived-canonical / active-duplicate collision pattern that caused the PK error.

### 2. Scoped repair now runs for both signed-in and guest startup

[useAppRuntime.ts](/Users/aic/Desktop/mycostp/expense-tracker/src/app/useAppRuntime.ts) now runs scoped duplicate repair in both branches:
- signed-in scope
- guest scope

So duplicate local category state is no longer left untouched in guest/local mode.

### 3. Missing-category repair now covers budgets and recurring rules

`repairMissingCategoryRefs()` now scans references from:
- `expenses`
- `budgets`
- `recurring_expenses`

and repoints all missing category references through the shared category-reference helper.

### 4. Budget screen now groups by normalized category identity as a defensive fallback

[BudgetScreen.tsx](/Users/aic/Desktop/mycostp/expense-tracker/src/screens/BudgetScreen.tsx) now groups display rows by normalized category identity instead of blindly rendering one row per category ID.

That is not the primary fix, but it prevents stale local duplicate IDs from surfacing as duplicate UI rows while cleanup stabilizes older data.

## Root Cause Classification

This was mainly a combination of:
- cleanup/repair issue
- startup ordering / scope coverage issue
- budget query/data-shaping issue

It was **not** mainly a Supabase issue.

It was **not** mainly a pure ownerKey query bug.

It was **not** just a cosmetic Budget UI bug.

## Files Changed For This Fix

- [src/services/categoryRepairService.ts](/Users/aic/Desktop/mycostp/expense-tracker/src/services/categoryRepairService.ts)
- [src/app/useAppRuntime.ts](/Users/aic/Desktop/mycostp/expense-tracker/src/app/useAppRuntime.ts)
- [src/screens/BudgetScreen.tsx](/Users/aic/Desktop/mycostp/expense-tracker/src/screens/BudgetScreen.tsx)

The earlier shared reference migration helper remains part of the solution:
- [src/services/categoryReferenceService.ts](/Users/aic/Desktop/mycostp/expense-tracker/src/services/categoryReferenceService.ts)
- [src/services/loginMergeService.ts](/Users/aic/Desktop/mycostp/expense-tracker/src/services/loginMergeService.ts)
- [src/repositories/categoryRepository.ts](/Users/aic/Desktop/mycostp/expense-tracker/src/repositories/categoryRepository.ts)
- [src/sync/syncService.ts](/Users/aic/Desktop/mycostp/expense-tracker/src/sync/syncService.ts)

## Why Both Bugs Should Stop Happening

### 1. `UNIQUE constraint failed: categories.id`

The new cleanup no longer inserts a deterministic canonical category ID when that ID already exists in archived form inside the same scope.

Instead it:
- uses the existing canonical row
- revives it if necessary
- repoints references from duplicates
- deletes duplicates

That removes the exact collision pattern reproduced in sqlite.

### 2. Duplicate categories in Budget

The new cleanup reduces the scope to one category row per normalized name.

In addition, the Budget screen now groups by normalized category identity, so stale category IDs do not render as duplicate logical rows.
