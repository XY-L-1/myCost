# File By File Changelog

This changelog focuses on the most important files that changed during the upgrade. It does not list every minor styling or small helper update.

## App Shell And Runtime

### `App.tsx`

- Why it changed:
  - The previous app root had too much orchestration logic.
- What changed:
  - Reduced to a thin shell that mounts providers, handles guest-mode state, shows global loading/error UI, and chooses the navigator.
- What problem it solves:
  - Separates shell concerns from runtime orchestration and makes navigation mode selection easier to reason about.
- Caveats:
  - The loading and retry copy here is still hardcoded instead of coming from i18n resources.

### `src/app/useAppRuntime.ts`

- Why it changed:
  - Bootstrap, sync, merge, recurring materialization, and background refresh needed one dedicated runtime coordinator.
- What changed:
  - Added store initialization, signed-in startup sync pipeline, guest startup path, mutation-triggered sync, periodic pull, sync status exposure, and retry handling.
- What problem it solves:
  - Removes lifecycle complexity from `App.tsx` and creates a single authoritative app runtime workflow.
- Caveats:
  - It is still a relatively large coordinator and may need future decomposition.

## Ownership And Data Correctness

### `src/domain/dataScope.ts`

- Why it changed:
  - Local data isolation needed a formal model.
- What changed:
  - Added `guestScope`, `userScope`, `buildScopeFilter`, `getOwnerKey`, and the `GUEST_OWNER_KEY` constant.
- What problem it solves:
  - Prevents unscoped local reads and creates a consistent partitioning mechanism across repositories.
- Caveats:
  - The system assumes only one guest partition, `"guest"`.

### `src/domain/expenseMutations.ts`

- Why it changed:
  - Delete metadata needed to be consistent and testable.
- What changed:
  - Added `buildSoftDeletedExpense()` to compute the correct deleted/updated/version/dirty state.
- What problem it solves:
  - Fixes sync correctness for soft-deletes.
- Caveats:
  - Only the expense delete path is modeled here; category archive semantics remain in the repository/service path.

### `src/db/migration.ts`

- Why it changed:
  - Schema needed explicit ownership columns plus new product entities.
- What changed:
  - Added owner-key migration/backfill/indexing and created `budgets` plus `recurring_expenses` tables.
- What problem it solves:
  - Enables owner-scoped queries and adds persistence for the new budget/recurring features.
- Caveats:
  - There is still no remote migration/schema in the repo for budgets or recurring expenses.

### `src/services/loginMergeService.ts`

- Why it changed:
  - Guest-to-user merge had to cover all new owner-scoped entities.
- What changed:
  - The merge now updates `expenses`, `categories`, `budgets`, and `recurring_expenses` from guest owner to user owner.
- What problem it solves:
  - Prevents guest-created local budget/recurring data from being stranded after sign-in.
- Caveats:
  - Merge behavior was validated by code inspection; no integration test simulates the full login path.

## Local Data Access

### `src/repositories/expenseRepository.ts`

- Why it changed:
  - Expense queries needed owner scoping and stronger delete correctness.
- What changed:
  - Added owner-scoped `list`, `getMonthlyTotal`, `getMonthlyCategoryBreakdown`, and `getAvailableMonthKeys`; updated delete logic to use soft-delete mutation helper.
- What problem it solves:
  - Prevents cross-scope local data leakage and improves sync behavior.
- Caveats:
  - `getById` is still id-only and not owner-scoped; this works for current navigation flows but is worth monitoring for future multi-actor scenarios.

### `src/repositories/categoryRepository.ts`

- Why it changed:
  - Category reads and lifecycle changes needed owner scoping and better archive semantics.
- What changed:
  - Added owner-scoped `getAll`, normalized-name handling on insert/update, and archive/restore methods that update versioning metadata.
- What problem it solves:
  - Makes categories partition-safe and keeps archive/restore sync-aware.
- Caveats:
  - `getById` is id-only for lookup convenience.

### `src/repositories/budgetRepository.ts`

- Why it changed:
  - Budget support required local persistence.
- What changed:
  - Added month/category budget lookup and upsert logic keyed by `ownerKey`.
- What problem it solves:
  - Enables monthly category budgets and budget-vs-actual calculations.
- Caveats:
  - No sync metadata exists because budgets are local-only.

### `src/repositories/recurringExpenseRepository.ts`

- Why it changed:
  - Recurring expenses required local CRUD support.
- What changed:
  - Added create/read/update/activation/generation-state methods scoped by owner.
- What problem it solves:
  - Supports recurring rule management and recurring transaction materialization.
- Caveats:
  - UI currently uses create and archive/restore-like active toggling more than full edit/delete.

## Sync And Repair

### `src/sync/syncService.ts`

- Why it changed:
  - The client needed to align remote expense/category rows with the new owner model and updated conflict rules.
- What changed:
  - Remote rows now map back into local `ownerKey = user_id`; category duplicate handling and conflict resolution remain centralized here.
- What problem it solves:
  - Keeps remote sync compatible with the new local partition model for signed-in users.
- Caveats:
  - Sync still covers only expenses and categories.

### `src/services/categorySeedService.ts`

- Why it changed:
  - Default categories needed one deterministic source of truth after removing older duplication.
- What changed:
  - Default categories are now ensured using the current scope/device context.
- What problem it solves:
  - Reduces drift between seeded category logic and runtime category repair.
- Caveats:
  - Category names are still plain strings, including the fallback repair label.

### `src/services/categoryRepairService.ts`

- Why it changed:
  - Startup and sync flows needed guardrails against duplicate and missing categories.
- What changed:
  - Kept/extended duplicate repair and missing-reference repair usage inside the new runtime path.
- What problem it solves:
  - Prevents category collisions and orphaned category references from breaking expense history.
- Caveats:
  - The fallback repair category label `"Other"` is not localized.

### `src/services/recurringExpenseService.ts`

- Why it changed:
  - Recurring rules needed a service that turns due rules into real expenses.
- What changed:
  - Added due-date materialization loop and generation-state updates.
- What problem it solves:
  - Makes recurring rules operational instead of purely informational.
- Caveats:
  - This runs at startup/runtime; there is no background OS scheduling beyond app activity.

## Navigation

### `src/navigation/RootNavigator.tsx`

- Why it changed:
  - The target product required a premium five-area navigation structure plus detail flows.
- What changed:
  - Replaced the older navigation with tab routes for Home, Transactions, Insights, Budget, and Settings, plus stack routes for expense editor, month detail, category transactions, categories, and recurring expenses.
- What problem it solves:
  - Gives the app clearer product IA and enables analytics drill-down.
- Caveats:
  - There is no deep-link configuration yet.

### `src/navigation/AuthNavigator.tsx`

- Why it changed:
  - Auth flows had to remain isolated and clean after the app-shell refactor.
- What changed:
  - Keeps a dedicated auth-only stack for entry, sign-in, and sign-up.
- What problem it solves:
  - Preserves a clear auth-mode navigator separate from the signed-in/guest app shell.
- Caveats:
  - Visual styling here is lighter than the main app shell and could be unified further later.

## Settings, I18n, And Formatting

### `src/settings/settingsStore.ts`

- Why it changed:
  - Language and preferred currency needed persistence.
- What changed:
  - Added secure-store-backed settings initialization and setters for language/currency.
- What problem it solves:
  - Makes formatting and i18n selection durable across launches.
- Caveats:
  - Currency preference controls display/default entry currency, not historical currency conversion.

### `src/i18n/i18n.tsx`

- Why it changed:
  - The app needed maintainable multilingual support.
- What changed:
  - Added a lightweight provider with nested key lookup, fallback to English, and interpolation.
- What problem it solves:
  - Centralizes translation retrieval and removes screen-level hardcoded copy in most places.
- Caveats:
  - This is a custom lightweight i18n layer, not `i18next`.

### `src/i18n/resources.ts`

- Why it changed:
  - Screen/UI copy needed structured translation resources.
- What changed:
  - Added English and Simplified Chinese resources for navigation, screens, common UI, sync, and settings.
- What problem it solves:
  - Enables runtime language switching and future extension to additional locales.
- Caveats:
  - Coverage is not yet 100%; some fallback strings remain in code.

### `src/utils/date.ts`

- Why it changed:
  - Date key handling needed one reliable implementation.
- What changed:
  - Centralized local date key, month key, month shifting, parsing, and recurring date calculation.
- What problem it solves:
  - Reduces off-by-one and duplicated date logic across screens/services.
- Caveats:
  - Broader timezone/device edge cases still need device QA.

### `src/utils/formatting.ts` and `src/hooks/useFormatters.ts`

- Why they changed:
  - Money/date presentation was inconsistent.
- What changed:
  - Added locale-aware formatting helpers keyed off settings language/currency.
- What problem they solve:
  - Produces more consistent financial display across the app.
- Caveats:
  - The app still stores raw money values as integer cents without FX support.

## Screens

### `src/screens/AddExpenseScreen.tsx`

- Why it changed:
  - Expense add/edit/delete needed one stronger, safer flow.
- What changed:
  - Replaced the old split detail/edit behavior with one editor screen using validation, category chips, navigation to category management, and a date picker.
- What problem it solves:
  - Improves transaction entry UX and unifies create/edit/delete behavior.
- Caveats:
  - Category selection is still chip-based and may become unwieldy for large category sets.

### `src/screens/HomeScreen.tsx`

- Why it changed:
  - Home needed to feel like a real product dashboard.
- What changed:
  - Added current month spend, today spend, budget left, recurring due count, recent transactions, and sync status.
- What problem it solves:
  - Gives the user a clear operational summary on launch.
- Caveats:
  - No chart on home yet; insights remain a separate tab.

### `src/screens/ExpenseListScreen.tsx`

- Why it changed:
  - Transactions needed better filtering and cohesion.
- What changed:
  - Added search, month chips, category chips, scoped queries, and a shared screen structure.
- What problem it solves:
  - Makes history browsing more usable and consistent.
- Caveats:
  - Search is still description-only.

### `src/screens/MonthlySummaryScreen.tsx`

- Why it changed:
  - Insights were too shallow.
- What changed:
  - Added month selection, category breakdown, and navigation to month detail/category transaction drill-down.
- What problem it solves:
  - Makes monthly analytics interactive instead of static.
- Caveats:
  - Advanced charts are still intentionally simple.

### `src/screens/MonthDetailScreen.tsx`

- Why it changed:
  - Month-level drill-down was a required UX improvement.
- What changed:
  - Added per-category totals for a selected month with tap-through to category transactions.
- What problem it solves:
  - Gives users an intermediate insight layer between monthly overview and raw transactions.
- Caveats:
  - No secondary analytics such as percentage-of-total or trend vs previous month yet.

### `src/screens/CategoryTransactionsScreen.tsx`

- Why it changed:
  - Category drill-down needed a terminal transaction list.
- What changed:
  - Added filtered transaction display for a selected category within a selected month.
- What problem it solves:
  - Completes the month -> category -> transaction insight path.
- Caveats:
  - It is currently read-only from the drill-down context.

### `src/screens/CategoryManagementScreen.tsx`

- Why it changed:
  - Categories needed to be managed outside the expense editor.
- What changed:
  - Added create, rename, archive, restore, and active/archived presentation.
- What problem it solves:
  - Makes category management a first-class feature.
- Caveats:
  - No category merge/reassign flow in UI.

### `src/screens/BudgetScreen.tsx`

- Why it changed:
  - Budget support was a target product requirement.
- What changed:
  - Added per-category monthly budget editing plus summary totals.
- What problem it solves:
  - Enables basic budget-vs-actual workflow.
- Caveats:
  - Local-only, no alerts, no carryover logic.

### `src/screens/RecurringExpensesScreen.tsx`

- Why it changed:
  - Recurring expenses were a target product requirement.
- What changed:
  - Added recurring-rule creation, frequency selection, active/inactive control, and due-date display.
- What problem it solves:
  - Enables repeated routine expenses without manual re-entry each time.
- Caveats:
  - Local-only and currently lighter on editing/deletion UX than the expense editor.

### `src/screens/SettingsScreen.tsx`

- Why it changed:
  - The new app needed a settings area for preferences and management entry points.
- What changed:
  - Added language selector, currency selector, sync status surface, category management entry, recurring management entry, and sign-out action.
- What problem it solves:
  - Centralizes app preferences and operational tools.
- Caveats:
  - Language button labels are intentionally hardcoded as native language names.

## Testing And Cleanup

### `tests/dataScope.test.mjs`

- Why it changed:
  - Ownership rules needed direct verification.
- What changed:
  - Added tests for guest scope, user scope, and deterministic SQL scope filter generation.
- What problem it solves:
  - Provides baseline regression protection for the new partition model.
- Caveats:
  - Does not exercise live repository queries.

### `tests/date.test.mjs`

- Why it changed:
  - Date key logic underpins budgets, recurring, and insights.
- What changed:
  - Added tests for local date/month keys, month shifting, and recurring advancement.
- What problem it solves:
  - Protects date utility behavior from regression.
- Caveats:
  - Does not test device-locale rendering.

### `tests/expenseMutations.test.mjs`

- Why it changed:
  - Delete metadata correctness was a critical bug fix.
- What changed:
  - Added test coverage for soft-delete mutation output.
- What problem it solves:
  - Protects the new sync-sensitive delete semantics.
- Caveats:
  - This validates the pure mutation helper, not full repository persistence.

### Deleted: `src/db/seedCategories.ts`

- Why it changed:
  - It had become a duplicate/obsolete category seeding path.
- What changed:
  - Removed from the repo.
- What problem it solves:
  - Reduces duplicate sources of truth for default categories.
- Caveats:
  - None beyond the need to keep current seeding logic authoritative.

### Deleted: `src/screens/ExpenseDetailScreen.tsx`

- Why it changed:
  - Add/edit/detail behavior was consolidated into one screen.
- What changed:
  - Removed the older separate detail screen path.
- What problem it solves:
  - Simplifies transaction editing and reduces redundant UX.
- Caveats:
  - If a future read-only detail mode is wanted, it will need to be reintroduced intentionally.
