# Document Alignment Report

## Purpose

This report identifies where earlier repository documents no longer match the current code after the final hardening pass.

Code is the source of truth. Older statements below should now be treated as stale.

## Alignment Issues Found

## 1. Startup Copy Translation State

Earlier document statements:

- `TEST_AND_VALIDATION_REPORT.md` said startup loading/retry strings were still hardcoded
- `HARDENING_CHANGELOG.md` before the final pass did not yet reflect the final sync UX change

Correct current state from code:

- startup loading copy is translation-backed in `App.tsx`
- startup retry button label is translation-backed in `App.tsx`
- app-init failure uses translation key `errors.initFailed`

Code evidence:

- `App.tsx`
- `src/i18n/resources.ts`
- `src/state/appInitStore.ts`

Treat as outdated:

- any earlier statement claiming startup loading/retry copy is still hardcoded

## 2. I18n Provider Position In Architecture

Earlier document statements:

- `ARCHITECTURE_OVERVIEW.md` described a shell path where `I18nProvider` sat under `SyncGateProvider` and effectively after runtime shell selection

Correct current state from code:

- `I18nProvider` now wraps `AuthGateProvider` and the app shell before startup loading/error UI renders

Code evidence:

- `App.tsx`

Treat as outdated:

- earlier architecture diagrams showing `I18nProvider` only around `NavigationContainer`

## 3. Settings Language Labels

Earlier document statements:

- `TEST_AND_VALIDATION_REPORT.md` and `VALIDATION_RERUN_REPORT.md` treated hardcoded language labels as intentional exceptions

Correct current state from code:

- settings language button labels now come from translation resources:
  - `settings.languageEnglish`
  - `settings.languageChinese`

Code evidence:

- `src/screens/SettingsScreen.tsx`
- `src/i18n/resources.ts`

Treat as outdated:

- earlier notes saying those labels are still hardcoded in UI

## 4. Settings Currency Labels

Earlier document statements:

- earlier documents did not consistently call out visible currency option labels as still literal UI labels

Correct current state from code:

- settings currency option labels now come from translation resources:
  - `settings.currencyUsd`
  - `settings.currencyCny`
  - `settings.currencyEur`
  - `settings.currencyJpy`

Code evidence:

- `src/screens/SettingsScreen.tsx`
- `src/i18n/resources.ts`

Treat as outdated:

- any earlier implication that visible settings currency labels remain raw literals

## 5. Repository `getById` Safety

Earlier document statements:

- `TEST_AND_VALIDATION_REPORT.md` and `VALIDATION_RERUN_REPORT.md` said id-only convenience lookups still remained in repositories

Correct current state from code:

- raw `getById()` methods were removed from:
  - expense repository
  - category repository
  - recurring repository
- scoped `getByIdInScope()` methods now exist and are used in screen call sites

Code evidence:

- `src/repositories/expenseRepository.ts`
- `src/repositories/categoryRepository.ts`
- `src/repositories/recurringExpenseRepository.ts`
- `src/screens/AddExpenseScreen.tsx`
- `src/screens/CategoryTransactionsScreen.tsx`

Treat as outdated:

- earlier statements that raw repository id lookups are still present

## 6. Sync Retry UX

Earlier document statements:

- earlier reports described sync status as visible but retry/error detail surfacing as incomplete

Correct current state from code:

- `SyncStatusPill` now renders sync error detail when available
- `SettingsScreen` now exposes a retry button when sync is in error state for a signed-in user

Code evidence:

- `src/components/SyncStatusPill.tsx`
- `src/screens/SettingsScreen.tsx`

Treat as outdated:

- earlier statements that retry UX is not yet surfaced in the UI

## 7. Hardcoded Fallback Category Literal In Repair Service

Earlier document statements:

- prior validation docs flagged a raw `"Other"` fallback in category repair

Correct current state from code:

- the repair service now derives the fallback category name from `DEFAULT_CATEGORIES`, so the repair path no longer has its own separate literal

Code evidence:

- `src/services/categoryRepairService.ts`
- `src/utils/categoryIdentity.ts`

Treat as outdated:

- earlier notes that category repair still owns its own raw fallback literal

## 8. Sync Error Fallback Strings

Earlier document statements:

- prior reports did not reflect translation-backed runtime sync fallback keys

Correct current state from code:

- runtime fallback keys are now:
  - `errors.runtimeSyncFailed`
  - `errors.mutationSyncFailed`

Code evidence:

- `src/app/useAppRuntime.ts`
- `src/i18n/resources.ts`

Treat as outdated:

- earlier statements implying runtime fallback sync text is still hardcoded literal UI copy

## Statements That Remain Correct

The following earlier themes are still accurate:

- budgets are local-only
- recurring rules are local-only
- real device/simulator validation was not performed
- live Supabase auth/sync was not validated
- manual verification is still required
