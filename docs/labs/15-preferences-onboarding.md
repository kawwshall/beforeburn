# Lab 15 — Build onboarding and save preferences

## What you will build

After account creation, a person answers a small onboarding flow: time zone, usual sleep window, and whether they prefer reduced motion. The app saves those answers to the protected FastAPI route created in Lab 10: `PATCH /me/preferences`.

This is the general pattern for a profile/preferences feature: collect a small amount of optional user data, validate it on the device for usability, validate it again on the server for safety, and always attach it to the signed-in user—not an ID supplied by the screen.

## Before you start

- Lab 10’s `/me/preferences` route and tests pass.
- Lab 14’s sign-in flow works.
- The API is running locally at `http://127.0.0.1:8000`.

## 1. Give the app an API base URL

Add this to `apps/mobile/.env` and `.env.example`:

```dotenv
EXPO_PUBLIC_API_URL=http://127.0.0.1:8000
```

On a physical phone, `127.0.0.1` means the phone itself, not your Mac. Replace it with your Mac’s local-network IP while testing on a phone, for example `http://192.168.1.25:8000`. Keep the API and phone on the same Wi-Fi network. This URL is public configuration; it is not a secret.

## 2. Create one authenticated request helper

Create `apps/mobile/lib/api.ts`:

```ts
import { supabase } from '@/lib/supabase';

const apiUrl = process.env.EXPO_PUBLIC_API_URL;

if (!apiUrl) throw new Error('Missing EXPO_PUBLIC_API_URL.');

export async function apiFetch(path: string, options: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('You are signed out.');

  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail ?? 'Something went wrong. Please try again.');
  }

  return response;
}
```

The helper is deliberately small. It reads the current token immediately before each request, rather than keeping an old copied token in component state. It also centralizes the authorization header so one screen cannot accidentally forget it.

## 3. Define the data shape once

Create `apps/mobile/types/preferences.ts`:

```ts
export type PreferencesUpdate = {
  time_zone?: string;
  sleep_start?: string | null;
  sleep_end?: string | null;
  reduced_motion?: boolean;
};
```

Types do not send anything to the server. They help TypeScript catch mistakes before the app runs. The field names must match the API schema from Lab 10 exactly.

## 4. Create the onboarding route

Create `apps/mobile/app/(auth)/onboarding.tsx`. Begin with three pieces of state:

```tsx
const [step, setStep] = useState(0);
const [timeZone, setTimeZone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
const [reducedMotion, setReducedMotion] = useState(false);
const [isSaving, setIsSaving] = useState(false);
const [error, setError] = useState<string | null>(null);
```

Render one question at a time. Use a visible step label such as `Step 1 of 3`, not dots alone. For the first version, use a text input for a timezone and explain that `Asia/Kolkata` is an example of an IANA timezone. A production app could later offer a searchable picker.

The final button calls:

```tsx
async function savePreferences() {
  setError(null);
  setIsSaving(true);
  try {
    await apiFetch('/me/preferences', {
      method: 'PATCH',
      body: JSON.stringify({
        time_zone: timeZone,
        reduced_motion: reducedMotion,
      }),
    });
    router.replace('/(tabs)');
  } catch (caught) {
    setError(caught instanceof Error ? caught.message : 'Could not save preferences.');
  } finally {
    setIsSaving(false);
  }
}
```

`finally` is important: it runs whether the request succeeds or fails, so the button never stays disabled forever.

## 5. Decide where new users go

In `create-account.tsx`, after a successful sign-up that gives a session, use:

```ts
router.replace('/onboarding');
```

For confirmed-email projects, the new user might have no session until they confirm and sign in. In that case, show the confirmation message and take them to Sign in; after a successful sign-in, show onboarding for now. Later we will record an explicit onboarding-complete flag if needed.

## 6. Test the whole boundary

Run both programs in separate terminals:

```bash
cd /Users/kaushal/Documents/ChatGPT/burnout-tracker-nysa/services/api
source .venv/bin/activate
uvicorn app.main:app --reload
```

```bash
cd /Users/kaushal/Documents/ChatGPT/burnout-tracker-nysa/apps/mobile
npx expo start --clear
```

1. Sign in.
2. Complete onboarding.
3. In the API terminal, confirm the request was `PATCH /me/preferences` and returned 200.
4. Stop and restart the mobile app; later, fetch the preferences to confirm they remain saved.
5. Remove the bearer token in the helper temporarily only in a local experiment: the API should return 401. Restore the code immediately.

## Common mistakes

- **Network request failed on a phone**: use your Mac’s LAN IP, not `127.0.0.1`.
- **401 Unauthorized**: verify the user is signed in and `apiFetch` sends the access token.
- **422 Unprocessable Entity**: compare JSON field names and values to the Pydantic schema; the API correctly rejected invalid input.
- **User reaches tabs without saving**: do not navigate until `apiFetch` resolves successfully.

## Independent exercise

Add an optional “sleep end” field. It should be absent until the learner enters it; do not send an empty string when the API expects a `time` or `null`. Explain the difference between “unknown/not provided” and an empty string.

## Commit

```bash
git add apps/mobile/.env.example apps/mobile/lib/api.ts apps/mobile/types/preferences.ts apps/mobile/app docs/labs/15-preferences-onboarding.md
git commit -m "feat(mobile): save onboarding preferences"
git push
```
