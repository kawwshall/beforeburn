# Lab 32 — Build a nap timer that survives backgrounding

## Goal

Build a timer that still shows correct remaining time when the app sleeps or closes. A decrementing counter loses time while JavaScript is suspended; an absolute end timestamp does not.

## Before you start

Complete Labs 11–12 and have a physical device or simulator for backgrounding tests. Timer arithmetic itself can be tested on web; notification delivery requires device testing.

Install the exact packages used by the files below:

```bash
cd apps/mobile
npx expo install expo-notifications @react-native-async-storage/async-storage
```

At module scope in `apps/mobile/app/_layout.tsx`, before rendering the router, add the notification behavior handler. Do not put this inside a component because it must be configured once:

```tsx
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});
```

## 1. Store timer state

Create `apps/mobile/lib/napTimer.ts`:

```ts
export function remainingSeconds(endsAt: string, now = Date.now()): number {
  return Math.max(0, Math.ceil((new Date(endsAt).getTime() - now) / 1000));
}

export function createNapEndTime(minutes: number, now = Date.now()): string {
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 60) {
    throw new Error('Nap duration must be between 1 and 60 minutes.');
  }
  return new Date(now + minutes * 60_000).toISOString();
}
```

The complete screen below persists `endsAt`, duration, and notification ID in AsyncStorage. On app resume, it calculates from the current clock instead of trusting an old counter value.

Use an interval only to refresh what is displayed:

```tsx
useEffect(() => {
  if (!endsAt) return;
  const tick = () => setSecondsLeft(remainingSeconds(endsAt));
  tick();
  const timerId = setInterval(tick, 1000);
  return () => clearInterval(timerId);
}, [endsAt]);
```

The interval does not determine elapsed time; it only asks the clock again. Cleanup prevents multiple ticking intervals after rerenders or screen changes.

## 2. Build timer UI

Create `apps/mobile/app/(tabs)/nap.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Pressable, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { createNapEndTime, remainingSeconds } from '../../lib/napTimer';

const STORAGE_KEY = 'beforeburn.napTimer.v1';
type SavedTimer = { endsAt: string; durationMinutes: number; notificationId: string | null };

export default function NapScreen() {
  const [saved, setSaved] = useState<SavedTimer | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [duration, setDuration] = useState(26);
  const [settle, setSettle] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((value) => {
      if (value) {
        const parsed = JSON.parse(value) as SavedTimer;
        if (Date.parse(parsed.endsAt) > Date.now()) {
          setSaved(parsed); setDuration(parsed.durationMinutes);
        } else {
          void AsyncStorage.removeItem(STORAGE_KEY);
        }
      }
    }).catch(() => Alert.alert('Timer unavailable', 'Saved timer could not be loaded.'))
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!saved) { setSecondsLeft(0); return; }
    const update = () => setSecondsLeft(remainingSeconds(saved.endsAt));
    update();
    const timerId = setInterval(update, 1000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') update();
    });
    return () => { clearInterval(timerId); subscription.remove(); };
  }, [saved]);

  useEffect(() => {
    if (saved && secondsLeft === 0) {
      setSaved(null);
      setCompleted(true);
      void AsyncStorage.removeItem(STORAGE_KEY);
    }
  }, [saved, secondsLeft]);

  async function startTimer() {
    setCompleted(false);
    const permission = await Notifications.getPermissionsAsync();
    let granted = permission.granted;
    if (!granted) {
      const answer = await new Promise<boolean>((resolve) => Alert.alert(
        'Allow a wake reminder?',
        'A notification can alert you when your nap timer ends, including when the app is in the background.',
        [{ text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
         { text: 'Allow', onPress: () => resolve(true) }],
      ));
      if (answer) granted = (await Notifications.requestPermissionsAsync()).granted;
    }
    const endsAt = createNapEndTime(duration + (settle ? 4 : 0));
    let notificationId: string | null = null;
    if (granted) {
      notificationId = await Notifications.scheduleNotificationAsync({
        content: { title: 'Nap timer', body: 'Your rest time is complete.' },
        trigger: new Date(endsAt),
      });
    }
    const next = { endsAt, durationMinutes: duration, notificationId };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSaved(next);
  }

  async function cancelTimer() {
    if (saved?.notificationId) {
      await Notifications.cancelScheduledNotificationAsync(saved.notificationId);
    }
    await AsyncStorage.removeItem(STORAGE_KEY);
    setSaved(null);
    setCompleted(false);
  }

  const minutes = Math.floor(secondsLeft / 60).toString().padStart(2, '0');
  const seconds = (secondsLeft % 60).toString().padStart(2, '0');
  if (!ready) return <View><ActivityIndicator accessibilityLabel="Loading timer" /></View>;
  return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 20, padding: 24 }}>
    <Text accessibilityRole="header">Nap timer</Text>
    {saved ? <>
      <Text accessibilityLiveRegion="polite" style={{ fontSize: 56 }}>{minutes}:{seconds}</Text>
      <Pressable accessibilityRole="button" onPress={() => void cancelTimer()}><Text>Cancel timer</Text></Pressable>
    </> : completed ? <>
      <Text accessibilityLiveRegion="polite">Your rest time is complete.</Text>
      <Pressable accessibilityRole="button" onPress={() => setCompleted(false)}><Text>Set another timer</Text></Pressable>
    </> : <>
      <Text>{duration} minutes</Text>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Shorter nap" onPress={() => setDuration(Math.max(1, duration - 5))}><Text>− 5 min</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Longer nap" onPress={() => setDuration(Math.min(60, duration + 5))}><Text>+ 5 min</Text></Pressable>
      </View>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: settle }} onPress={() => setSettle(!settle)}>
        <Text>{settle ? '✓ ' : ''}Add four-minute settling period</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => void startTimer()}>
        <Text>Start {duration + (settle ? 4 : 0)}-minute timer</Text>
      </Pressable>
    </>}
  </View>;
}
```

When the timer reaches zero, the scheduled notification is the background alert. The in-app completion state appears when the app is open; do not claim JavaScript will run at the exact end time while suspended.

## 3. Add local notification carefully

Only ask for notification permission after explaining the wake alert. If permission is denied, the timer still works while the app is open; clearly explain that background alert may be unavailable. Schedule a local notification for `endsAt`, cancel it when the user cancels, and avoid duplicate schedules after relaunch.

Install the SDK-compatible package:

```bash
cd apps/mobile
npx expo install expo-notifications
```

Schedule and retain the returned identifier:

```ts
const notificationId = await Notifications.scheduleNotificationAsync({
  content: { title: 'Nap timer', body: 'Your rest time is complete.' },
  trigger: new Date(endsAt),
});
```

Save `notificationId` with timer state. When the user cancels, call `Notifications.cancelScheduledNotificationAsync(notificationId)`. Test on a development build because behavior can differ from a web preview. See [Expo Notifications SDK documentation](https://docs.expo.dev/versions/latest/sdk/notifications/).

## 4. Test time behavior

Unit-test 1 second remaining, exact end, expired timestamp, invalid duration, and app-resume recalculation. Manually background the app and return after two minutes; remaining time should reflect elapsed wall-clock time.

## Exercise

Add a duration selector from 10 to 40 minutes in 5-minute increments. Keep the default at 26 and ensure the accessible label includes the chosen duration.

## Common mistakes

- Timer gains time after app resume: derive from persisted `endsAt`, not saved counter state.
- Multiple alarms fire: cancel an existing scheduled notification before scheduling a replacement.
- Permission denied blocks timer: keep in-app timer usable without notifications.

## Commit

```bash
git add apps/mobile docs/labs/32-nap-timer.md
git commit -m "feat: add resilient nap timer"
git push
```
