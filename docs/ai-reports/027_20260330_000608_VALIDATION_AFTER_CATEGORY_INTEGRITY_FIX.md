# Validation After Category Integrity Fix

## Exact Commands Run

### Source inspection

```bash
sed -n '1,280p' src/db/migration.ts
sed -n '1,320p' src/repositories/categoryRepository.ts
sed -n '1,220p' src/repositories/budgetRepository.ts
sed -n '1,220p' src/services/categorySeedService.ts
sed -n '1,360p' src/services/categoryRepairService.ts
sed -n '1,260p' src/services/loginMergeService.ts
sed -n '1,260p' src/app/useAppRuntime.ts
sed -n '1,240p' src/screens/BudgetScreen.tsx
sed -n '1,240p' src/services/categoryReferenceService.ts
sed -n '1,260p' src/utils/categoryIdentity.ts
rg -n "repairLocalCategoryDuplicates\\(scope|repairMissingCategoryRefs\\(scope|includeArchived: true|normalizeCategoryName|repointCategoryReferences\\(" src/app/useAppRuntime.ts src/screens/BudgetScreen.tsx src/services/categoryRepairService.ts src/services/categorySeedService.ts src/services/loginMergeService.ts src/repositories/categoryRepository.ts src/sync/syncService.ts
```

What this validated:
- current startup ordering
- scoped category cleanup wiring
- default-ID strategy
- Budget row shaping
- category-reference repair wiring across login merge, runtime cleanup, sync, and category management

### Type validation

```bash
npm run typecheck
```

Result:
- passed

### Unit validation

```bash
npm run test:unit
```

Result:
- passed
- 9 tests passed, 0 failed

### Sqlite root-cause reproduction

I ran a temporary sqlite reproduction that created:
- one archived canonical `Food` category row
- one active duplicate `Food` category row in the same scope
- one budget referencing the duplicate row

Then I executed:
- the old-style canonical insert
- the new-style revive/repoint/delete cleanup pattern

Observed result:
- old-style insert failed with `UNIQUE constraint failed: categories.id`
- cleanup pattern left one active canonical category row and repointed the budget successfully

Actual observed sqlite output included:

```text
OLD_REPAIR_INSERT_RESULT
Error: stepping, UNIQUE constraint failed: categories.id (19)
after_categories|canon-food|Food|ACTIVE
after_budgets|budget-1|canon-food|2026-03|15000
```

What this validates:
- the collision root cause is real and reproducible
- the corrected cleanup strategy addresses that concrete collision pattern

### iOS simulator / native build validation

```bash
xcrun simctl list devices | rg -n "iPhone 16e|Booted"
npx expo run:ios -d "iPhone 16e" --port 8081
```

Result:
- simulator was booted
- native iOS build succeeded
- app installed
- app open command succeeded

Observed output included:
- `Build Succeeded`
- `Installing on iPhone 16e`
- `Opening on iPhone 16e (com.anonymous.mycost)`

## What Was Actually Validated

### Validated by execution

- TypeScript compile passes after the integrity fix
- unit test suite passes after the integrity fix
- sqlite reproduction confirms the old collision pattern and the new cleanup approach
- iOS app still builds, installs, and opens on simulator after the fix

### Validated by code audit

- guest startup now runs scoped duplicate cleanup
- signed-in startup now runs scoped duplicate cleanup
- missing-category repair now includes budgets and recurring rules
- category cleanup works on all rows in scope, not only active rows
- Budget screen groups duplicate logical categories by normalized identity

## What Is Still Only Inferred

- the exact live runtime collision path from the user’s manual app state was not replayed end-to-end through the real app
- the exact Budget duplicate-category repro was not manually re-tapped on device in this environment
- live Supabase-authenticated sign-in/sign-out flows were not replayed during this pass
- a real existing dirty on-device SQLite file was not directly inspected

## Was The Exact Runtime Collision Path Replayed?

No.

What was replayed instead:
- the same collision class was reproduced directly in sqlite
- the fixed app compiled
- the fixed app built and opened on iOS simulator

So the exact end-to-end runtime repro is still not fully interaction-proven here.

## Was The Budget Duplicate-Category Issue Truly Runtime-Verified?

No.

It was:
- code-audited
- data-path hardened
- compile/test validated

but not fully interaction-verified on a live Budget screen session in this environment.

## Honest Conclusion

I can now explain why both issues should stop happening:

1. `UNIQUE constraint failed: categories.id`
   - fixed by collapsing duplicate normalized categories against existing canonical rows instead of blindly recreating canonical IDs

2. duplicate categories in Budget
   - fixed by startup cleanup of duplicate category rows and by normalized Budget-row grouping as a defensive fallback

The remaining gap is not understanding the root cause anymore. The remaining gap is live interaction proof on the exact user state.
