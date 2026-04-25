# Validation After Budget Fix

## Exact Commands Run

### Code inspection / scope-path audit

```bash
sed -n '1,260p' src/repositories/budgetRepository.ts
sed -n '1,320p' src/app/useAppRuntime.ts
sed -n '1,220p' src/services/loginMergeService.ts
sed -n '1,260p' src/screens/BudgetScreen.tsx
sed -n '1,260p' src/screens/HomeScreen.tsx
sed -n '1,200p' src/hooks/useCurrentScope.ts
sed -n '1,240p' src/auth/authStore.ts
sed -n '618,720p' src/sync/syncService.ts
sed -n '1,260p' src/services/categoryRepairService.ts
sed -n '220,330p' src/repositories/categoryRepository.ts
rg -n "repointCategoryReferences\\(|preferBudgetRecord|includeArchived: true|budgets.forEach\\(|BudgetRepository.getByMonth\\(" src/services src/sync src/screens tests
rg -n "budgets|BudgetRepository|getByMonth\\(|upsert\\(|ownerKey|attachAnonymousDataToUser|signOut|allowAnonymous|categoriesRevision" src | sort
```

What this validated:
- budget repository scope filters
- auth/startup flow relevant to sign-out/sign-in
- screen reload dependencies for Budget and Home
- category merge wiring across login merge, repair, sync, and category management

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

Added/verified relevant regression coverage:
- [tests/budgetMerge.test.mjs](/Users/aic/Desktop/mycostp/expense-tracker/tests/budgetMerge.test.mjs)

### Simulator capability / build validation

```bash
xcrun simctl list devices | rg -n "iPhone 16e|Booted"
npx expo run:ios -d "iPhone 16e" --port 8081
```

Results:
- simulator command succeeded
- `iPhone 16e` was booted
- native iOS build succeeded
- app installed
- app open command succeeded

Observed output included:
- `Build Succeeded`
- `Installing on iPhone 16e`
- `Opening on iPhone 16e (com.anonymous.mycost)`

## What Was Actually Proven

### Proven by execution

- the repo compiles after the fix
- the unit test suite passes after the fix
- the new budget-merge helper compiles and is covered by unit tests
- the app still builds and opens on the iOS simulator

### Proven by code-path audit

- `BudgetRepository` remains owner-scoped
- `useCurrentScope()` still chooses signed-in user scope over guest mode
- `authStore.signOut()` does not delete budgets
- `useAppRuntime()` reruns signed-in startup work after re-login
- category merge paths now all use the same shared reference-repoint helper
- that helper updates expenses, budgets, and recurring rows
- that helper now reconciles same-month budget collisions during category merges
- `BudgetScreen` still includes categories referenced by budgets even if archived
- `HomeScreen` and `BudgetScreen` both reload on scope-driven callback changes and `categoriesRevision`

## What Remains Only Inferred

- the exact user repro `sign in -> confirm budget -> sign out -> sign in again` was not replayed end-to-end in automation
- no live Supabase-authenticated sign-in/sign-out session was executed during this pass
- no live SQLite inspection of the simulator sandbox was completed during this pass
- no manual tap-through proved that an already-affected historical budget row becomes visible again

## Whether The Bug Was Truly Runtime-Proven

No.

This pass reached:
- compile validation
- unit validation
- native build/install/open validation
- code-path analysis

This pass did **not** reach:
- fully interactive authenticated runtime proof of the exact budget-auth-transition repro

## Whether The Current Code Should Fix The Reported Bug

Based on the audited code, yes.

Reason:
- the auth/scope path itself looks correct
- the disappearing-budget behavior is best explained by category merge side effects
- those category merge paths now consistently preserve and reconcile budget references

## Remaining Risk

The remaining risk is historical state, not the current steady-state code path:
- if a previous buggy build already left older rows in a bad state, manual confirmation is still required
- if a prior reinstall or app-container reset happened, the local-only budget may no longer exist to recover
