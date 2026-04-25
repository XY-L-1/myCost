# Category Schema And Migration Decision

## Should `categories.id` Remain Globally Unique?

Yes, for the current architecture.

Reasons:
- sync code treats category `id` as the stable entity identity
- remote categories are keyed by `id`
- local tables and cross-table references assume one category row is identified by one stable `id`

Changing `categories.id` from a global primary key to a scoped composite key would be a much larger redesign and would ripple through:
- sync logic
- repositories
- cross-table references
- remote merge behavior

For this bug, that schema redesign is not necessary.

## Is OwnerKey Partitioning Compatible With The Current Schema?

Yes, but only if category IDs remain globally unique and dirty legacy rows are normalized.

The current strategy is compatible because:
- signed-in default IDs are deterministic UUIDv5 values based on `userId + normalized name`
- guest default IDs are deterministic guest-prefixed IDs
- custom categories use generated UUIDs

So the model is compatible **if** cleanup keeps rows in the right scope and collapses duplicate logical categories.

## Is The Deterministic Default Category ID Strategy Flawed?

Not fundamentally.

The real problem was not deterministic IDs themselves. The real problem was:
- incomplete cleanup of legacy/duplicate rows
- repair code that looked only at active rows
- startup paths that did not run full scoped dedupe in guest mode

That said, deterministic IDs require strict cleanup because:
- a deterministic canonical ID may already exist in archived form
- a second active row with the same normalized name must be merged into that canonical row, not inserted beside it

## Was A Schema Migration Added?

No new SQLite schema migration was added in this pass.

## Why No New Migration Was Added

Because this problem is primarily a data-integrity cleanup problem that depends on application logic:
- normalized names
- deterministic IDs
- scoped guest vs signed-in defaults
- cross-table reference repointing for expenses / budgets / recurring rules

That is difficult to solve safely with a single blind SQL migration alone, especially because user-specific deterministic IDs are computed in app code.

Instead, the fix was implemented as idempotent runtime cleanup in:
- [src/services/categoryRepairService.ts](/Users/aic/Desktop/mycostp/expense-tracker/src/services/categoryRepairService.ts)

and it now runs during startup for both:
- guest scope
- signed-in scope

## Was A One-Time Cleanup Added?

Yes, functionally.

The startup repair pass is now acting as the one-time cleanup for dirty local category state:
- collapse duplicate normalized categories in the active scope
- revive canonical deterministic defaults instead of recreating them
- repoint `expenses`, `budgets`, and `recurring_expenses`
- delete duplicate category rows
- repair missing category references across all three entity types

This cleanup is idempotent, so it can run on later startups safely too.

## What Changed In The Startup Ordering

Both startup branches now run scoped category cleanup before relying on seeded defaults.

### Signed-in
- attach guest data
- pull remote categories
- repair invalid guest default IDs under the wrong scope
- repair scoped duplicate categories
- ensure defaults
- repair missing references

### Guest
- repair invalid guest default IDs under wrong scopes
- repair scoped duplicate categories
- ensure defaults
- repair missing references

## Why This Should Stop The Collision

The collision came from trying to insert a deterministic canonical ID that was already present as an archived row.

The new cleanup uses the existing row instead of inserting into an already-used PK.

## Future Schema Consideration

If the app later grows significantly, the most valuable schema-level hardening would be:
- a unique active-category invariant per `(ownerKey, normalizedName)`

However, I did **not** add that as a migration here because dirty existing local data could cause the migration to fail before the cleanup pass runs.

The current safer decision was:
- fix and normalize the data in runtime cleanup first
- keep the existing PK model
- avoid a risky migration that could brick existing dirty installs
