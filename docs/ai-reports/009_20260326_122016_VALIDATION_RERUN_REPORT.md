# Validation Rerun Report

## Summary

This report covers the validation rerun performed after the hardening pass.

What was actually executed:

- compile/type validation
- unit validation
- code-audit validation via `sed`, `rg`, and environment capability checks

What was not actually executed:

- iOS app launch
- Android app launch
- Expo runtime session
- live Supabase sign-in/sync

## Exact Commands Executed

### Compile And Unit Validation

```bash
npm run typecheck
npm run test:unit
```

### Architecture / Wiring / Scope Audit

```bash
sed -n '1,220p' App.tsx
sed -n '1,320p' src/app/useAppRuntime.ts
sed -n '1,320p' src/navigation/RootNavigator.tsx
sed -n '1,260p' src/settings/settingsStore.ts
sed -n '1,260p' src/services/loginMergeService.ts
sed -n '1,340p' src/screens/MonthlySummaryScreen.tsx
sed -n '1,260p' src/screens/MonthDetailScreen.tsx
sed -n '1,260p' src/screens/CategoryTransactionsScreen.tsx
sed -n '1,260p' src/screens/SettingsScreen.tsx
rg -n "getByIdInScope|ownerKey|local-only|localOnlyNote|errors\\.(initFailed|signInFailed|signUpFailed|verifyIncomplete|runtimeSyncFailed|mutationSyncFailed)" src App.tsx
rg -n "SELECT \\* FROM expenses WHERE id = \\?|SELECT \\* FROM categories WHERE id = \\?|SELECT \\* FROM recurring_expenses WHERE id = \\?|UPDATE expenses SET|UPDATE categories SET|UPDATE budgets|UPDATE recurring_expenses|DELETE FROM recurring_expenses" src
rg -n '"[A-Za-z][^"\\\\]*"' src App.tsx --glob '!src/i18n/resources.ts' --glob '!src/debug/*' --glob '!src/theme/*' --glob '!src/types/*' --glob '!src/utils/*' --glob '!src/navigation/RootNavigator.tsx' --glob '!src/navigation/AuthNavigator.tsx'
```

### Runtime Capability Check

```bash
xcrun simctl list devices
adb devices
npx expo --version
```

## Actual Results

## 1. Compile Validation

Command:

```bash
npm run typecheck
```

Result:

- Passed

Meaning:

- the hardening changes compile cleanly
- repository API updates and screen call sites are consistent
- `App.tsx` provider/wiring changes are type-safe

## 2. Unit Validation

Command:

```bash
npm run test:unit
```

Result:

- Passed
- 7 tests passed
- 0 tests failed

Covered by execution:

- guest scope owner key behavior
- user scope owner key behavior
- deterministic scope filter output
- local date/month key formatting
- month shift logic
- recurring date advancement
- soft delete sync metadata mutation

## 3. Runtime Capability Check

### iOS Simulator

Command:

```bash
xcrun simctl list devices
```

Result:

- Failed

Observed failure:

- `CoreSimulatorService connection became invalid`
- `Unable to locate device set`
- simulator services are not available in this environment

Conclusion:

- iOS simulator runtime validation was not possible

### Android Device / Emulator

Command:

```bash
adb devices
```

Result:

- Failed
- `adb: command not found`

Conclusion:

- Android device/emulator validation was not possible

### Expo CLI Availability

Command:

```bash
npx expo --version
```

Result:

- Passed
- Reported version: `54.0.23`

Conclusion:

- Expo CLI exists, but usable simulator/device runtime infrastructure is not available here

## Re-Check Findings

## 1. App Startup Flow

Actually checked by code audit:

- `App.tsx`
- `src/app/useAppRuntime.ts`

Verified:

- `I18nProvider` now wraps the shell early enough for startup/retry strings
- `AuthGateProvider` still wraps the shell before `useAppRuntime()` is used
- `App.tsx` still chooses `AuthNavigator` vs `RootNavigator` correctly
- startup loading string is translated
- startup init failure string is translation-backed through `errors.initFailed`

Not runtime-validated:

- actual visual startup behavior on device
- cold-launch race conditions

## 2. Navigation Route Wiring

Actually checked by code audit:

- `src/navigation/RootNavigator.tsx`

Verified:

- tabs still include Home, Transactions, Insights, Budget, Settings
- stack routes still include ExpenseEditor, MonthDetail, CategoryTransactions, Categories, RecurringExpenses
- month/category drill-down route declarations remain intact after hardening

Not runtime-validated:

- gesture/back navigation behavior
- modal presentation behavior on iOS/Android

## 3. Translation Coverage

Actually checked by code audit:

- `src/i18n/resources.ts`
- `App.tsx`
- auth screens
- settings screen
- budget / recurring screens
- hardcoded string scan

Verified:

- startup copy is translated
- auth fallback errors are translated
- settings language labels are translation-backed
- visible currency option labels are translation-backed
- budget and recurring local-only notes are translated

Remaining notable literals after scan:

- internal runtime/status strings and type literals such as `guest`, `auth`, `loading`, `error`
- internal error messages thrown inside hooks/contexts
- persisted fallback category identity is still ultimately driven by the English default-category source of truth

Conclusion:

- normal non-debug UI string coverage is materially stronger
- no new user-facing hardcoded UI copy was found in the hardened paths

## 4. Owner-Scoped Repository Access

Actually checked by code audit:

- repository files
- `rg` query scans
- screen call sites
- sync service
- category repair service

Verified:

- unsafe raw repository `getById()` methods were removed from expense/category/recurring repositories
- scoped `getByIdInScope()` now exists and is used by:
  - `AddExpenseScreen`
  - `CategoryTransactionsScreen`
- owner-aware `WHERE id = ? AND ownerKey = ?` guards were added to update/delete paths
- sync-side local row application now scopes expense/category id lookups by owner
- category repair expense/category mutation paths now scope by owner

Still noteworthy:

- login merge intentionally updates all guest-owned records by `ownerKey = guest` because that is the designed ownership transfer step

## 5. Guest-To-User Merge

Actually checked by code audit:

- `src/services/loginMergeService.ts`
- `src/app/useAppRuntime.ts`

Verified:

- merge updates:
  - expenses
  - categories
  - budgets
  - recurring_expenses
- runtime still calls merge before remote pull/push in the signed-in path

Not runtime-validated:

- real guest-to-signed-in session behavior with persistent local data and live auth

## 6. Month Drill-Down And Category Drill-Down Data Flow

Actually checked by code audit:

- `src/screens/MonthlySummaryScreen.tsx`
- `src/screens/MonthDetailScreen.tsx`
- `src/screens/CategoryTransactionsScreen.tsx`

Verified:

- Insights month selection still drives month totals and breakdown
- Month detail still reads category totals for the selected month
- Category transactions still filters by both `monthKey` and `categoryId`
- category name lookup is now scope-aware

Not runtime-validated:

- on-device tapping, transitions, and rendered results

## 7. Settings Persistence And Language Switching Logic

Actually checked by code audit:

- `src/settings/settingsStore.ts`
- `src/screens/SettingsScreen.tsx`
- `App.tsx`

Verified:

- language persists through SecureStore key `settings.language`
- currency persists through SecureStore key `settings.currency`
- `I18nProvider` now wraps startup UI as well as navigation UI
- settings still switches `language` and `currency` through store setters

Not runtime-validated:

- persistence across real cold app relaunch on device
- layout behavior after language switch

## What Was Strengthened In This Rerun

- startup/retry/auth fallback strings are translation-backed
- unsafe raw repository id lookups were removed
- screen-level specific-record fetches now use scoped lookup APIs
- owner-aware guards were added to multiple update/delete paths
- sync-side local cleanup/apply paths are more owner-explicit
- budget and recurring features are now labeled local-only in code and UI

## What Is Still Unvalidated

- any real device rendering
- iOS simulator behavior
- Android emulator/device behavior
- live Supabase auth
- live cloud sync push/pull/conflict behavior
- true guest-to-user merge execution
- persistence behavior across real app relaunch

## Bottom Line

The strongest validation available in this environment was completed:

- compile validation
- unit validation
- targeted architecture/scope/string audits
- simulator/device capability checks

A real runtime pass was not possible here, so the next required step is manual execution using [MANUAL_TEST_SCRIPT.md](./MANUAL_TEST_SCRIPT.md).
