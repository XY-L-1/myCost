# Final Manual Verification Required

Only items that still require human/manual validation are listed here.

## 1. Real Startup On iOS

- What must be tested manually:
  - cold launch, loading state, retry state, initial navigator selection
- Why AI could not fully validate it:
  - CoreSimulatorService was unavailable in this environment
- Exact steps:
  1. Launch the app on iOS from a fresh install.
  2. Observe startup loading text and transition into auth or main app.
  3. If possible, simulate an init failure and confirm retry behavior.
- Expected result:
  - app launches without blank screen or crash, translated startup copy appears, navigator selection is correct
- Severity if broken:
  - High

## 2. Real Startup On Android

- What must be tested manually:
  - cold launch, loading state, retry state, initial navigator selection
- Why AI could not fully validate it:
  - `adb` was not installed and no Android runtime was available
- Exact steps:
  1. Launch the app on Android from a fresh install.
  2. Observe startup loading text and transition into auth or main app.
- Expected result:
  - same as iOS expectation, with no Android-specific crash
- Severity if broken:
  - High

## 3. Live Sign-In / Sign-Up

- What must be tested manually:
  - real Supabase sign-up, verification, sign-in, and sign-out flows
- Why AI could not fully validate it:
  - no live backend auth execution was performed
- Exact steps:
  1. Create a test account.
  2. Complete email verification.
  3. Sign in.
  4. Sign out.
  5. Sign back in.
- Expected result:
  - auth state changes correctly and app routes correctly after each transition
- Severity if broken:
  - High

## 4. Guest-To-User Merge With Real Local Data

- What must be tested manually:
  - merge of guest-created expenses, categories, budgets, and recurring rules into signed-in scope
- Why AI could not fully validate it:
  - merge was only validated by code-path inspection
- Exact steps:
  1. Enter guest mode.
  2. Create guest expenses, a custom category, a budget, and a recurring rule.
  3. Sign in with a real account.
  4. Check all related screens afterward.
- Expected result:
  - all supported guest-owned entities appear under the signed-in session without duplication or loss
- Severity if broken:
  - High

## 5. Expense CRUD On Device

- What must be tested manually:
  - create, edit, delete, date picker behavior, and list/home/insight refresh behavior
- Why AI could not fully validate it:
  - no device UI execution occurred
- Exact steps:
  1. Create an expense.
  2. Edit it.
  3. Delete it.
  4. Confirm reflected changes across Home, Transactions, Insights, and Budget.
- Expected result:
  - values update consistently everywhere and no stale record remains visible
- Severity if broken:
  - High

## 6. Month Drill-Down And Category Drill-Down Navigation

- What must be tested manually:
  - actual tap flow from Insights -> Month detail -> Category transactions
- Why AI could not fully validate it:
  - only route and code-path wiring were inspected
- Exact steps:
  1. Seed data across at least two months and categories.
  2. Open Insights.
  3. Tap a month, then Month detail, then a category.
- Expected result:
  - navigation succeeds and only the expected month/category transactions appear
- Severity if broken:
  - Medium-High

## 7. Language Switching Persistence

- What must be tested manually:
  - switching language in Settings and relaunch persistence
- Why AI could not fully validate it:
  - SecureStore-backed persistence and actual rendered layouts were not executed
- Exact steps:
  1. Switch from English to Simplified Chinese.
  2. Visit all major screens.
  3. Fully relaunch the app.
  4. Switch back to English and repeat.
- Expected result:
  - language changes immediately and persists across relaunch
- Severity if broken:
  - Medium

## 8. Budget Persistence And Accuracy

- What must be tested manually:
  - budget save/reload behavior and budget-vs-actual calculations
- Why AI could not fully validate it:
  - no DB-backed runtime interaction was performed
- Exact steps:
  1. Set budgets for multiple categories.
  2. Add expenses in those categories.
  3. Relaunch and revisit Budget and Home.
- Expected result:
  - budget values persist and totals match transaction reality
- Severity if broken:
  - Medium

## 9. Recurring Materialization On Real Relaunch

- What must be tested manually:
  - due recurring rules generating transactions exactly once at runtime
- Why AI could not fully validate it:
  - no real app relaunch/runtime cycle was executed
- Exact steps:
  1. Create due recurring items.
  2. Relaunch the app.
  3. Check Transactions and Home recurring signals.
  4. Relaunch again to check for duplicate generation.
- Expected result:
  - due rules materialize once and do not duplicate on repeated launch
- Severity if broken:
  - High

## 10. Live Sync Success / Failure UX

- What must be tested manually:
  - sync success, sync failure message, and retry button behavior
- Why AI could not fully validate it:
  - no live backend or network failure session was executed
- Exact steps:
  1. Sign in.
  2. Change synced data.
  3. Confirm sync state updates.
  4. If possible, disable network and observe error state.
  5. Use retry in Settings.
- Expected result:
  - sync state changes appropriately, error detail appears, retry is available and meaningful
- Severity if broken:
  - Medium-High

## 11. Sign-Out Isolation With Existing Local Data

- What must be tested manually:
  - data separation between signed-in scope and guest scope after sign-out/sign-in cycles
- Why AI could not fully validate it:
  - this depends on real persisted local data and real auth transitions
- Exact steps:
  1. Create signed-in-only data.
  2. Sign out.
  3. Enter guest mode and inspect data.
  4. Sign back into the original account.
- Expected result:
  - guest views do not leak signed-in data; signed-in views restore the correct user partition
- Severity if broken:
  - High
