# Validation After Bugfix

## Exactly What Was Actually Run

### Type validation
Command:

```bash
npm run typecheck
```

Result:
- passed

What it validates:
- TypeScript compile correctness after the bugfix changes
- navigation prop usage
- auth gate context wiring
- header prop wiring
- repository/service signatures
- i18n key usage as expressed in code

### Unit validation
Command:

```bash
npm run test:unit
```

Result:
- passed
- 7 tests passed, 0 failed

What it validates:
- guest/user data-scope helpers
- date/month formatting helpers
- recurring-date advancement helper
- expense soft-delete sync metadata behavior

What it does **not** validate:
- live SQLite guest merge behavior
- navigation interaction
- real sign-out -> guest runtime flow
- i18n rendering on device

### Repository / scope / wiring code audit
Commands used:

```bash
rg -n 'getById|getByIdInScope|WHERE id = \?|WHERE id = \? AND|WHERE ownerKey = \?' src/repositories src/services src/screens
rg -n '<ScreenHeader|leftAction' src/screens src/components
sed -n '1,320p' src/services/loginMergeService.ts
sed -n '1,260p' src/services/categorySeedService.ts
sed -n '1,260p' src/app/useAppRuntime.ts
sed -n '1,260p' src/repositories/expenseRepository.ts
sed -n '1,260p' src/repositories/budgetRepository.ts
sed -n '1,260p' src/repositories/recurringExpenseRepository.ts
```

What this validated:
- screen call sites use scoped `getByIdInScope()` paths
- repository writes are owner-aware where expected
- guest startup now runs invalid-ID cleanup before guest default seeding
- default duplicate cleanup repoints dependent entities and deletes bad default duplicates
- internal stack/modal screens now declare left navigation actions

Status:
- validated by code inspection
- not runtime-proven through user interaction

### Translation coverage re-check
Commands used:

```bash
rg -n 'localOnlyNote|local-only|local only|syncCta|guestModeTitle|guestAccountTitle|common.back|common.close' src
rg -n '\"[A-Za-z][^\"\\n]*\"' src/screens src/components App.tsx | sed -n '1,260p'
```

What this validated:
- the new guest entry CTA copy is translation-backed
- back/close header labels are translation-backed
- budget/recurring local-only notices remain explicit in code and UI

What remains inferred:
- there may still be low-priority raw runtime error text coming from backend or thrown exceptions, because some messages intentionally surface `error.message`
- full per-screen translation completeness was not proven by rendering every screen on device

### Simulator / device capability checks
Commands used:

```bash
xcrun simctl list devices
adb devices
npx expo --version
```

Results:
- `xcrun simctl list devices`: succeeded
- `adb devices`: failed, `adb` is not installed
- `npx expo --version`: succeeded, `54.0.23`

Meaning:
- iOS simulator tooling was available
- Android runtime validation was not possible from this environment

### Real iOS build / install / open attempt
Commands used:

```bash
npx expo run:ios -d "iPhone 16e"
npx expo run:ios -d "iPhone 16e" --port 8081
npx expo start --dev-client --port 8081 --offline
```

Observed results:

1. `npx expo run:ios -d "iPhone 16e"`
- failed in Expo CLI automatic port selection
- error: `RangeError: options.port should be >= 0 and < 65536. Received type number (65536)`
- this was an environment/tooling failure, not an app compile failure

2. `npx expo run:ios -d "iPhone 16e" --port 8081`
- succeeded
- native iOS app built successfully
- app installed to simulator
- app opened on simulator as `com.anonymous.mycost`

3. `npx expo start --dev-client --port 8081 --offline`
- dev client Metro start command launched
- Expo warned about shared URI scheme expectations
- no conclusive proof of JS bundle consumption was captured from simulator logs

4. `xcrun simctl openurl ...`
- later failed because CoreSimulatorService became invalid
- that prevented a stronger post-launch log/open check

## What Was Actually Proven

### Proven by execution
- TypeScript compilation passes after the bugfix
- unit tests pass after the bugfix
- iOS native build succeeds
- iOS simulator install succeeds
- app open command succeeds on iPhone 16e simulator

### Proven by code audit, not interaction
- guest startup now repairs invalid guest default IDs before guest seeding
- default duplicate cleanup no longer preserves bad guest IDs
- guest users now have visible sign-in / create-account entry points on Home and Settings
- internal drill-down and modal screens now have explicit back/close affordances

## What Was Only Inferred
- the exact sign-out -> guest runtime failure is now fixed by code path and data repair logic
- guest seeding is now idempotent for the reported duplicate-ID class of issue
- navigation affordances should behave correctly because they call `navigation.goBack()` or `navigation.navigate("AuthEntry")` from valid stack contexts

These points are strongly supported by code inspection, but they were not replayed end-to-end by automated simulator interaction.

## Whether Sign-Out -> Guest Flow Was Actually Proven
No. It was **not fully proven by automated runtime interaction**.

What was done:
- root cause traced in code
- fix implemented in runtime, repair, and seed paths
- iOS app built, installed, and opened successfully

What was **not** done:
- automatic tap-through of sign in -> sign out -> guest mode
- automatic observation that guest startup completed without the original SQLite uniqueness error

So the sign-out -> guest fix is currently:
- code-audited
- compile-validated
- partially runtime-supported by successful app build/install/open
- still requiring manual end-to-end confirmation

## Remaining Gaps
- Android runtime validation was not possible because `adb` is unavailable.
- iOS JS-runtime completion after launch was not fully proven because simulator service/log access became unstable after the successful build/install/open.
- Live Supabase sign-in/sign-out was not re-executed in this environment.
- The exact manual repro sequence for the original bug was not replayed automatically.

## Honest Bottom Line
This pass materially strengthened validation compared with prior rounds because the app now:

- compiles
- passes unit tests
- builds natively for iOS
- installs on a real simulator
- opens in the simulator

But the specific user-reported sign-out -> guest repro is still **partially validated, not fully proven**, because this environment did not provide reliable interactive simulator automation or stable post-launch simulator log inspection.
