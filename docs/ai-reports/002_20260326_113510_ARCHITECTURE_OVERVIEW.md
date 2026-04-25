# Architecture Overview

## Purpose

This document explains the current application architecture after the refactor. It is intended for a developer who needs to understand bootstrap flow, navigation, local partitioning, sync behavior, and how the new features fit together.

## High-Level Shape

The app is a local-first React Native / Expo client with:

- Supabase authentication
- SQLite local persistence
- scoped local ownership via `ownerKey`
- optional cloud sync for expenses and categories
- local-only budgets and recurring expenses
- app settings for language and default currency

Primary layers:

- App shell / runtime orchestration
- Navigation
- Screens
- Repositories
- Services
- State stores and contexts
- Settings + i18n
- Shared UI + formatting helpers

## Bootstrap Flow

Entry path:

```text
index.ts
  -> App.tsx
      -> AuthGateProvider
          -> AppShell
              -> useAppRuntime()
              -> SyncGateProvider
              -> I18nProvider
              -> NavigationContainer
                  -> AuthNavigator or RootNavigator
```

### `App.tsx` Responsibilities

`App.tsx` is now a thin shell. It is responsible for:

- owning the temporary `allowAnonymous` flag used for guest mode
- mounting `AuthGateProvider`
- calling `useAppRuntime()` from inside the auth-gate context
- showing the global loading state while app init, auth init, and settings init complete
- showing the global error/retry state when app initialization fails
- selecting the correct navigator:
  - `AuthNavigator` when no signed-in user and guest mode is not enabled
  - `RootNavigator` when a user is signed in or guest mode is active
- resetting navigation state by changing `NavigationContainer.key` across:
  - `user:<id>`
  - `guest`
  - `auth`

`App.tsx` no longer owns the sync pipeline directly.

### `useAppRuntime.ts` Responsibilities

`src/app/useAppRuntime.ts` is the runtime coordinator. It is responsible for:

- initializing:
  - `useAppInitStore`
  - `useAuthStore`
  - `useSettingsStore`
- running the startup workflow once init/auth/settings are ready
- deciding whether startup runs in guest mode or signed-in mode
- exposing sync/runtime status through `SyncGateProvider`
- subscribing to category and expense mutation events
- debouncing mutation-triggered sync pushes
- running periodic background pull for signed-in users
- exposing a `retrySync()` entry point used by UI

## Runtime Modes

The app has three runtime states:

- Auth mode: no signed-in user, no guest mode
- Guest mode: no signed-in user, `allowAnonymous = true`
- Signed-in mode: authenticated Supabase user

## Auth Flow

Auth UI lives in `src/navigation/AuthNavigator.tsx` and the auth screens:

- `AuthEntryScreen`
- `SignInScreen`
- `SignUpScreen`

Flow:

```text
AuthEntry
  -> SignIn
  -> SignUp
  -> Continue as guest
```

`src/auth/authStore.ts`:

- restores the persisted Supabase session on initialize
- subscribes to `supabase.auth.onAuthStateChange`
- exposes `signIn`, `signUp`, and `signOut`

Important behavior:

- signing out clears auth state only
- local SQLite data is not deleted on sign-out
- local isolation is therefore enforced by `ownerKey`-scoped queries, not by clearing the database

## Guest Flow

Guest mode is controlled by `AuthGateProvider` in `src/state/authGateContext.tsx`.

Guest workflow:

```text
AuthEntryScreen
  -> continueAsGuest()
  -> RootNavigator
  -> useCurrentScope() returns guestScope()
  -> all reads/writes use ownerKey = "guest"
```

Guest startup in `useAppRuntime.ts`:

- ensure default categories exist for guest scope
- materialize due recurring expenses for guest scope
- do not run cloud pull/push
- expose sync status as effectively local-only in the UI

## Signed-In Flow

Signed-in startup in `useAppRuntime.ts`:

```text
initialize stores
  -> user session present
  -> build userScope(userId)
  -> attachAnonymousDataToUser(userId)
  -> pullRemoteCategories(userId)
  -> repairLocalCategoryDuplicates(userId, deviceId)
  -> ensureDefaultCategories(scope, deviceId)
  -> pullRemoteExpenses(userId)
  -> repairMissingCategoryRefs(userId, deviceId)
  -> materializeDueRecurringExpenses(scope, deviceId)
  -> pushDirtyCategories(userId)
  -> pushDirtyExpenses(userId)
```

This is the main reconciliation path after sign-in.

## Sync Flow

### Current Remote Sync Scope

Remote sync is implemented only for:

- expenses
- categories

Remote sync is not implemented for:

- budgets
- recurring expenses
- settings

### Mutation Sync

Local writes in expense/category repositories emit mutation events through `src/sync/syncEvents.ts`.

`useAppRuntime.ts` subscribes to those events and:

- debounces changes for 350ms
- pushes dirty categories
- pushes dirty expenses
- updates sync state and `lastSyncAt`

### Background Pull

For signed-in users, `useAppRuntime.ts` runs a 5-minute interval that:

- pulls remote categories
- pulls remote expenses
- updates sync state

### Conflict Resolution

`src/sync/syncService.ts` resolves expense/category conflicts using:

1. `updatedAt`
2. `version`
3. delete state
4. `deviceId`

Categories also have duplicate-repair logic using normalized names.

## `ownerKey` / Local Partitioning Model

`src/domain/dataScope.ts` defines the local partition model:

```text
guestScope()
  ownerKey = "guest"
  userId   = null

userScope(userId)
  ownerKey = userId
  userId   = userId
```

This is the core rule for all local reads and writes.

### Why `ownerKey` Exists

The previous app mixed all local data on device. The new model fixes that by making every local record belong to one explicit owner partition.

### Tables Using `ownerKey`

- `expenses`
- `categories`
- `budgets`
- `recurring_expenses`

### Query Pattern

Repositories receive a `DataScope` and use `buildScopeFilter(scope)`:

```text
WHERE ownerKey = ?
```

This keeps guest data and signed-in user data separate even when both exist in the same SQLite database.

### Merge On Sign-In

`src/services/loginMergeService.ts` moves guest-owned records into the user-owned partition:

- expenses
- categories
- budgets
- recurring expenses

This is a local reassignment step before remote sync.

## Layer Relationships

### Screens

Screens are now responsible mainly for:

- view composition
- form state
- invoking repository/service operations
- responding to focus and sync revision changes

Important screens:

- Home
- Transactions
- Insights
- Budget
- Settings
- Expense editor
- Month detail
- Category transactions
- Category management
- Recurring expenses

### Repositories

Repositories own local SQLite CRUD/query behavior.

Main repositories:

- `ExpenseRepository`
- `CategoryRepository`
- `BudgetRepository`
- `RecurringExpenseRepository`

Repository rules:

- expense/category repositories emit mutation events because those entities participate in cloud sync
- budget/recurring repositories currently do not emit sync events because they are local-only
- repositories accept `DataScope` when the query must be owner-scoped

### Services

Services own multi-step domain workflows:

- `loginMergeService.ts`
- `categorySeedService.ts`
- `categoryRepairService.ts`
- `recurringExpenseService.ts`
- `syncService.ts`

Typical service responsibilities:

- merge records across scopes
- repair duplicates
- ensure deterministic category defaults
- materialize due recurring expenses
- push/pull remote expense/category data

### State / Context / Settings / i18n

```text
Zustand stores
  useAuthStore
  useAppInitStore
  useSettingsStore

React contexts
  AuthGateContext
  SyncGateContext
  I18nContext
```

- `useAuthStore`: Supabase auth session/user state
- `useAppInitStore`: device bootstrap state such as device ID and DB readiness
- `useSettingsStore`: persisted language and preferred currency
- `AuthGateContext`: guest-mode toggle state
- `SyncGateContext`: sync/runtime status shared with UI
- `I18nProvider`: translation lookup and interpolation

### Shared UI And Formatting

Reusable UI primitives live in `src/components`.

Formatting is centralized through:

- `src/utils/date.ts`
- `src/utils/formatting.ts`
- `src/hooks/useFormatters.ts`

This avoids screen-specific currency/date logic.

## Navigation Structure

Top-level navigation:

```text
AuthNavigator
  AuthEntry
  SignIn
  SignUp

RootNavigator (stack)
  Tabs
  ExpenseEditor (modal)
  MonthDetail
  CategoryTransactions
  Categories
  RecurringExpenses
```

Tabs:

```text
Tabs
  HomeTab         -> HomeScreen
  TransactionsTab -> ExpenseListScreen
  InsightsTab     -> MonthlySummaryScreen
  BudgetTab       -> BudgetScreen
  SettingsTab     -> SettingsScreen
```

Navigation intent:

- fast tab access for major product areas
- modal expense editor from multiple entry points
- stack drill-down for analytics and management flows

## Budget Integration

Budget support is currently local-first and local-only.

Integration points:

- schema in `src/db/migration.ts`
- model in `src/types/budget.ts`
- storage in `src/repositories/budgetRepository.ts`
- UI in `src/screens/BudgetScreen.tsx`
- budget totals surfaced on `HomeScreen.tsx`

Current behavior:

- budgets are defined by `categoryId + monthKey`
- one budget amount per category per month
- Budget screen compares budget vs actual by category
- Home screen shows aggregate budget left for current month

Current limitation:

- no cloud sync
- no notifications
- no rollover logic

## Recurring Expense Integration

Recurring support is also local-first and local-only.

Integration points:

- schema in `src/db/migration.ts`
- model in `src/types/recurringExpense.ts`
- storage in `src/repositories/recurringExpenseRepository.ts`
- materialization in `src/services/recurringExpenseService.ts`
- UI in `src/screens/RecurringExpensesScreen.tsx`

Current behavior:

- recurring rules store title, amount, category, currency, frequency, and next due date
- runtime startup materializes any due recurring items into real expenses
- recurring rules can be activated/deactivated
- home screen counts currently due recurring entries

Current limitation:

- no cloud sync
- no richer edit/remove flow in UI
- no preview calendar or notifications

## Category Management Integration

Category management is now a first-class flow.

Integration points:

- repository: `src/repositories/categoryRepository.ts`
- repair/seed logic: `src/services/categoryRepairService.ts`, `src/services/categorySeedService.ts`
- management UI: `src/screens/CategoryManagementScreen.tsx`
- transaction editor entry point: `AddExpenseScreen.tsx` -> `Categories`
- settings entry point: `SettingsScreen.tsx` -> `Categories`

Current behavior:

- create category
- rename category
- archive category
- restore archived category
- archived categories remain visible in history queries when requested

Current limitation:

- no category reassignment wizard before archive
- localized fallback repair category still uses the internal label `"Other"`

## Mental Model For Future Work

If you are changing the app, use this model:

1. Decide which scope owns the data: guest or current user
2. Keep local reads/writes inside repositories using `DataScope`
3. Put multi-step flows in services, not in screens
4. Put app lifecycle and sync orchestration in `useAppRuntime.ts`, not `App.tsx`
5. Put shared visual building blocks in `src/components`
6. Put user-visible strings in `src/i18n/resources.ts`
7. Only assume remote support for expenses and categories unless backend/schema changes are added

## Known Architectural Limits

- `useAppRuntime.ts` is much better than the previous `App.tsx`, but it is still a large coordinator and could eventually be split further
- Budgets and recurring expenses are not integrated into remote sync
- Validation coverage is still weighted toward unit/domain logic, not screen/integration behavior
- Loading/retry text before the full app shell mounts is not yet translated
