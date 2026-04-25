# SecureStore Usage Report

## What Was Being Stored

### Exact key
The Supabase auth client was implicitly using the default auth storage key derived from the project URL:

- `sb-tnwskqqukifffnoxxret-auth-token`

This comes from Supabase’s default storage-key convention and matches the project ref in:
- [`EXPO_PUBLIC_SUPABASE_URL`](./.env)

### Other related keys
Supabase auth may also use:
- `sb-tnwskqqukifffnoxxret-auth-token-code-verifier`

After this fix, the app also uses:
- `sb-tnwskqqukifffnoxxret-auth-token-user`

### Where the storage behavior came from
Before this fix, [`src/auth/supabaseClient.ts`](./src/auth/supabaseClient.ts) passed raw `expo-secure-store` methods directly as the auth storage adapter:

- `getItem: SecureStore.getItemAsync`
- `setItem: SecureStore.setItemAsync`
- `removeItem: SecureStore.deleteItemAsync`

with `persistSession: true`.

That meant the main Supabase session payload was stored directly in SecureStore under the auth token key.

## Why The Payload Exceeded The Warning Threshold
The oversized payload came from persisting the **full Supabase session JSON**, including the embedded `session.user` object.

That object can include:
- email and account metadata
- timestamps
- app metadata
- user metadata
- identities / provider arrays

This can easily exceed Expo SecureStore’s recommended 2048-byte threshold.

The warning you saw:

- `Value being stored in SecureStore is larger than 2048 bytes and it may not be stored successfully`

is therefore consistent with raw Supabase session persistence.

## What Was Changed

### 1. Added explicit auth-storage module
Created [`src/auth/authStorage.ts`](./src/auth/authStorage.ts).

It now defines:
- `SUPABASE_AUTH_STORAGE_KEY`
- `SUPABASE_AUTH_USER_STORAGE_KEY`
- `supabaseSessionStorage`
- `supabaseUserStorage`
- `prepareSupabaseAuthStorage()`

### 2. Split session storage from user storage
[`src/auth/supabaseClient.ts`](./src/auth/supabaseClient.ts) now configures Supabase auth with:

- explicit `storageKey`
- `storage: supabaseSessionStorage`
- `userStorage: supabaseUserStorage`

This uses Supabase auth-js’s built-in split-storage path so the main auth key stores the smaller session core and the user object is separated.

### 3. Sanitized the user payload
The new `supabaseUserStorage.setItem()` sanitizes the stored user envelope before writing it to SecureStore.

It keeps only a reduced subset of fields such as:
- `id`
- `aud`
- `role`
- `email`
- `phone`
- confirm/sign-in timestamps
- trimmed `app_metadata`
- trimmed `user_metadata`

It intentionally drops bulky structures like provider identity arrays.

### 4. Added legacy cleanup before session restore
[`prepareSupabaseAuthStorage()`](./src/auth/authStorage.ts) runs before `getSession()` in [`src/auth/authStore.ts`](./src/auth/authStore.ts).

If it finds an older oversized session stored under:
- `sb-tnwskqqukifffnoxxret-auth-token`

with an inline `user` object, it:
- moves a sanitized user payload into `...-user`
- rewrites the main session key without the embedded user object

That directly addresses the misuse instead of ignoring the warning.

## Remaining Risk

### Still possible
- If a provider returns unusually large metadata even after sanitization, the `...-user` key could still grow, though it should be much smaller than before.
- If an old oversized SecureStore write already failed in a prior run, there may be nothing valid to migrate from that failed write.

### Reduced
- The main auth session key should now be materially smaller because the embedded user object is split out.
- The separated user payload is now trimmed before persistence.

## What Was Actually Validated
- Type validation passed after the auth-storage change.
- Unit tests passed after the auth-storage change.
- iOS build/install/open passed after the auth-storage change.

## What Was Not Runtime-Proven
- I did **not** execute a real sign-in after this change and observe the SecureStore warning disappear from the live terminal.
- I did **not** dump SecureStore contents from the running simulator device.

So the SecureStore fix is:
- code-correct and targeted at the real misuse
- compile-validated
- not yet fully runtime-proven by a fresh sign-in session in this environment
