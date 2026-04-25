# Bugfix Report: Sign Out -> Guest Runtime Failure

## Exact Root Cause
The duplicate category ID crash was caused by a data-lifecycle mismatch around default guest categories.

- Guest default categories use deterministic IDs in the form `guest:<normalized-name>`.
- `categories.id` is a global primary key, not partitioned by `ownerKey`.
- Returning to guest mode runs guest startup seeding through [`useAppRuntime.ts`](./src/app/useAppRuntime.ts), which calls [`ensureDefaultCategories()`](./src/services/categorySeedService.ts).
- If any non-guest row still exists with an old guest default ID like `guest:food`, guest seeding tries to insert the same ID again and SQLite throws `UNIQUE constraint failed: categories.id`.

The underlying reason those invalid IDs could persist was a combination of:

1. Deterministic guest IDs are intentionally reused every time guest mode starts.
2. Legacy sign-in/merge history could leave guest default IDs under signed-in scopes.
3. Duplicate repair was archiving duplicate default categories instead of deleting/renaming them, so an old `guest:*` ID could remain reserved even after references were repointed.
4. Guest startup was seeding defaults without first cleaning invalid non-guest rows that still used guest deterministic IDs.

This was not just a try/catch problem. It was a real identity / lifecycle bug involving:

- seed logic
- deterministic category IDs
- ownerKey partitioning
- legacy merge / duplicate-repair behavior
- the sign-out -> guest startup transition

## Files Changed
- [`src/app/useAppRuntime.ts`](./src/app/useAppRuntime.ts)
- [`src/services/categoryRepairService.ts`](./src/services/categoryRepairService.ts)
- [`src/services/categorySeedService.ts`](./src/services/categorySeedService.ts)
- [`src/components/ScreenHeader.tsx`](./src/components/ScreenHeader.tsx)
- [`src/state/authGateContext.tsx`](./src/state/authGateContext.tsx)
- [`App.tsx`](./App.tsx)
- [`src/navigation/AuthNavigator.tsx`](./src/navigation/AuthNavigator.tsx)
- [`src/screens/HomeScreen.tsx`](./src/screens/HomeScreen.tsx)
- [`src/screens/SettingsScreen.tsx`](./src/screens/SettingsScreen.tsx)
- [`src/screens/AddExpenseScreen.tsx`](./src/screens/AddExpenseScreen.tsx)
- [`src/screens/MonthDetailScreen.tsx`](./src/screens/MonthDetailScreen.tsx)
- [`src/screens/CategoryTransactionsScreen.tsx`](./src/screens/CategoryTransactionsScreen.tsx)
- [`src/screens/CategoryManagementScreen.tsx`](./src/screens/CategoryManagementScreen.tsx)
- [`src/screens/RecurringExpensesScreen.tsx`](./src/screens/RecurringExpensesScreen.tsx)
- [`src/screens/SignInScreen.tsx`](./src/screens/SignInScreen.tsx)
- [`src/screens/SignUpScreen.tsx`](./src/screens/SignUpScreen.tsx)
- [`src/i18n/resources.ts`](./src/i18n/resources.ts)

Only the first three files are part of the data-integrity fix itself. The rest were part of the guest entry/navigation UX fixes requested in the same pass.

## What Was Fixed

### 1. Invalid guest default IDs are now repaired before guest seeding
Added [`repairInvalidScopedDefaultCategoryIds()`](./src/services/categoryRepairService.ts), which:

- scans for rows whose `id` is a deterministic guest default ID but whose `ownerKey` is not `guest`
- treats those rows as invalid legacy state
- repoints `expenses`, `budgets`, and `recurring_expenses` references to the canonical signed-in category ID
- renames the invalid row to the canonical user ID when possible
- deletes the invalid row if the canonical row already exists

This repair is now executed:

- before guest seeding in [`useAppRuntime.ts`](./src/app/useAppRuntime.ts)
- after signed-in category pull and before duplicate repair in [`useAppRuntime.ts`](./src/app/useAppRuntime.ts)

### 2. Default-category duplicate repair no longer preserves bad IDs
[`repairLocalCategoryDuplicates()`](./src/services/categoryRepairService.ts) now:

- repoints `expenses`, `budgets`, and `recurring_expenses`, not just expenses
- deletes duplicate default categories after repointing them instead of archiving them

That matters because archived duplicate default rows were still holding on to global IDs like `guest:food`.

### 3. Guest seeding is more explicit and safer
[`ensureDefaultCategories()`](./src/services/categorySeedService.ts) now:

- uses `deterministicGuestCategoryId()` instead of rebuilding guest IDs inline
- revives deleted rows only within the active scope by checking both `id` and `ownerKey`

That makes the seeding logic more consistent and reduces scope confusion.

## Why the Duplicate Category ID Happened
The failure happened when these conditions lined up:

1. A non-guest category row still existed with an ID like `guest:food`.
2. The user signed out and chose guest/local mode.
3. Guest runtime initialization ran `ensureDefaultCategories(guestScope)`.
4. Guest seeding attempted to insert `guest:food` again.
5. SQLite rejected it because `categories.id` is globally unique.

The crash surfaced during startup/runtime sync because guest seeding happens in the runtime bootstrap path, not lazily later in the UI.

## How the Fix Prevents Recurrence
- Invalid guest default IDs are normalized out of non-guest scopes before guest startup reseeds.
- Default duplicate cleanup no longer leaves archived rows behind holding reserved guest IDs.
- Category reference repair now includes budgets and recurring rules, so deleting/renaming category rows does not orphan those local-only entities.
- Guest seeding remains deterministic, but the repository is cleaned first so re-entering guest mode is idempotent.

## Whether Old Local Data Could Still Trigger Edge Cases
Yes, but the main collision path is now addressed.

Still-realistic edge cases:

- very old local data with inconsistent `ownerKey` / `userId` combinations outside the current architecture assumptions
- custom corrupted category rows that do not match the deterministic default-category pattern
- multi-user local databases that were already partially damaged before this repair logic existed

What should now be safe:

- guest default categories left behind under a signed-in scope
- sign-out -> guest startup reseeding the deterministic default categories
- duplicate default categories holding on to reserved guest IDs after repair

## Validation Status For This Bug
- Type validation: executed and passed
- Unit validation: executed and passed
- Code-path validation of sign-out -> guest seeding: executed by source audit
- Real device/simulator tap-through of sign-out -> guest flow: **not fully proven in this environment**

The native iOS app build/install/open was executed successfully after this fix, but the specific sign-out -> guest scenario was not replayed end-to-end by automation. That flow is still the highest-priority manual verification item.
