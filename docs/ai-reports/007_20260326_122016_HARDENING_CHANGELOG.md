# Hardening Changelog

## Scope Of This Pass

This pass focused only on code-level gaps that were clearly identifiable from the repository after the prior validation report:

- remaining hardcoded user-facing strings
- owner-aware id lookups
- owner-scoped query/write safety
- explicit local-only labeling for budgets and recurring expenses

## 1. Hardcoded User-Facing Strings Removed Or Centralized

### `App.tsx`

- Moved loading and retry UI to translations:
  - `common.appName`
  - `startup.preparingWorkspace`
  - `common.retry`
- Moved `I18nProvider` above the shell so startup/error states can use translated copy.

### `src/screens/SignInScreen.tsx`

- Replaced fallback `"Sign in failed"` with `t("errors.signInFailed")`.

### `src/screens/SignUpScreen.tsx`

- Replaced fallback `"Sign up failed"` with `t("errors.signUpFailed")`.
- Replaced fallback `"Verification not complete yet"` with `t("errors.verifyIncomplete")`.

### `src/screens/SettingsScreen.tsx`

- Replaced hardcoded language button labels with translation-backed labels:
  - `settings.languageEnglish`
  - `settings.languageChinese`
- Replaced visible currency option labels with translation-backed labels:
  - `settings.currencyUsd`
  - `settings.currencyCny`
  - `settings.currencyEur`
  - `settings.currencyJpy`

### `src/app/useAppRuntime.ts`

- Replaced runtime fallback sync message literals with translation keys:
  - `errors.runtimeSyncFailed`
  - `errors.mutationSyncFailed`

### `src/services/categoryRepairService.ts`

- Removed the raw fallback literal `"Other"` from this file and now derive the fallback name from `DEFAULT_CATEGORIES`, preserving one source of truth for deterministic fallback category identity.

## 2. Owner-Aware ID Lookup Hardening

### Removed Unsafe Raw Repository Lookups

Removed unused unscoped `getById()` methods from:

- `src/repositories/expenseRepository.ts`
- `src/repositories/categoryRepository.ts`
- `src/repositories/recurringExpenseRepository.ts`

### Added Scoped Lookup APIs

Added `getByIdInScope(scope, id)` to:

- `ExpenseRepository`
- `CategoryRepository`
- `RecurringExpenseRepository`

### Updated Call Sites

Scoped lookups are now used in UI flows that resolve specific records:

- `src/screens/AddExpenseScreen.tsx`
- `src/screens/CategoryTransactionsScreen.tsx`

Result:

- the UI no longer resolves records by raw id alone
- guest and signed-in partitions cannot be crossed accidentally through screen lookups

## 3. Owner-Scoped Write Safety Tightened

### Repository Writes

Added owner-aware write guards to:

- `ExpenseRepository.update`
- `ExpenseRepository.softDelete`
- `CategoryRepository.update`
- `CategoryRepository.archive`
- `CategoryRepository.restore`
- `BudgetRepository.upsert` update path
- `RecurringExpenseRepository.update`
- `RecurringExpenseRepository.setActive`
- `RecurringExpenseRepository.updateGenerationState`
- `RecurringExpenseRepository.remove`

### Category Repair Service

Tightened owner scoping in `src/services/categoryRepairService.ts` for:

- duplicate-category expense repointing
- duplicate-category archive writes
- missing-category existence checks
- fallback-category revival
- fallback-category expense reassignment

### Sync Service

Tightened owner/user scoping in `src/sync/syncService.ts` for:

- dirty flag cleanup writes after push
- local row lookups during remote apply
- category duplicate merge path
- remote category revival path
- local expense/category update writes

Result:

- id-based writes are now less trusting
- sync-side local mutation paths are more explicit about which owner partition they can affect

## 4. Local-Only Budget / Recurring Labeling

### Code Comments

Added explicit local-only comments in:

- `src/repositories/budgetRepository.ts`
- `src/repositories/recurringExpenseRepository.ts`
- `src/services/recurringExpenseService.ts`
- `src/types/budget.ts`
- `src/types/recurringExpense.ts`

### UI Labels

Added translated local-only notes to:

- `src/screens/BudgetScreen.tsx`
- `src/screens/RecurringExpensesScreen.tsx`

Resource keys:

- `budget.localOnlyNote`
- `recurring.localOnlyNote`

Result:

- future maintainers see the limitation in code
- users see that these features are currently device-local

## 5. Files Changed In This Hardening Pass

- `App.tsx`
- `src/app/useAppRuntime.ts`
- `src/state/appInitStore.ts`
- `src/i18n/resources.ts`
- `src/screens/SignInScreen.tsx`
- `src/screens/SignUpScreen.tsx`
- `src/screens/SettingsScreen.tsx`
- `src/screens/BudgetScreen.tsx`
- `src/screens/RecurringExpensesScreen.tsx`
- `src/screens/AddExpenseScreen.tsx`
- `src/screens/CategoryTransactionsScreen.tsx`
- `src/repositories/expenseRepository.ts`
- `src/repositories/categoryRepository.ts`
- `src/repositories/budgetRepository.ts`
- `src/repositories/recurringExpenseRepository.ts`
- `src/services/categoryRepairService.ts`
- `src/services/recurringExpenseService.ts`
- `src/sync/syncService.ts`
- `src/types/budget.ts`
- `src/types/recurringExpense.ts`

## 6. Gaps Intentionally Not Claimed As Fixed

- Full runtime device/simulator validation
- Live Supabase auth and sync validation
- End-to-end guest-to-user merge execution against a real local DB and backend session
- Internationalization of persisted category data itself
- Backend sync for budgets and recurring expenses
