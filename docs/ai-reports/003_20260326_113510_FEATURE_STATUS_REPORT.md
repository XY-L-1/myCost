# Feature Status Report

This report reflects the current code in the repository.

Status values used:

- Implemented
- Partial
- Local-only
- Needs backend support
- Needs more validation

## Core App Foundation

| Feature | Status | Description | Entry Screens | Dependent Modules | How To Test | Known Limitations |
| --- | --- | --- | --- | --- | --- | --- |
| App bootstrap and mode selection | Implemented | App initializes device/app state, auth state, settings, then chooses auth vs main app navigator | `App.tsx` | `src/app/useAppRuntime.ts`, `src/state/appInitStore.ts`, `src/auth/authStore.ts`, `src/settings/settingsStore.ts` | Launch with no session, with guest mode, and with signed-in session | Device execution was not performed in this environment |
| Guest mode | Implemented | User can enter the app without signing in and operate against guest-scoped local data | `AuthEntryScreen` | `src/state/authGateContext.tsx`, `src/hooks/useCurrentScope.ts`, `src/domain/dataScope.ts` | Start app, continue as guest, create expenses/categories/budgets/recurring items | Verified by code and scope tests, not by simulator |
| Signed-in auth flow | Partial | Email/password sign-in and sign-up exist and auth state listens to Supabase events | `AuthEntryScreen`, `SignInScreen`, `SignUpScreen` | `src/auth/authStore.ts`, `src/auth/supabaseClient.ts` | Sign up, verify email, sign in, sign out | End-to-end auth was not executed against a live backend here |
| Local data partitioning by owner | Implemented | Guest and signed-in data are partitioned through `ownerKey` | Any screen using data | `src/domain/dataScope.ts`, repositories, `src/db/migration.ts` | Create guest data, sign in, inspect owner-scoped queries | Validated by code review and unit tests, not live DB scenario replay |
| Guest to signed-in merge | Needs more validation | Guest-owned expenses/categories/budgets/recurring items are reassigned to the user on sign-in | Implicit during sign-in startup | `src/services/loginMergeService.ts`, `src/app/useAppRuntime.ts` | Create guest data, sign in, confirm same data appears in signed-in scope | Logic is wired in code; no live integration test was run |

## Transactions

| Feature | Status | Description | Entry Screens | Dependent Modules | How To Test | Known Limitations |
| --- | --- | --- | --- | --- | --- | --- |
| Create expense | Implemented | User can create a new expense with amount, description, category, and date | `HomeScreen`, `ExpenseListScreen` -> `ExpenseEditor` | `src/screens/AddExpenseScreen.tsx`, `src/repositories/expenseRepository.ts` | Add an expense in guest mode and signed-in mode | No device QA was run for picker behavior |
| Edit expense | Implemented | Existing expense can be edited in the same editor flow | `HomeScreen`, `ExpenseListScreen` -> `ExpenseEditor` | `src/screens/AddExpenseScreen.tsx`, `src/repositories/expenseRepository.ts` | Open an existing expense and change amount/category/date | Validated by code path only |
| Delete expense | Implemented | Expense is soft-deleted and marked dirty/versioned for sync | `ExpenseEditor` | `src/domain/expenseMutations.ts`, `src/repositories/expenseRepository.ts` | Delete an expense and verify it disappears from list queries | Unit test covers metadata mutation, not full repository round-trip |
| Transaction history | Implemented | User can browse stored expenses | `ExpenseListScreen` | `src/repositories/expenseRepository.ts` | Create several expenses and check list order | Search/filter behavior was not simulator-tested |
| Transaction search | Partial | Description-only search is supported | `ExpenseListScreen` | `src/repositories/expenseRepository.ts` | Search for a description substring | No search by amount or notes beyond description text |
| Transaction month filter | Implemented | User can filter by month or all dates | `ExpenseListScreen` | `src/repositories/expenseRepository.ts`, `src/utils/date.ts` | Select specific month chips and all-dates state | Large data-set behavior not stress-tested |
| Transaction category filter | Implemented | User can filter by category or all categories | `ExpenseListScreen` | `src/repositories/categoryRepository.ts`, `src/repositories/expenseRepository.ts` | Select category chips and verify results | Long category lists may become awkward in chip UI |

## Categories

| Feature | Status | Description | Entry Screens | Dependent Modules | How To Test | Known Limitations |
| --- | --- | --- | --- | --- | --- | --- |
| Default category seeding | Implemented | Runtime ensures baseline default categories exist per scope | Startup | `src/services/categorySeedService.ts`, `src/utils/categoryIdentity.ts`, `src/app/useAppRuntime.ts` | Launch fresh guest scope and confirm categories exist | Device/live backend bootstrap not executed here |
| Category create | Implemented | New categories can be created in first-class management UI | `SettingsScreen` -> `Categories` | `src/screens/CategoryManagementScreen.tsx`, `src/repositories/categoryRepository.ts` | Add a category and verify it appears in expense editor/list filters | Duplicate check is UI-level and name-based |
| Category rename | Implemented | Existing categories can be renamed | `CategoryManagementScreen` | `src/repositories/categoryRepository.ts` | Rename a category and verify name updates in lists | No category merge flow |
| Category archive / restore | Implemented | Categories can be archived and restored | `CategoryManagementScreen` | `src/repositories/categoryRepository.ts` | Archive a category, confirm it disappears from active list, then restore it | No reassignment UI before archive |
| Category repair / duplicate handling | Partial | Runtime and sync repair duplicate names and missing references | Startup / sync | `src/services/categoryRepairService.ts`, `src/sync/syncService.ts` | Seed duplicates and observe repair logic in code/test environment | Not integration-tested against a live remote database |

## Insights And Drill-Down

| Feature | Status | Description | Entry Screens | Dependent Modules | How To Test | Known Limitations |
| --- | --- | --- | --- | --- | --- | --- |
| Monthly overview | Implemented | User can view available months and month totals | `MonthlySummaryScreen` | `src/repositories/expenseRepository.ts`, `src/hooks/useFormatters.ts` | Open Insights and switch months | Currently list-based, not advanced charting |
| Month drill-down | Implemented | User can tap into a selected month and see per-category totals | `MonthlySummaryScreen` -> `MonthDetailScreen` | `src/screens/MonthDetailScreen.tsx`, `src/repositories/expenseRepository.ts` | Select a month, open month detail, verify category totals | Validated by navigation wiring in code, not by simulator tap execution |
| Category drill-down within month | Implemented | User can tap a category within a month and see filtered transactions | `MonthlySummaryScreen` / `MonthDetailScreen` -> `CategoryTransactionsScreen` | `src/screens/CategoryTransactionsScreen.tsx`, `src/repositories/expenseRepository.ts` | Open month detail, tap category, verify only that month/category appears | Screen is read-only from this context |
| Analytics depth | Partial | Insights support totals and category breakdown but not advanced trend analysis | `MonthlySummaryScreen` | `src/repositories/expenseRepository.ts` | Compare multiple months and category breakdowns | No trend chart, forecasting, or comparative analytics yet |

## Budgets

| Feature | Status | Description | Entry Screens | Dependent Modules | How To Test | Known Limitations |
| --- | --- | --- | --- | --- | --- | --- |
| Monthly category budgets | Local-only | User can set a per-category budget for a given month | `BudgetScreen` | `src/repositories/budgetRepository.ts`, `src/types/budget.ts` | Set a budget for categories and reload the screen | Stored locally only |
| Budget vs actual view | Local-only | Budget screen compares stored budget to current month expense totals | `BudgetScreen` | `src/repositories/budgetRepository.ts`, `src/repositories/expenseRepository.ts` | Add expenses after setting budgets and confirm actual/remaining values | No alerts, rollover, or budgeting history UX |
| Budget summary on home | Local-only | Home displays aggregate budget left for the current month | `HomeScreen` | `src/repositories/budgetRepository.ts`, `src/repositories/expenseRepository.ts` | Set budgets, add expenses, compare home budget-left figure | Aggregate only |
| Budget cloud sync | Needs backend support | There is no remote schema or sync path for budgets | N/A | N/A | N/A | Requires backend table/API/policy support plus client sync logic |

## Recurring Expenses

| Feature | Status | Description | Entry Screens | Dependent Modules | How To Test | Known Limitations |
| --- | --- | --- | --- | --- | --- | --- |
| Recurring expense rule creation | Local-only | User can create weekly or monthly recurring rules | `SettingsScreen` -> `RecurringExpensesScreen` | `src/repositories/recurringExpenseRepository.ts`, `src/types/recurringExpense.ts` | Create weekly/monthly rules and reload the screen | Local-only |
| Recurring rule activation toggle | Local-only | User can deactivate/reactivate recurring rules | `RecurringExpensesScreen` | `src/repositories/recurringExpenseRepository.ts` | Toggle active state and confirm ordering/status | No dedicated inactive section UX |
| Recurring materialization into expenses | Local-only | Due recurring rules generate real expenses during runtime startup | Implicit at startup/runtime | `src/services/recurringExpenseService.ts`, `src/app/useAppRuntime.ts` | Create a due recurring item and relaunch/retrigger runtime | Code-validated only; no device relaunch verification here |
| Recurring cloud sync | Needs backend support | Recurring rules are not synced across devices | N/A | N/A | N/A | Requires backend data model and client sync integration |

## Sync

| Feature | Status | Description | Entry Screens | Dependent Modules | How To Test | Known Limitations |
| --- | --- | --- | --- | --- | --- | --- |
| Expense/category push sync | Needs more validation | Dirty expenses/categories are pushed for signed-in users | Background, visible from sync pill | `src/sync/syncService.ts`, `src/app/useAppRuntime.ts` | Sign in, create/edit/delete records, verify remote state | No live backend validation in this environment |
| Expense/category pull sync | Needs more validation | Signed-in runtime pulls remote expenses/categories on startup and every 5 minutes | Background, visible from sync pill | `src/sync/syncService.ts`, `src/app/useAppRuntime.ts` | Sign in on one device/source, inspect another session | Code path exists, but cross-device run not performed |
| Sync status UX | Implemented | UI surfaces sync state and last sync time | `HomeScreen`, `SettingsScreen` | `src/components/SyncStatusPill.tsx`, `src/state/syncGateContext.tsx` | Observe guest mode, syncing, ready, and error UI states | Status derives from runtime state, not network reachability |
| Conflict resolution | Needs more validation | Remote/local conflict rules use updatedAt, version, delete state, deviceId | Background sync | `src/sync/syncService.ts` | Simulate conflicting local/remote records | Logic exists but no integration test suite covers it |

## Settings And Localization

| Feature | Status | Description | Entry Screens | Dependent Modules | How To Test | Known Limitations |
| --- | --- | --- | --- | --- | --- | --- |
| Language selector | Implemented | User can switch between English and Simplified Chinese | `SettingsScreen` | `src/settings/settingsStore.ts`, `src/i18n/i18n.tsx`, `src/i18n/resources.ts` | Switch language and revisit multiple screens | A few fallback/loading/error strings remain hardcoded |
| Currency selector | Implemented | User can choose default display/default-entry currency | `SettingsScreen` | `src/settings/settingsStore.ts`, `src/hooks/useFormatters.ts` | Change currency and inspect new expenses/formatting | No FX conversion for historical data |
| Locale-aware date/currency formatting | Implemented | Screen formatting is centralized and locale-aware where used | Multiple screens | `src/utils/formatting.ts`, `src/hooks/useFormatters.ts` | Switch language/currency and inspect amounts/dates | Requires device QA for full locale confidence |

## Validation Coverage Status

| Feature Area | Status | Description | Entry Screens | Dependent Modules | How To Test | Known Limitations |
| --- | --- | --- | --- | --- | --- | --- |
| Unit test coverage for scope/date/delete rules | Implemented | Core domain rules have unit tests | N/A | `tests/dataScope.test.mjs`, `tests/date.test.mjs`, `tests/expenseMutations.test.mjs` | Run `npm run test:unit` | No UI/integration coverage |
| Repository integration coverage | Needs more validation | Repositories were reviewed in code but not tested with a dedicated DB test suite | N/A | Repository files | Add DB-backed integration tests | Missing today |
| Simulator/device UI coverage | Needs more validation | No simulator/device execution was performed in this environment | All screens | Entire app | Run `expo start` + iOS/Android device/simulator tests | Still pending |
