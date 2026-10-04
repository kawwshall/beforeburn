# Lab 16 — Restore sessions and build the preferences screen

## What you will build

The app will restore a valid session at launch, show a Profile/Preferences screen, load saved preferences, allow edits, and sign the person out deliberately.

This lab completes a common account-management loop. Authentication is not finished at the first successful sign-in: people must be able to understand their account state, change their settings, and leave the app safely.

## Before you start

- Labs 14–15 work.
- `GET /me/preferences` and `PATCH /me/preferences` work in the API.

## 1. Add an authenticated entry decision

In `apps/mobile/app/index.tsx`, use the session provider. While it loads, render a simple `<ActivityIndicator />`. Then redirect:

```tsx
const { session, isLoading } = useSession();

useEffect(() => {
  if (!isLoading) {
    router.replace(session ? '/(tabs)' : '/welcome');
  }
}, [isLoading, session]);
```

Move the current Welcome screen to `app/welcome.tsx` and add a `<Stack.Screen name="welcome" />` in the root layout. The root index is now a decision screen, not a visible product screen.

Why: a saved session exists asynchronously in local storage. Redirecting before it finishes loading causes an annoying flash of Welcome for a person who is actually signed in.

## 2. Add a Profile tab

Create `apps/mobile/app/(tabs)/profile.tsx`, then add it to the tab layout. Start with a `useEffect` that calls `apiFetch('/me/preferences')`, parses the JSON, and stores it in state.

Use explicit states:

```text
loading  → spinner with “Loading preferences” label
error    → explanation and Retry button
data     → editable form
```

Do not leave the screen blank while the request happens. A blank screen does not tell the user whether the app is working, empty, or broken.

## 3. Build editable fields

Reuse the controlled-input pattern from Lab 13. Initialize local input state only after preferences load. On Save, call:

```ts
await apiFetch('/me/preferences', {
  method: 'PATCH',
  body: JSON.stringify({ time_zone: timeZone, reduced_motion: reducedMotion }),
});
```

Show a small “Saved” confirmation after success. Do not show it before the server responds.

## 4. Implement sign out

Add a clear Sign out button at the bottom of the Profile screen:

```tsx
async function signOut() {
  await supabase.auth.signOut();
  router.replace('/welcome');
}
```

Supabase clears the locally stored session. `replace` prevents the Back gesture from revealing private screens. For this simple first version, immediate sign-out is acceptable; Lab 36 will use a confirmation for irreversible deletion, which is a different risk level.

## 5. Verify

1. Sign in and edit a preference.
2. Force-close and reopen the app. It should land in the tabs, not Welcome.
3. Open Profile and confirm the changed value loads from the API.
4. Sign out. Relaunch the app; it should reach Welcome.
5. Press Back after sign-out; no private tab should appear.

## General lesson

The screen holds temporary form state; the API holds durable source-of-truth data; Supabase holds identity/session state. Keeping those responsibilities separate makes bugs easier to locate.

## Independent exercise

Before sign-out, show a confirmation modal with Cancel and Sign out buttons. Ensure the destructive-looking button has the more specific accessibility label “Sign out of beforeburn.”

## Commit

```bash
git add apps/mobile/app apps/mobile/providers docs/labs/16-session-and-preferences-screen.md
git commit -m "feat(mobile): add session-aware preferences screen"
git push
```
