# Lab 27 — Complete the check-in flow

## Goal

Prompt at most once per local date, save through Lab 24's API, and let the user skip or edit. Network failure must never pretend unsaved data was stored.

## Before you start

Complete Lab 24. Confirm the API create/read/update tests pass and the app can make an authenticated request.

## 1. Decide prompt behavior

On Plan screen load, fetch today's check-in. If absent and not dismissed for this app session, show the check-in card. “Not now” hides it for the current session; it does not create a fake score. An existing record opens in edit mode.

## 2. Create a focused mobile component

Create `apps/mobile/lib/checkIns.ts` for the API call:

```ts
import { apiFetch } from './api';

export async function saveDailyCheckIn(day: string, score: number) {
  const response = await apiFetch(`/me/check-ins/${encodeURIComponent(day)}`, {
    method: 'PUT',
    body: JSON.stringify({ energy_score: score }),
  });
  if (!response.ok) throw new Error('Could not save your check-in.');
  return response.json() as Promise<{ energy_score: number }>;
}

export async function getDailyCheckIn(day: string) {
  const response = await apiFetch(`/me/check-ins/${encodeURIComponent(day)}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Could not load your check-in.');
  return response.json() as Promise<{ energy_score: number; note: string | null }>;
}
```

This helper centralizes the route and JSON shape; the component does not need to know HTTP details.

Call `PUT /me/check-ins/{local-date}` with the score. Show “Saved” only after a successful response. If the request fails, retain the selected score and show Retry so the user does not need to re-enter it.

The save handler should guard duplicate taps and preserve input on failure:

```tsx
async function save() {
  if (selectedScore == null || isSaving) return;
  setIsSaving(true);
  setError(null);
  try {
    await saveDailyCheckIn(localDate, selectedScore);
    setSaved(true);
  } catch {
    setError('Your check-in was not saved. Check your connection and retry.');
  } finally {
    setIsSaving(false);
  }
}
```

Do not clear `selectedScore` in `catch`; preserving it makes retry less frustrating.

Now create the complete `apps/mobile/components/DailyCheckIn.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { saveDailyCheckIn } from '../lib/checkIns';

type Props = { localDate: string; initialScore: number | null;
  onSaved: () => void; onDismiss: () => void };

export function DailyCheckIn({ localDate, initialScore, onSaved, onDismiss }: Props) {
  const [score, setScore] = useState<number | null>(initialScore);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setScore(initialScore); setSaved(false); }, [initialScore, localDate]);

  async function save() {
    if (score === null || saving) return;
    setSaving(true); setError(null);
    try { await saveDailyCheckIn(localDate, score); setSaved(true); onSaved(); }
    catch { setError('Your check-in was not saved. Check your connection and retry.'); }
    finally { setSaving(false); }
  }

  return <View style={{ padding: 16, gap: 12 }}>
    <Text accessibilityRole="header">How is your energy today?</Text>
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {[1, 2, 3, 4, 5].map((value) => <Pressable key={value}
        accessibilityRole="radio" accessibilityState={{ selected: score === value }}
        accessibilityLabel={`Energy ${value} of 5`} onPress={() => setScore(value)}>
        <Text>{score === value ? `● ${value}` : `${value}`}</Text>
      </Pressable>)}
    </View>
    <Text>{score === null ? 'Choose an energy level from 1 to 5.' : `Energy: ${score} of 5`}</Text>
    <Pressable accessibilityRole="button" disabled={score === null || saving} onPress={() => void save()}>
      <Text>{saving ? 'Saving…' : initialScore === null ? 'Save check-in' : 'Update check-in'}</Text>
    </Pressable>
    {saved && <Text accessibilityLiveRegion="polite">Saved</Text>}
    {error && <Text accessibilityRole="alert">{error}</Text>}
    <Pressable accessibilityRole="button" onPress={onDismiss}><Text>Not now</Text></Pressable>
  </View>;
}
```

## 3. Avoid unsafe optimistic updates

For this lesson, wait for the server response before showing completion. Optimistic UI can feel faster, but it requires restoring previous state if the request fails. Add it only after you can demonstrate that rollback behavior.

## 4. Test all states

Test first check-in, edit, skip, server error, retry success, signed-out 401, and date change at midnight. Confirm a failed request does not display “Saved.”

For the API test, send the same PUT twice and assert one row exists for that owner and date. For a mobile component test, mock `saveDailyCheckIn` to reject and assert the error appears while the selected score remains selected.

## Exercise

Add an accessible “Not now” button. Explain whether dismissal is stored locally, on the server, or both, and why.

## Common mistakes

- Save button submits twice: disable it while `isSaving` and guard in the handler.
- Failed save loses selection: keep input state when the request rejects.
- Dismissal creates a score: skip is not a data point; do not invent a value.

## Commit

```bash
git add apps/mobile services/api/tests docs/labs/27-check-in-experience.md
git commit -m "feat: complete energy check-in experience"
git push
```
