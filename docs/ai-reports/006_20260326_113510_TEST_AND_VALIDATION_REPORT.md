# Test And Validation Report

## Summary

This report separates what was actually executed from what was validated only through code inspection.

What was executed in this environment:

- TypeScript type validation
- Node-based unit validation
- targeted code-audit commands (`sed`, `rg`, `cat`)

What was not executed in this environment:

- Expo runtime
- iOS simulator
- Android emulator/device
- live Supabase sign-in/sync flows

## Exact Commands Run

### Static / Code Audit Commands

These were run to re-check bootstrap flow, navigation wiring, owner-scoped queries, merge logic, drill-down integration, and translation coverage:

```bash
sed -n '1,260p' App.tsx
sed -n '1,320p' src/app/useAppRuntime.ts
sed -n '1,320p' src/navigation/RootNavigator.tsx
sed -n '1,220p' src/navigation/AuthNavigator.tsx
sed -n '1,320p' src/domain/dataScope.ts
sed -n '1,360p' src/db/migration.ts
sed -n '1,360p' src/repositories/categoryRepository.ts
sed -n '1,420p' src/repositories/expenseRepository.ts
sed -n '1,280p' src/services/loginMergeService.ts
sed -n '1,340p' src/screens/MonthlySummaryScreen.tsx
sed -n '1,340p' src/screens/MonthDetailScreen.tsx
sed -n '1,340p' src/screens/CategoryTransactionsScreen.tsx
sed -n '1,360p' src/screens/HomeScreen.tsx
sed -n '1,380p' src/screens/CategoryManagementScreen.tsx
sed -n '1,360p' src/screens/ExpenseListScreen.tsx
sed -n '1,360p' src/screens/AddExpenseScreen.tsx
sed -n '1,360p' src/screens/SettingsScreen.tsx
sed -n '1,360p' src/screens/BudgetScreen.tsx
sed -n '1,380p' src/screens/RecurringExpensesScreen.tsx
sed -n '1,340p' src/repositories/budgetRepository.ts
sed -n '1,420p' src/repositories/recurringExpenseRepository.ts
sed -n '1,340p' src/services/recurringExpenseService.ts
sed -n '1,340p' src/i18n/resources.ts
sed -n '1,340p' src/auth/authStore.ts
sed -n '1,320p' src/settings/settingsStore.ts
sed -n '1,320p' src/i18n/i18n.tsx
sed -n '1,260p' src/hooks/useCurrentScope.ts
sed -n '1,260p' src/state/syncGateContext.tsx
sed -n '1,260p' src/sync/syncService.ts
sed -n '260,620p' src/sync/syncService.ts
rg -n '"[A-Za-z][^"]*"' src App.tsx --glob '!src/i18n/resources.ts' --glob '!src/theme/*' --glob '!src/types/*' --glob '!src/utils/*' --glob '!src/navigation/RootNavigator.tsx' --glob '!src/navigation/AuthNavigator.tsx'
cat package.json
sed -n '1,260p' tests/expenseMutations.test.mjs
sed -n '1,260p' tests/dataScope.test.mjs
sed -n '1,260p' tests/date.test.mjs
```

### Type Validation Command

```bash
npm run typecheck
```

What it validates:

- TypeScript compile correctness across the application code
- import/export wiring
- navigation param typing compatibility
- screen/component prop type compatibility
- general type-level regressions

Result:

- Passed

### Unit Validation Command

```bash
npm run test:unit
```

What it validates:

- owner-scope helper behavior
- local date key behavior
- month shifting logic
- recurring date advancement logic
- soft-delete metadata mutation behavior

Result:

- Passed

## Validation By Category

## Static Validation

### What Was Validated

- App bootstrap flow in `App.tsx`
- runtime sequencing in `src/app/useAppRuntime.ts`
- auth navigator and main navigator wiring
- owner-scoped migration columns and indexes
- repository queries for `ownerKey`
- guest-to-user merge SQL updates
- month drill-down and category drill-down navigation links
- presence and structure of translation resources
- screen-level integration points for budgets, recurring expenses, settings, and category management

### What This Means

These behaviors were verified by reading the current code paths and checking that the modules are wired together consistently.

### What Static Validation Does Not Prove

- that the screens render correctly on device
- that navigation transitions succeed at runtime without platform-specific issues
- that Supabase auth/sync succeeds against a live backend
- that migrations behave correctly on an existing installed app database

## Type Validation

### Command

```bash
npm run typecheck
```

### What Was Validated

- screens compile against the current navigation param lists
- hooks, stores, repositories, and services compile together
- new models (`budget`, `recurringExpense`) compile cleanly
- deleted file references were cleaned up enough to satisfy TS

### What Was Not Validated

- runtime-only issues that TypeScript cannot see
- incorrect SQL text
- incorrect Supabase table/policy configuration

## Unit Validation

### Command

```bash
npm run test:unit
```

### Tests Covered

- `tests/dataScope.test.mjs`
  - guest scope owner key
  - user scope owner key
  - deterministic SQL scope filter
- `tests/date.test.mjs`
  - local date/month key formatting
  - month shifting across year boundary
  - next recurring date calculation
- `tests/expenseMutations.test.mjs`
  - delete mutation updates `deletedAt`, `updatedAt`, `version`, and `dirty`

### What Unit Validation Did Not Cover

- live SQLite repository operations
- live migration execution
- navigation behavior
- form interaction behavior
- sync conflict resolution end to end
- guest -> signed-in merge end to end
- live language switching through rendered screens

## Runtime Validation

### Actually Executed

- None inside Expo/iOS/Android runtime

### Inferred From Code

- `App.tsx` correctly mounts `AuthGateProvider` before calling `useAppRuntime()`
- main app vs auth navigator selection is keyed by user/guest/auth state
- `useAppRuntime.ts` now pulls both categories and expenses in background signed-in sync
- month drill-down and category drill-down routes exist in `RootNavigator`
- budget and recurring screens are reachable from tabs/settings flows

### Important Caveat

All runtime conclusions above are code-inferred, not simulator/device-confirmed.

## UI / Device Validation

### Performed

- None

### Not Performed

- iOS simulator launch
- Android emulator launch
- physical device launch
- screen reader checks
- keyboard and date picker behavior checks on device
- translated layout checks in both languages

### What Still Needs Device Verification

- modal expense editor and date picker behavior on iOS and Android
- tab bar spacing and safe-area layout
- long category chip wrapping and scrolling
- translated label overflow
- settings language switch persistence across cold launch
- sync status visibility and retry affordances

## Explicit Re-Check Results

## 1. App Bootstrap Flow And Navigation Wiring

### Validated

- `App.tsx` now keeps only shell concerns
- `useAppRuntime()` is called inside `AuthGateProvider`, which is the correct provider order
- `NavigationContainer` chooses `RootNavigator` for signed-in or guest flows and `AuthNavigator` otherwise
- `RootNavigator` contains the required five tabs plus detail/management routes

### Remaining Gap

- The app-loading and retry copy shown before the full app shell is mounted is not yet translated

## 2. Migrations And Repository Queries For `ownerKey`

### Validated

- migration v3 adds `ownerKey` to `expenses` and `categories` and backfills from `userId` or `"guest"`
- migration v4 creates `budgets` and `recurring_expenses` with `ownerKey`
- `ExpenseRepository.list`, `getMonthlyTotal`, `getMonthlyCategoryBreakdown`, and `getAvailableMonthKeys` are owner-scoped
- `CategoryRepository.getAll` is owner-scoped
- `BudgetRepository` and `RecurringExpenseRepository` are owner-scoped

### Remaining Gap

- `getById` methods on expense/category/recurring repositories remain id-only convenience lookups rather than owner-scoped lookups

## 3. Guest -> Signed-In Merge Flow

### Validated

- `attachAnonymousDataToUser(userId)` updates:
  - `expenses`
  - `categories`
  - `budgets`
  - `recurring_expenses`
- `useAppRuntime.ts` calls this merge before remote pull/push in signed-in startup

### Remaining Gap

- This merge path was not exercised against a live local DB + auth transition in this environment

## 4. Month Drill-Down And Category Drill-Down Integration

### Validated

- `MonthlySummaryScreen` navigates to `MonthDetail` and `CategoryTransactions`
- `MonthDetailScreen` navigates to `CategoryTransactions`
- `CategoryTransactionsScreen` filters expenses by both `monthKey` and `categoryId`
- `RootNavigator` declares both routes

### Remaining Gap

- Tap execution and back-navigation behavior were not validated on device

## 5. Language Switching Coverage And Remaining Hardcoded Strings

### Validated

- Most screen strings are sourced from `src/i18n/resources.ts`
- `SettingsScreen` persists language choice through `useSettingsStore`
- formatting hooks can react to locale-related settings

### Remaining Hardcoded User-Facing Strings Found

- `App.tsx`
  - `"Preparing your workspace..."`
  - `"Retry"`
- `src/screens/SignInScreen.tsx`
  - fallback `"Sign in failed"`
- `src/screens/SignUpScreen.tsx`
  - fallback `"Sign up failed"`
  - fallback `"Verification not complete yet"`
- `src/services/categoryRepairService.ts`
  - fallback category name `"Other"`

### Additional Notes

- `SettingsScreen` uses `"English"` and `"简体中文"` directly for language buttons. This is intentional and acceptable as native language labels.
- `src/debug/insertTestExpense.ts` also contains hardcoded text, but it is debug-only code.

## 6. Budget And Recurring Wiring

### Validated

- Budget tab is wired and reads/writes local budgets by scope
- Home screen reads budget totals for current month
- Recurring management screen is wired from Settings
- runtime materializes due recurring rules at startup

### Current State

- Budgets: wired, functional, local-only
- Recurring expenses: wired, functional, local-only

### Remaining Gaps

- No backend sync support for budgets
- No backend sync support for recurring expenses
- No richer recurring edit/delete flow yet
- No budget alerts/rollover logic

## Flows Actually Validated vs Inferred

### Actually Validated By Executed Commands

- TypeScript compile passes
- Unit tests for scope/date/delete rules pass
- Route declarations exist for month/category drill-down and settings management flows
- Owner-scoped query patterns are present in code
- Guest-to-user merge includes budgets and recurring items in code
- Translation resources exist for English and Simplified Chinese

### Not Actually Validated, Only Inferred From Code

- guest mode works correctly on a running device
- sign-in flow completes successfully with Supabase
- guest data appears after sign-in in a live session
- month drill-down renders correctly and is tappable
- category drill-down shows the expected transactions on device
- language switching updates all screens correctly at runtime
- budget and recurring flows feel polished in real interaction

## Remaining Risk Areas

- Runtime behavior has not been verified on iOS/Android
- Sync correctness is still lightly tested and depends on live backend state/policies
- Translation coverage is not fully complete
- `ownerKey` is strong for scoped list/query flows, but id-only convenience lookups should be monitored in future changes
- Budgets and recurring expenses are intentionally local-only until backend support exists

## Recommended Next Validation Steps

1. Launch the app in guest mode and verify create/edit/delete expense flows.
2. Create guest data, then sign in and verify merge behavior in a live session.
3. Verify month drill-down and category drill-down navigation on device.
4. Switch between English and Simplified Chinese and review every main screen.
5. Verify budget and recurring flows on device, including app relaunch materialization for recurring items.
6. Add DB-backed integration tests for repositories and merge logic.
7. Add sync integration tests or a backend-mocked test harness for remote expense/category flows.
