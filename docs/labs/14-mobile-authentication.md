# Lab 14 — Add real mobile authentication

## What you will build

The Welcome and Sign-in screens from Lab 13 will start using **Supabase Auth**. A person can create an account, sign in, see a useful error if it fails, and remain signed in after reopening the app.

This is a reusable pattern for almost every app: the mobile app talks to an identity provider; the API later verifies the token it receives. The mobile app must never receive the database connection string or a server-only secret.

## Before you start

- Labs 11–13 are complete.
- Your Supabase project from Lab 4 is active.
- You can run `npx expo start` from `apps/mobile`.
- Supabase Authentication → Providers → Email is enabled.

## Concepts

| Word | Meaning |
| --- | --- |
| Authentication | Proving who the person is, usually with email and password. |
| Session | The short-lived proof Supabase gives the app after sign-in. |
| Access token | The part of the session sent as `Authorization: Bearer ...` to our API. |
| Persistence | Saving the session locally so reopening the app does not mean signing in again. |
| Public key | A key allowed in a client app; it identifies the Supabase project but does not bypass Row Level Security. |

## 1. Install the mobile dependencies

In the VS Code terminal:

```bash
cd /Users/kaushal/Documents/ChatGPT/burnout-tracker-nysa/apps/mobile
npx expo install @supabase/supabase-js @react-native-async-storage/async-storage react-native-url-polyfill
```

`@supabase/supabase-js` is the client library. Async Storage is the phone’s small, persistent key-value store. It stores the session—not a database password.

## 2. Add safe mobile environment variables

Create `apps/mobile/.env`:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR-PUBLISHABLE-KEY
```

Copy the two values from Supabase Dashboard → Connect. The `EXPO_PUBLIC_` prefix means Expo can include them in the mobile bundle. That is acceptable for these two values only. Never put `DATABASE_URL`, a service-role key, Google client secret, or JWT signing secret here.

Create `apps/mobile/.env.example` with the same variable names and placeholder values. Check that `.env` is ignored by Git before continuing:

```bash
git check-ignore apps/mobile/.env
```

It should print `apps/mobile/.env`.

## 3. Create one Supabase client

Create `apps/mobile/lib/supabase.ts`:

```ts
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('Missing Supabase mobile environment variables.');
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

Why these lines matter:

- `createClient` makes one reusable connection point; do not create a new client inside every screen.
- `storage: AsyncStorage` persists the session across app restarts.
- `autoRefreshToken` replaces an expiring access token when possible.
- `detectSessionInUrl: false` avoids a browser-only behavior that React Native does not need.

## 4. Add a session provider

Create `apps/mobile/providers/SessionProvider.tsx`:

```tsx
import { Session } from '@supabase/supabase-js';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

type SessionContextValue = {
  session: Session | null;
  isLoading: boolean;
};

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setIsLoading(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  return (
    <SessionContext.Provider value={{ session, isLoading }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider.');
  return value;
}
```

A provider is shared React state. It asks Supabase for the saved session once, then listens for sign-in and sign-out changes. Screens can use `useSession()` without passing session data through many component props.

## 5. Wrap the root navigator

In `apps/mobile/app/_layout.tsx`, import `SessionProvider` and wrap the existing `<Stack>`:

```tsx
import { SessionProvider } from '@/providers/SessionProvider';

// Return this from RootLayout:
return (
  <SessionProvider>
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  </SessionProvider>
);
```

## 6. Connect the sign-in form

In `apps/mobile/app/(auth)/sign-in.tsx`, add `isSubmitting` state and replace the sign-in button handler with this function:

```tsx
async function signIn() {
  if (!email.trim() || !password) {
    setError('Enter both your email and password.');
    return;
  }

  setError(null);
  setIsSubmitting(true);
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  setIsSubmitting(false);

  if (error) {
    setError(error.message);
    return;
  }

  router.replace('/(tabs)');
}
```

Add an error `<Text accessibilityLiveRegion="polite">` near the form and disable the button while `isSubmitting` is true. `trim()` avoids a confusing failure caused by an accidental space around an email address. `replace` prevents a signed-in person returning to the sign-in screen with Back.

Create `apps/mobile/app/(auth)/create-account.tsx` by copying the sign-in layout. Change its submit call to:

```ts
const { error } = await supabase.auth.signUp({
  email: email.trim(),
  password,
});
```

Tell the person to check their email if confirmation is enabled in Supabase. Do not claim the account is usable until Supabase has returned no error.

## 7. Verify manually

Restart Expo after changing `.env`:

```bash
npx expo start --clear
```

1. Create a new account using an email you can access.
2. Complete confirmation if your Supabase project requires it.
3. Sign in and reach the tab area.
4. Close and reopen the app: the session should still exist.
5. Enter a deliberately wrong password: the error must appear and the app must not navigate.

## Common mistakes

- **“Missing Supabase mobile environment variables”**: restart Expo; Expo only reads `.env` when starting.
- **`Invalid API key`**: use the project’s publishable key, not an old copied value.
- **Session disappears**: check that `storage: AsyncStorage` and `persistSession: true` are present.
- **A secret appeared in Git**: revoke it in Supabase, remove it from the commit history with help from a maintainer, and use `.env` instead.

## Independent exercise

Add an accessible “Show password” control. Its label must change between “Show password” and “Hide password,” and it must toggle `secureTextEntry`. Explain why a text label alone is not enough for a screen-reader user.

## Commit

```bash
git add apps/mobile/.env.example apps/mobile/lib/supabase.ts apps/mobile/providers/SessionProvider.tsx apps/mobile/app docs/labs/14-mobile-authentication.md
git commit -m "feat(mobile): add Supabase authentication"
git push
```
