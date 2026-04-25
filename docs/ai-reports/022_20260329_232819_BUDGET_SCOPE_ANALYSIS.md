# Budget Scope Analysis

## Scope Model

Budgets are local-only records stored in SQLite.

They are scoped by:
- `ownerKey`
- `userId` nullable mirror
- `categoryId`
- `monthKey`

Relevant schema:
- [src/db/migration.ts](/Users/aic/Desktop/mycostp/expense-tracker/src/db/migration.ts)
- unique index: `(ownerKey, categoryId, monthKey)`

## How Budget Scope Is Assigned

### Guest scope

When the app is in guest mode:
- `useCurrentScope()` returns `guestScope()`
- `ownerKey = "guest"`
- `userId = null`

Relevant file:
- [src/hooks/useCurrentScope.ts](/Users/aic/Desktop/mycostp/expense-tracker/src/hooks/useCurrentScope.ts)

### Signed-in scope

When the user is authenticated:
- `useCurrentScope()` returns `userScope(auth.user.id)`
- `ownerKey = auth.user.id`
- `userId = auth.user.id`

Relevant files:
- [src/hooks/useCurrentScope.ts](/Users/aic/Desktop/mycostp/expense-tracker/src/hooks/useCurrentScope.ts)
- [src/domain/dataScope.ts](/Users/aic/Desktop/mycostp/expense-tracker/src/domain/dataScope.ts)

## Budget Query Behavior

### Repository reads

[src/repositories/budgetRepository.ts](/Users/aic/Desktop/mycostp/expense-tracker/src/repositories/budgetRepository.ts)

Current behavior:
- `getByMonth(scope, monthKey)` filters by `ownerKey = scope.ownerKey`
- `findByCategoryAndMonth(scope, categoryId, monthKey)` filters by `ownerKey = scope.ownerKey`
- `upsert(scope, input)` writes the active scope’s `ownerKey` and `userId`

Conclusion:
- current budget repository reads and writes are scope-aware
- I did not find a direct repository bug where a signed-in budget is queried from the guest scope or vice versa

## Sign-Out / Sign-In Transition Analysis

### Sign-out

[src/auth/authStore.ts](/Users/aic/Desktop/mycostp/expense-tracker/src/auth/authStore.ts)

Current behavior:
- `signOut()` clears auth session/user state
- it does **not** delete SQLite budget rows

Conclusion:
- sign-out alone should not delete budgets

### Re-login

[src/app/useAppRuntime.ts](/Users/aic/Desktop/mycostp/expense-tracker/src/app/useAppRuntime.ts)

On signed-in startup, the app runs:
1. `attachAnonymousDataToUser()`
2. `pullRemoteCategories()`
3. `repairInvalidScopedDefaultCategoryIds()`
4. `repairLocalCategoryDuplicates()`
5. `ensureDefaultCategories()`
6. `pullRemoteExpenses()`
7. `repairMissingCategoryRefs()`
8. `materializeDueRecurringExpenses()`
9. `pushDirtyCategories()`
10. `pushDirtyExpenses()`

Conclusion:
- re-login does not directly reload budgets from backend
- budgets stay local
- the risky part is category merge/repair, because budgets reference categories

## Guest-To-User Merge Analysis

[src/services/loginMergeService.ts](/Users/aic/Desktop/mycostp/expense-tracker/src/services/loginMergeService.ts)

Current behavior:
- guest budgets are promoted with:
  - `userId = userId`
  - `ownerKey = userId`
  - `updatedAt = now`

Conclusion:
- the merge service does explicitly move guest budgets into the signed-in scope
- that path is not the direct cause of a same-user sign-out/sign-in disappearance when no new guest budget was created

## Why Scope Was Not The Main Bug

I audited:
- [src/repositories/budgetRepository.ts](/Users/aic/Desktop/mycostp/expense-tracker/src/repositories/budgetRepository.ts)
- [src/hooks/useCurrentScope.ts](/Users/aic/Desktop/mycostp/expense-tracker/src/hooks/useCurrentScope.ts)
- [src/auth/authStore.ts](/Users/aic/Desktop/mycostp/expense-tracker/src/auth/authStore.ts)
- [src/state/authGateContext.tsx](/Users/aic/Desktop/mycostp/expense-tracker/src/state/authGateContext.tsx)
- [src/screens/BudgetScreen.tsx](/Users/aic/Desktop/mycostp/expense-tracker/src/screens/BudgetScreen.tsx)
- [src/screens/HomeScreen.tsx](/Users/aic/Desktop/mycostp/expense-tracker/src/screens/HomeScreen.tsx)

Findings:
- scope selection correctly prefers the authenticated user over guest mode
- budget reads are scope-filtered
- `BudgetScreen` and `HomeScreen` both refetch on scope-driven callback changes and `categoriesRevision`

So the budget disappearance is better explained by category reference inconsistency than by the wrong active scope.

## Screen Reload Analysis

### BudgetScreen

[src/screens/BudgetScreen.tsx](/Users/aic/Desktop/mycostp/expense-tracker/src/screens/BudgetScreen.tsx)

Reload triggers:
- `useEffect(..., [categoriesRevision, load])`
- `useFocusEffect`
- `load` depends on `scope`, `monthKey`, `t`

### HomeScreen

[src/screens/HomeScreen.tsx](/Users/aic/Desktop/mycostp/expense-tracker/src/screens/HomeScreen.tsx)

Reload triggers:
- `useEffect(..., [categoriesRevision, load])`
- `useFocusEffect`
- `load` depends on `scope`, `monthKey`, `todayKey`

Conclusion:
- I did not find an obvious stale-screen bug where budgets fail to refetch after auth transitions

## Current Technical Conclusion

The most accurate explanation is:
- budget rows were not primarily disappearing because of the wrong `ownerKey`
- budget rows were becoming hidden or inconsistent because category merge flows during signed-in startup were not robust enough for local-only budgets

## Current Recovery Outlook

If the budget row still exists in SQLite:
- the current fix should make it much more likely to remain associated with the canonical category and remain visible

If the old row was lost because the local DB was reset or the app container changed:
- the current code cannot recover that data

## What Still Requires Manual Confirmation

Manual confirmation is still required for:
- same-user sign-out -> sign-in on a real device/simulator
- confirming the budget remains visible in both Home and Budget screens
- confirming no runtime sync/repair error is triggered during the transition
