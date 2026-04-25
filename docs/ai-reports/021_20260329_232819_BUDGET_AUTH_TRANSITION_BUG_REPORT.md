# Budget Auth Transition Bug Report

## Exact Root Cause

The disappearing-budget bug was not caused by `BudgetRepository.getByMonth()` using the wrong `ownerKey`, and it was not caused by sign-out clearing budget rows.

The primary failure mode was category-reference drift during signed-in startup repair/sync flows:

1. On sign-in, `useAppRuntime.ts` reruns category normalization and duplicate-repair paths.
2. Those paths can merge a duplicate category ID into a canonical category ID.
3. A budget row is local-only and keyed by `ownerKey + categoryId + monthKey`.
4. Earlier code paths did not consistently handle budget references during category merges:
   - an older sync path repointed only expenses, not budgets
   - even after budget repointing was added, merge paths still assumed there could not already be a budget on the canonical category for the same month
5. That meant a budget could become effectively detached from the category the UI expected, or hit a same-month category-merge collision and be left in an inconsistent state.

In other words:
- the budget row was not supposed to be deleted on sign-out
- the active auth scope was not the main bug
- the bug was caused by category-ID merge behavior during auth-transition startup work

## Why The Repro Fits This Root Cause

Repro:
1. Sign in
2. Budget is visible
3. Sign out
4. Sign in again
5. Budget disappears

That sequence re-runs signed-in startup logic in [useAppRuntime.ts](/Users/aic/Desktop/mycostp/expense-tracker/src/app/useAppRuntime.ts), including:
- guest merge preparation
- remote category pull
- invalid default-ID repair
- local duplicate-category repair
- default category seeding

Those are exactly the places where category IDs can be normalized or merged again.

## Files Changed

- [src/services/categoryReferenceService.ts](/Users/aic/Desktop/mycostp/expense-tracker/src/services/categoryReferenceService.ts)
- [src/domain/budgetMerge.ts](/Users/aic/Desktop/mycostp/expense-tracker/src/domain/budgetMerge.ts)
- [src/services/loginMergeService.ts](/Users/aic/Desktop/mycostp/expense-tracker/src/services/loginMergeService.ts)
- [src/services/categoryRepairService.ts](/Users/aic/Desktop/mycostp/expense-tracker/src/services/categoryRepairService.ts)
- [src/sync/syncService.ts](/Users/aic/Desktop/mycostp/expense-tracker/src/sync/syncService.ts)
- [src/repositories/categoryRepository.ts](/Users/aic/Desktop/mycostp/expense-tracker/src/repositories/categoryRepository.ts)
- [tsconfig.tests.json](/Users/aic/Desktop/mycostp/expense-tracker/tsconfig.tests.json)
- [tests/budgetMerge.test.mjs](/Users/aic/Desktop/mycostp/expense-tracker/tests/budgetMerge.test.mjs)

## What Was Fixed

### 1. Centralized category-reference repointing

All major category-merge paths now use a single helper:
- [src/services/categoryReferenceService.ts](/Users/aic/Desktop/mycostp/expense-tracker/src/services/categoryReferenceService.ts)

That helper now updates:
- `expenses`
- `budgets`
- `recurring_expenses`

for category-ID merges within a given `ownerKey`.

### 2. Budget collision handling during category merges

When a duplicate category is merged into a canonical category, the helper now detects whether a budget already exists for:
- the same `ownerKey`
- the canonical category
- the same `monthKey`

If both source and canonical budget rows exist, it:
- keeps one canonical row
- picks the preferred row deterministically by newest `updatedAt`, then `createdAt`, then `id`
- deletes the duplicate row

This prevents category-merge operations from leaving duplicate monthly budgets behind or relying on a blind `UPDATE budgets SET categoryId = ?` that can collide.

### 3. All relevant merge paths now use the same logic

The shared helper is now used by:
- login merge in [src/services/loginMergeService.ts](/Users/aic/Desktop/mycostp/expense-tracker/src/services/loginMergeService.ts)
- local category repair in [src/services/categoryRepairService.ts](/Users/aic/Desktop/mycostp/expense-tracker/src/services/categoryRepairService.ts)
- signed-in category sync dedupe in [src/sync/syncService.ts](/Users/aic/Desktop/mycostp/expense-tracker/src/sync/syncService.ts)
- category restore/merge in [src/repositories/categoryRepository.ts](/Users/aic/Desktop/mycostp/expense-tracker/src/repositories/categoryRepository.ts)

## What This Means For Existing Budget Rows

The most likely pre-fix behavior was:
- the budget row still existed in SQLite
- but it was tied to a category reference that had been merged/archived/replaced during startup
- so the app behaved as if the budget had disappeared

This bug is better described as:
- hidden or inconsistently referenced budget data

not:
- deliberate budget deletion
- wrong `ownerKey` on normal signed-in reads
- sign-out clearing local budget rows

## How The Fix Prevents Recurrence

The current code now guarantees that category merges do not ignore budget references.

When category IDs are consolidated:
- budget rows are migrated to the canonical category ID
- duplicate monthly budget rows are reconciled instead of left conflicting
- the same logic is reused across auth merge, repair, sync, and category-management flows

## Whether Old Local Data Could Still Trigger Edge Cases

Yes, but the remaining risk is narrower now.

Possible edge cases:
- a user already hit the old bug and now has historic rows under an old duplicate category ID
- a previous install may have been reinstalled or had a fresh local DB, which code cannot recover
- if two conflicting budget rows existed for the same logical category/month, the new code now resolves them by deterministic preference rather than preserving both values

What the current fix can do:
- make still-existing local rows visible and consistent again if they remain in SQLite

What the current fix cannot do:
- recover data from a deleted app container or recreated local database

## Honest Validation Status

This pass proved the code path and the merge wiring.

It did **not** fully runtime-prove the exact user repro end-to-end with live sign-in/sign-out interaction.

See:
- [VALIDATION_AFTER_BUDGET_FIX.md](/Users/aic/Desktop/mycostp/expense-tracker/VALIDATION_AFTER_BUDGET_FIX.md)
