# Budget Visibility And Data Report

## Short Answer
There are two separate issues here:

1. The startup log `Running migration v1`, `v2`, `v3`, `v4` is strong evidence that the current local SQLite database was fresh or missing its migration history, which means previously local-only budget data may no longer exist in this app container.
2. Independent of that, there was a real code bug where category dedupe/merge logic could hide existing local budgets by changing category identity without repointing budget rows.

I fixed the second issue in code. The first issue points to possible real local data loss if the app sandbox/database was reset.

## What The Migration Log Means

### Evidence
[`runMigrations()`](./src/db/migration.ts) only logs:

```ts
console.log(`Running migration v${migration.version}`);
```

for migrations whose version is greater than the current max version stored in the local `migrations` table.

That means seeing:

- `Running migration v1`
- `Running migration v2`
- `Running migration v3`
- `Running migration v4`

implies:
- `SELECT MAX(version) FROM migrations` effectively returned `0`
- the `migrations` table was absent or empty
- the app did **not** detect a previously migrated local database in this container

### Conclusion
This strongly suggests one of:
- app sandbox / simulator data reset
- reinstall into a fresh container
- local DB file recreation
- a different device/container than the one holding the previous budgets

It does **not** point to migration code deleting budgets in-place. The budget table is only created in migration v4; there is no code in [`src/db/migration.ts`](./src/db/migration.ts) that drops or clears budgets.

## Whether Budget Disappearance Was Caused By Each Candidate

### DB recreation/reset
Status: **strongly supported by the startup log**

Evidence:
- all migrations ran from zero
- local DB file name is fixed at [`expense_tracker.db`](./src/db/database.ts)
- an already-migrated persistent DB would not rerun v1-v4 on that startup

### Scope / ownerKey change
Status: **also a real visibility factor**

Evidence:
- budgets are keyed by `ownerKey` in [`src/repositories/budgetRepository.ts`](./src/repositories/budgetRepository.ts)
- active scope is derived from [`useCurrentScope()`](./src/hooks/useCurrentScope.ts)
- guest mode uses `ownerKey = "guest"`
- signed-in mode uses `ownerKey = userId`

Implication:
- a budget created in guest scope will not show in signed-in scope until guest data is merged
- a budget created in signed-in scope will not show after sign-out if the app is back in guest scope

### Migration / backfill bug
Status: **not supported as the primary cause**

Evidence:
- migration v4 only creates the `budgets` table and unique index
- there is no migration code that deletes or reassigns budgets

### Sign-in / sign-out flow
Status: **can affect visibility**

Evidence:
- [`attachAnonymousDataToUser()`](./src/services/loginMergeService.ts) updates `budgets.ownerKey` from `guest` to the signed-in user on merge
- once signed in, budgets become part of the signed-in local scope
- after sign-out, signed-in budgets do not show in guest scope by design

So sign-in/sign-out can change **which local budgets are visible**, even without data loss.

### Actual data loss
Status: **possible**

If the local DB truly started fresh, budgets that were never synced anywhere else are not recoverable from code alone because budgets are local-only.

### Query bug
Status: **there was a real visibility bug**

Evidence:
- [`mergeLocalCategoryDuplicate()`](./src/sync/syncService.ts) used to repoint only `expenses`
- it did **not** repoint `budgets` or `recurring_expenses`
- budget rows could therefore remain attached to an archived/merged-away category ID
- [`BudgetScreen.tsx`](./src/screens/BudgetScreen.tsx) previously built rows only from currently loaded active categories, so orphaned budget rows could disappear from the UI

## What I Fixed

### 1. Budget/category merge bug
[`src/sync/syncService.ts`](./src/sync/syncService.ts) now repoints:
- `expenses`
- `budgets`
- `recurring_expenses`

when merging duplicate categories locally.

### 2. Budget screen visibility
[`src/screens/BudgetScreen.tsx`](./src/screens/BudgetScreen.tsx) now:
- loads categories with `includeArchived: true`
- unions active category IDs with budget-owned category IDs
- shows budget rows even when the category is archived

That means existing local budget rows are less likely to disappear from the screen just because category cleanup archived or merged their category.

## Whether Existing Local Budget Data Can Be Recovered

### If the old app container/database was reset
Probably **no**, because budgets are local-only and not backed by Supabase in this codebase.

### If the budget rows still exist in the current DB but were hidden by category merges
Possibly **yes**, and this fix is intended to surface them again.

## What The Dirty Category Sync Log Means
The log:

- `[SYNC] Found 10 dirty categories`
- `[SYNC] Pushing category ...`

is consistent with the default category set.

Evidence:
- [`DEFAULT_CATEGORIES`](./src/utils/categoryIdentity.ts) contains 10 categories
- [`ensureDefaultCategories()`](./src/services/categorySeedService.ts) inserts seeded categories with `dirty: 1`
- signed-in runtime then pushes dirty categories in [`useAppRuntime.ts`](./src/app/useAppRuntime.ts)

Conclusion:
- on a fresh DB / first signed-in sync, this log is expected
- it is not by itself proof of another bug
- it would only become suspicious if the same 10 categories stayed dirty on every subsequent startup

## Manual Checks You Should Do

1. Launch the updated app in the same scope where the budgets were expected.
2. Check Budget screen in guest mode and again in signed-in mode if you use both.
3. Look for rows labeled with archived category names.
4. If budgets are still missing, compare whether the app startup log again runs migrations v1-v4.
5. If migrations rerun from zero again, treat that as a fresh-container/local-data-loss issue, not a UI-only issue.

## Honest Bottom Line
- The migration log strongly suggests the currently running app did not see the previous local DB.
- That means previous local-only budgets may truly be gone from this container.
- Separately, there **was** a code bug that could hide budgets when category IDs were merged.
- I fixed that visibility bug, but I cannot honestly claim your previous budgets are recoverable if the old local DB was already reset.
