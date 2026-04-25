# Navigation And Entry Fix Report

## Where Sign-In Entry Points Were Added

### Home screen guest banner
Added a visible account/sync banner to [`src/screens/HomeScreen.tsx`](./src/screens/HomeScreen.tsx) for guest users.

It includes:
- `Sign in for sync`
- `Create account for sync`

Behavior:
- shown only when `auth.user` is not present
- wired through [`useAuthGate()`](./src/state/authGateContext.tsx)
- moves the app out of guest mode and opens the auth stack directly at Sign In or Sign Up

### Settings screen guest account card
Added a visible account card to [`src/screens/SettingsScreen.tsx`](./src/screens/SettingsScreen.tsx) for guest users.

It includes:
- guest/local mode explanation
- `Sign in for sync`
- `Create account for sync`

Behavior:
- shown only in guest/local mode
- gives users a persistent recovery path if they entered local mode first and later want an account

## Supporting Auth Navigation Changes

### Auth gate now supports explicit auth intents
[`src/state/authGateContext.tsx`](./src/state/authGateContext.tsx) now carries:

- `authEntryTarget`
- `openAuthEntry()`
- `openSignIn()`
- `openSignUp()`

### App shell now remounts auth navigation intentionally
[`App.tsx`](./App.tsx) now:

- tracks `authEntryTarget`
- keys navigation as `auth:entry`, `auth:signIn`, or `auth:signUp`
- passes the matching `initialRouteName` into [`AuthNavigator`](./src/navigation/AuthNavigator.tsx)

This means guest users are no longer trapped in local mode with no obvious way back into account flows.

## Which Screens Now Have Back/Close Controls

### Added back controls
- [`src/screens/MonthDetailScreen.tsx`](./src/screens/MonthDetailScreen.tsx)
- [`src/screens/CategoryTransactionsScreen.tsx`](./src/screens/CategoryTransactionsScreen.tsx)
- [`src/screens/CategoryManagementScreen.tsx`](./src/screens/CategoryManagementScreen.tsx)
- [`src/screens/RecurringExpensesScreen.tsx`](./src/screens/RecurringExpensesScreen.tsx)
- [`src/screens/SignInScreen.tsx`](./src/screens/SignInScreen.tsx)
- [`src/screens/SignUpScreen.tsx`](./src/screens/SignUpScreen.tsx)

### Added close control
- [`src/screens/AddExpenseScreen.tsx`](./src/screens/AddExpenseScreen.tsx)

### Shared header implementation
The control is implemented centrally in [`src/components/ScreenHeader.tsx`](./src/components/ScreenHeader.tsx) using:

- `leftAction={{ kind: "back", onPress: ... }}`
- `leftAction={{ kind: "close", onPress: ... }}`

The action labels are now translated through [`src/i18n/resources.ts`](./src/i18n/resources.ts):

- `common.back`
- `common.close`

## Design Rationale

### 1. Guest mode should never feel like a dead end
The app already supported local usage, but guest users had no strong in-product CTA to sign in later. Adding entry points on both Home and Settings fixes that in the most visible places:

- Home catches users during everyday use
- Settings catches users when they look for account/data controls

### 2. Internal stack screens need explicit navigation affordances
The app uses custom screen headers with native headers disabled in [`src/navigation/RootNavigator.tsx`](./src/navigation/RootNavigator.tsx). That means push screens and modal screens must provide their own left-side navigation controls. Without that, drill-down and management flows feel unfinished.

### 3. Back vs close should be consistent
- pushed stack screens now use `Back`
- modal editor uses `Close`

That distinction matches user expectation better than a one-size-fits-all button.

## Validation Notes
- Route wiring was rechecked by code audit in [`App.tsx`](./App.tsx), [`src/navigation/AuthNavigator.tsx`](./src/navigation/AuthNavigator.tsx), and [`src/navigation/RootNavigator.tsx`](./src/navigation/RootNavigator.tsx).
- Internal screen left actions were rechecked by repository search for `leftAction`.
- Sign-in CTA wiring was rechecked by repository search for `openSignIn` and `openSignUp`.
- Real on-device tapping of every back/close control was **not** fully automated in this environment.
