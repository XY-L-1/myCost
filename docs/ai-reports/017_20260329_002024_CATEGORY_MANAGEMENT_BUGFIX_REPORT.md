# Category Management Bugfix Report

## Exact Root Cause Of Create / Restore Failure
This was not a simple refresh problem. The failure came from a combination of category-identity handling and silent UI behavior.

### Create failure
In [`src/screens/CategoryManagementScreen.tsx`](./src/screens/CategoryManagementScreen.tsx), the old create path:

- trimmed the draft name
- checked for any case-insensitive duplicate across the whole loaded list, including archived rows
- returned early on match
- showed no error message

That meant:

- trying to create a category whose archived version already existed looked like a broken button
- trying to create a category whose active version already existed also looked broken
- the user got no feedback about why nothing happened

### Restore failure
In [`src/repositories/categoryRepository.ts`](./src/repositories/categoryRepository.ts), the old `restore()` logic blindly undeleted the archived row by ID and ownerKey.

It did **not** reconcile the case where:

- an archived category had the same normalized name as an already-active category in the same scope
- or a prior sync/category-merge had already left an active canonical category for that name

In those cases, “Restore” could appear ineffective because the archived record was not being resolved into the active canonical category in a user-visible, deterministic way.

### What this was **not**
- not primarily an `ownerKey` bug in the local category CRUD itself
- not a repository write-guard bug on `restore()`/`insert()` queries
- not a screen refresh bug only

The core issue was:
- duplicate / archived category handling
- no explicit create-or-restore behavior
- no visible mutation error state

## Files Changed
- [`src/repositories/categoryRepository.ts`](./src/repositories/categoryRepository.ts)
- [`src/screens/CategoryManagementScreen.tsx`](./src/screens/CategoryManagementScreen.tsx)
- [`src/i18n/resources.ts`](./src/i18n/resources.ts)

Related supporting change:
- [`src/sync/syncService.ts`](./src/sync/syncService.ts)

That sync file change was not the direct cause of the button failure, but it fixed downstream category-merge behavior that could hide budget/recurring data.

## What Was Fixed

### 1. Added normalized-name lookup in the repository
[`CategoryRepository.findByNormalizedName()`](./src/repositories/categoryRepository.ts) was added so the app can reason about active vs archived duplicates inside the current scope.

### 2. Added create-or-restore behavior
[`CategoryRepository.createOrRestore()`](./src/repositories/categoryRepository.ts) now:

- returns `existing` if an active same-name category already exists
- restores the archived row if the only match is archived
- creates a new row only when there is no scoped normalized-name match

This fixes the old “tap Add and nothing happens” behavior when the name already existed in archived state.

### 3. Made restore duplicate-aware
[`CategoryRepository.restore()`](./src/repositories/categoryRepository.ts) now:

- checks for an active same-normalized category in the same scope
- if one already exists, repoints `expenses`, `budgets`, and `recurring_expenses`
- deletes the archived duplicate instead of reviving a second conflicting category row

That makes restore deterministic and prevents silent duplicate-category states.

### 4. Added visible mutation feedback in the screen
[`CategoryManagementScreen.tsx`](./src/screens/CategoryManagementScreen.tsx) now:

- shows a validation error when the name is empty
- shows a duplicate error when the category already exists
- clears the error when the user edits the input
- still reloads the category list after successful mutation

## How Category Lists Refresh After Mutation
Refresh was already partly present through `await load()` after mutation and `useFocusEffect`.

After this fix:
- create, archive, and restore still call `await load()`
- mutation errors are visible instead of failing silently
- create can restore archived categories instead of returning early
- restore can merge into an active canonical category instead of leaving ambiguous duplicate state

## Scope Behavior
All new logic is explicitly scope-aware.

Evidence:
- repository lookups are based on [`buildScopeFilter()`](./src/domain/dataScope.ts)
- create/restore uses the current [`useCurrentScope()`](./src/hooks/useCurrentScope.ts) value
- ownerKey-scoped repointing is done when reconciling restored duplicates

This means the behavior is correct for the active guest scope or signed-in user scope, but it still follows the current scope boundary:
- guest categories are only visible in guest scope
- signed-in categories are only visible in that user’s scope

## How I Verified It

### Actually executed
- `npm run typecheck` passed
- `npm run test:unit` passed
- iOS build/install/open succeeded again with `npx expo run:ios -d "iPhone 16e" --port 8081`

### Code-audited
- repository duplicate lookup path
- create-or-restore path
- restore duplicate-merge path
- category list reload behavior in the screen
- ownerKey scoping in repository writes

## Was This Truly Runtime-Validated?
No, not fully.

What was runtime-validated:
- the app still compiles, builds, installs, and opens on the iOS simulator after the fix

What was **not** interactively proven:
- manually tapping Add Category
- manually tapping Restore
- observing the live list update on device

So the category-management fix is:
- compile-validated
- code-path validated
- simulator build/open validated
- **not yet fully interaction-proven**
