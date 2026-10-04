# Lab 33 — Let users control notifications

## Goal

Add reminder preferences while respecting the operating system's notification permission. A preference is not permission: the user may want reminders but the device may deny them.

## Before you start

Complete Labs 15–16 and 32. Preferences API, session state, and local scheduling behavior must be available.

## 1. Store preferences on the API

Use the existing one-row-per-user `UserPreference` model; do not create a second competing preferences table. In `app/models/user_preference.py`, add:

```python
daily_reminder_enabled: Mapped[bool] = mapped_column(
    Boolean(), nullable=False, server_default=false()
)
reminder_local_time: Mapped[time | None] = mapped_column(Time(), nullable=True)
```

In `app/schemas/preferences.py`, add `daily_reminder_enabled: bool` and `reminder_local_time: time | None` to `PreferencesResponse`, and add these optional fields to `PreferencesUpdate`:

```python
daily_reminder_enabled: bool | None = None
reminder_local_time: time | None = None
```

Inside the existing `PreferencesUpdate` validator, reject explicit null for the non-null boolean:

```python
if "daily_reminder_enabled" in self.model_fields_set and self.daily_reminder_enabled is None:
    raise ValueError("daily_reminder_enabled cannot be null")
```

The existing preferences service applies only `model_dump(exclude_unset=True)`, so no new route is needed. Generate and inspect the migration, then apply:

```bash
cd services/api
alembic revision --autogenerate -m "add reminder preferences"
alembic upgrade head
alembic current
```

## 2. Add the protected API behavior

Extend `GET/PATCH /me/preferences`. Validate local time format and derive owner from auth. Test the default, changing time, disabling, and invalid time. A disabled setting should not retain a misleading active scheduled job.

For clarity, the complete new part of the Pydantic update schema is:

```python
from datetime import time
from pydantic import BaseModel


class NotificationPreferencesUpdate(BaseModel):
    daily_reminder_enabled: bool | None = None
    reminder_local_time: time | None = None
```

In the service, update only fields actually sent by the user:

```python
changes = payload.model_dump(exclude_unset=True)
for field, value in changes.items():
    setattr(preferences, field, value)
```

`exclude_unset=True` means “leave omitted fields alone.” This differs from a field explicitly sent as `null`.

## 3. Build the settings screen

Install the Expo-compatible date/time picker and notification packages:

```bash
cd apps/mobile
npx expo install expo-notifications @react-native-async-storage/async-storage @react-native-community/datetimepicker
```

Create `apps/mobile/lib/reminders.ts`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { apiFetch } from './api';

const ID_KEY = 'beforeburn.dailyReminder.notificationId';
type Reminder = { daily_reminder_enabled: boolean; reminder_local_time: string | null };

export async function loadReminder(): Promise<Reminder> {
  const response = await apiFetch('/me/preferences');
  if (!response.ok) throw new Error('Could not load reminder settings.');
  const value = await response.json();
  return { daily_reminder_enabled: value.daily_reminder_enabled,
    reminder_local_time: value.reminder_local_time };
}

export async function saveReminder(value: Reminder): Promise<void> {
  const response = await apiFetch('/me/preferences', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  });
  if (!response.ok) throw new Error('Could not save reminder settings.');
}

export async function scheduleReminder(time: string): Promise<void> {
  const [hour, minute] = time.slice(0, 5).split(':').map(Number);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23 ||
      !Number.isInteger(minute) || minute < 0 || minute > 59) {
    throw new Error('Enter a time in 24-hour HH:MM format.');
  }
  const previous = await AsyncStorage.getItem(ID_KEY);
  const id = await Notifications.scheduleNotificationAsync({
    content: { title: 'A gentle reminder', body: 'Take a moment to check in with yourself.' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
  });
  if (previous) {
    try { await Notifications.cancelScheduledNotificationAsync(previous); }
    catch (error) {
      await Notifications.cancelScheduledNotificationAsync(id);
      throw error;
    }
  }
  await AsyncStorage.setItem(ID_KEY, id);
}

export async function cancelReminder(): Promise<void> {
  const id = await AsyncStorage.getItem(ID_KEY);
  if (id) await Notifications.cancelScheduledNotificationAsync(id);
  await AsyncStorage.removeItem(ID_KEY);
}
```

Create `apps/mobile/components/ReminderSettings.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Switch, Text, TextInput, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { cancelReminder, loadReminder, saveReminder, scheduleReminder } from '../lib/reminders';

export function ReminderSettings() {
  const [enabled, setEnabled] = useState(false);
  const [time, setTime] = useState('09:00');
  const [savedTime, setSavedTime] = useState('09:00');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => { loadReminder().then((value) => {
    setEnabled(value.daily_reminder_enabled);
    if (value.reminder_local_time) {
      const saved = value.reminder_local_time.slice(0, 5);
      setTime(saved); setSavedTime(saved);
    }
  }).catch(() => setMessage('Could not load settings. Retry by reopening this screen.'))
    .finally(() => setLoading(false)); }, []);

  async function toggle(next: boolean) {
    setBusy(true); setMessage('');
    try {
      if (next) {
        const current = await Notifications.getPermissionsAsync();
        const permission = current.granted ? current : await Notifications.requestPermissionsAsync();
        if (!permission.granted) { setMessage('Allow notifications in device settings to receive reminders.'); return; }
        await scheduleReminder(time);
        try { await saveReminder({ daily_reminder_enabled: true, reminder_local_time: `${time}:00` }); }
        catch (error) { await cancelReminder(); throw error; }
      } else {
        await cancelReminder();
        try { await saveReminder({ daily_reminder_enabled: false, reminder_local_time: `${time}:00` }); }
        catch (error) { await scheduleReminder(time); throw error; }
      }
      setEnabled(next); setMessage('Saved');
    } catch { setMessage('Could not save. Your previous setting remains.'); }
    finally { setBusy(false); }
  }

  async function saveTime() {
    setBusy(true); setMessage('');
    try {
      await saveReminder({ daily_reminder_enabled: enabled, reminder_local_time: `${time}:00` });
      if (enabled) {
        try { await scheduleReminder(time); }
        catch (error) {
          await saveReminder({ daily_reminder_enabled: true, reminder_local_time: `${savedTime}:00` });
          throw error;
        }
      }
      setSavedTime(time);
      setMessage('Saved');
    } catch { setMessage('Could not save reminder time.'); }
    finally { setBusy(false); }
  }

  if (loading) return <ActivityIndicator accessibilityLabel="Loading reminder settings" />;
  return <View style={{ padding: 16, gap: 12 }}>
    <Text accessibilityRole="header">Daily reminder</Text>
    <Text>Choose whether this device should send one gentle check-in reminder each day.</Text>
    <Switch value={enabled} disabled={busy} accessibilityLabel="Daily reminder enabled" onValueChange={(value) => void toggle(value)} />
    <TextInput accessibilityLabel="Reminder time, 24-hour format" value={time} onChangeText={setTime}
      placeholder="09:00" keyboardType="numbers-and-punctuation" />
    <Pressable accessibilityRole="button" disabled={busy} onPress={() => void saveTime()}><Text>Save time</Text></Pressable>
    {message !== '' && <Text accessibilityLiveRegion="polite">{message}</Text>}
  </View>;
}
```

Use Expo's notifications library installed for the current SDK. Schedule one local reminder, cancel/re-schedule when time changes, and store its identifier locally. On denied permission, keep the preference choice understandable and link to device settings where supported; do not repeatedly prompt.

Keep device permission handling in a small function so it can be tested independently:

```ts
async function enableReminder() {
  const current = await Notifications.getPermissionsAsync();
  const permission = current.granted
    ? current
    : await Notifications.requestPermissionsAsync();
  if (!permission.granted) return { enabled: false, reason: 'permission-denied' as const };
  await saveReminderPreference(true);
  return { enabled: true as const };
}
```

The settings row should explain the denied state; do not silently save “enabled” when the OS cannot deliver it.

## 4. Verify

Test permission granted, denied, revoked in system settings, reminder disabled, time changed, timezone changed, and app relaunch. Ensure no duplicate reminders exist.

## Exercise

Propose a default reminder frequency that respects quiet hours. Explain which setting is stored by beforeburn and which permission belongs to iOS/Android.

## Common mistakes

- Preference says on while OS denies permission: show both states separately.
- Time changes create extra notifications: cancel and replace the stored notification ID.
- Asking on first launch: ask after the user enables reminders and understands why.

## Commit

```bash
git add services/api/app services/api/migrations services/api/tests apps/mobile docs/labs/33-notification-settings.md
git commit -m "feat: add notification settings"
git push
```
