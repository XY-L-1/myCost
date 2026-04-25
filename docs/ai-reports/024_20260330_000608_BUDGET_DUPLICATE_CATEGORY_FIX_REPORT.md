# Budget Duplicate Category Fix Report

## Why Duplicate Categories Appeared In Budget

The duplicates were not primarily caused by `BudgetRepository.getByMonth()` leaking across scopes.

The duplication came from a combination of:
- duplicate local category rows with the same normalized meaning
- stale budget references pointing to non-canonical category IDs
- Budget screen row shaping by raw category ID instead of normalized logical category identity

## What Was Actually Happening

Before the fix:
- Budget loaded all categories in scope, including archived rows
- it also loaded budgets for the month
- it built one UI row per distinct `categoryId`

If the local DB contained:
- one active category row for `Food`
- one archived or duplicate category row that still carried budget references for `Food`

the screen could render both as separate rows because they had different IDs.

## Did This Come From Duplicate Rows, Archived Rows, Wrong Grouping, Owner Leakage, Or Stale References?

### Duplicate rows
Yes. This was a major contributor.

### Archived rows
Yes. An archived deterministic canonical row plus an active duplicate row was one of the concrete bad states.

### Wrong joins/grouping
Yes. The Budget screen shaped rows by category ID, which exposed dirty duplicate category rows directly.

### OwnerKey leakage
No primary evidence of owner leakage was found in `BudgetRepository`.

### Stale references
Yes. Budgets could still point at duplicate/stale category IDs from earlier category merges or missing-category states.

### Incomplete dedupe
Yes. This was the main data-integrity cause.

## Files Changed

- [src/services/categoryRepairService.ts](/Users/aic/Desktop/mycostp/expense-tracker/src/services/categoryRepairService.ts)
- [src/app/useAppRuntime.ts](/Users/aic/Desktop/mycostp/expense-tracker/src/app/useAppRuntime.ts)
- [src/screens/BudgetScreen.tsx](/Users/aic/Desktop/mycostp/expense-tracker/src/screens/BudgetScreen.tsx)

Supporting shared fix paths already in place and still relevant:
- [src/services/categoryReferenceService.ts](/Users/aic/Desktop/mycostp/expense-tracker/src/services/categoryReferenceService.ts)
- [src/services/loginMergeService.ts](/Users/aic/Desktop/mycostp/expense-tracker/src/services/loginMergeService.ts)
- [src/sync/syncService.ts](/Users/aic/Desktop/mycostp/expense-tracker/src/sync/syncService.ts)
- [src/repositories/categoryRepository.ts](/Users/aic/Desktop/mycostp/expense-tracker/src/repositories/categoryRepository.ts)

## Exact Fix Applied

### 1. Scoped category integrity cleanup

On startup, the app now cleans category duplicates for the active scope by normalized name and collapses them to a single canonical row.

That cleanup:
- revives canonical rows when needed
- repoints budgets / expenses / recurring rules
- deletes duplicate category rows

### 2. Missing-category repair now includes budgets

Old missing-category repair only fixed expenses.

Now it also fixes:
- `budgets.categoryId`
- `recurring_expenses.categoryId`

through the shared category-reference repair helper.

### 3. Budget screen now groups rows by normalized category identity

The Budget screen still loads category rows and budget rows, but it now groups output rows by normalized category meaning rather than category ID alone.

That means:
- multiple stale IDs for the same logical category no longer render as duplicate Budget cards
- amounts are combined under the logical category row

## Was This Only A UI Patch?

No.

The primary fix is in category cleanup and reference repair.

The Budget screen grouping is a defensive presentation-layer fallback so stale duplicate IDs do not reappear in the UI if older data is still being normalized.

## How I Verified It

### Code-path verification

I audited:
- startup repair flow in [useAppRuntime.ts](/Users/aic/Desktop/mycostp/expense-tracker/src/app/useAppRuntime.ts)
- category cleanup in [categoryRepairService.ts](/Users/aic/Desktop/mycostp/expense-tracker/src/services/categoryRepairService.ts)
- Budget row shaping in [BudgetScreen.tsx](/Users/aic/Desktop/mycostp/expense-tracker/src/screens/BudgetScreen.tsx)

### Compile/test verification

- `npm run typecheck` passed
- `npm run test:unit` passed

### Runtime-capability verification

- iOS simulator build/install/open succeeded via `npx expo run:ios -d "iPhone 16e" --port 8081`

## Was The Duplicate-Budget Issue Truly Runtime-Verified?

No.

What was actually proven:
- the data-layer cleanup and Budget grouping code is present
- the app compiles
- the test suite passes
- the app builds and opens on iOS simulator

What was not fully proven:
- a manual on-device Budget screen interaction showing the duplicate rows disappearing after upgrade

So this fix is:
- code-audited
- compile-validated
- build/open validated
- not fully interaction-proven in the exact manual Budget repro
