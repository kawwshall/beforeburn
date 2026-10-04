# Lab 22 — Build Week and Month planning views

## What you will build

Use the event query from Lab 21 to show a seven-day view and a month grid. Both views reuse the same event contract and explain busy days in text.

## Before you start

Complete Lab 21. The Day view must return correct events for a selected local date before building aggregate calendar views.

## 1. Add tested calendar-date helpers

Create `apps/mobile/lib/calendarDates.ts`:

```ts
export function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function startOfWeek(date: Date, weekStartsOn = 1): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysSinceStart = (result.getDay() - weekStartsOn + 7) % 7;
  result.setDate(result.getDate() - daysSinceStart);
  return result;
}

export function monthGridDays(year: number, monthIndex: number, weekStartsOn = 1): Date[] {
  const first = startOfWeek(new Date(year, monthIndex, 1), weekStartsOn);
  const lastDay = new Date(year, monthIndex + 1, 0);
  const last = startOfWeek(lastDay, weekStartsOn);
  last.setDate(last.getDate() + 6);
  const days: Date[] = [];
  for (const cursor = new Date(first); cursor <= last; cursor.setDate(cursor.getDate() + 1)) {
    days.push(new Date(cursor));
  }
  return days;
}
```

The Date objects are local calendar dates. Avoid converting a date-only key using `new Date('YYYY-MM-DD')`; JavaScript may interpret that as UTC and display the prior date in some time zones.

## 2. Test the helpers

Create `apps/mobile/lib/calendarDates.test.ts` using the test framework installed by your Expo project. Test a month that begins Sunday, February in a leap year, a week spanning two months, and the configured week-start day. If no test runner is installed yet, use a temporary screen or Node command to inspect outputs and schedule the tests for Lab 37.

## 3. Load events for a visible date range

Create `apps/mobile/lib/eventRange.ts`. The API returns a single bounded count query for all visible days:

```ts
import { apiFetch } from './api';
import { dateKey } from './calendarDates';

export async function getEventCounts(days: Date[]): Promise<Record<string, number>> {
  if (days.length === 0 || days.length > 45) throw new Error('Date range must contain 1–45 days.');
  const start = dateKey(days[0]);
  const end = dateKey(days[days.length - 1]);
  const response = await apiFetch(`/me/events/range?start=${start}&end=${end}`);
  if (!response.ok) throw new Error('Could not load calendar counts.');
  return response.json() as Promise<Record<string, number>>;
}
```

## 4. Build the Week view

Create `apps/mobile/app/(tabs)/week.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { dateKey, startOfWeek } from '../../lib/calendarDates';
import { getEventCounts } from '../../lib/eventRange';

export default function WeekScreen() {
  const [selected, setSelected] = useState(() => new Date());
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const first = startOfWeek(selected, 1);
    return new Date(first.getFullYear(), first.getMonth(), first.getDate() + i);
  }), [dateKey(selected)]);
  async function load() {
    setLoading(true); setError(false);
    try { setCounts(await getEventCounts(days)); } catch { setError(true); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [days.map(dateKey).join(',')]);
  return <View style={{ padding: 16, gap: 12 }}>
    <Text accessibilityRole="header">This week</Text>
    {loading ? <ActivityIndicator accessibilityLabel="Loading week" /> : error ? <>
      <Text accessibilityRole="alert">Could not load this week.</Text>
      <Pressable accessibilityRole="button" onPress={() => void load()}><Text>Retry</Text></Pressable>
    </> : days.map((day) => {
      const key = dateKey(day); const count = counts[key] ?? 0;
      return <Pressable key={key} accessibilityRole="button"
        accessibilityLabel={`${day.toLocaleDateString(undefined, { dateStyle: 'full' })}, ${count} events`}
        accessibilityState={{ selected: key === dateKey(selected) }} onPress={() => setSelected(day)}>
        <Text>{day.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })} — {count} event{count === 1 ? '' : 's'}</Text>
      </Pressable>;
    })}
    <Text>Selected: {selected.toLocaleDateString(undefined, { dateStyle: 'full' })}</Text>
  </View>;
}
```

## 5. Build the Month view

Create `apps/mobile/app/(tabs)/month.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { dateKey, monthGridDays } from '../../lib/calendarDates';
import { getEventCounts } from '../../lib/eventRange';

export default function MonthScreen() {
  const [selected, setSelected] = useState(() => new Date());
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const days = useMemo(() => monthGridDays(selected.getFullYear(), selected.getMonth(), 1),
    [selected.getFullYear(), selected.getMonth()]);
  async function load() {
    setLoading(true); setError(false);
    try { setCounts(await getEventCounts(days)); } catch { setError(true); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [days.map(dateKey).join(',')]);
  const monthLabel = selected.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  return <View style={{ padding: 12, gap: 12 }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Previous month"
        onPress={() => setSelected(new Date(selected.getFullYear(), selected.getMonth() - 1, 1))}><Text>‹</Text></Pressable>
      <Text accessibilityRole="header">{monthLabel}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Next month"
        onPress={() => setSelected(new Date(selected.getFullYear(), selected.getMonth() + 1, 1))}><Text>›</Text></Pressable>
    </View>
    {loading ? <ActivityIndicator accessibilityLabel="Loading month" /> : error ? <>
      <Text accessibilityRole="alert">Could not load this month.</Text>
      <Pressable accessibilityRole="button" onPress={() => void load()}><Text>Retry</Text></Pressable>
    </> : <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {days.map((day) => {
        const key = dateKey(day); const count = counts[key] ?? 0;
        return <Pressable key={key} style={{ width: '14.28%', minHeight: 56 }}
          accessibilityRole="button"
          accessibilityLabel={`${day.toLocaleDateString(undefined, { dateStyle: 'full' })}, ${count} events`}
          accessibilityState={{ selected: key === dateKey(selected) }} onPress={() => setSelected(day)}>
          <Text style={{ opacity: day.getMonth() === selected.getMonth() ? 1 : 0.45 }}>{day.getDate()}</Text>
          <Text>{count > 0 ? `${count} events` : 'No events'}</Text>
        </Pressable>;
      })}
    </View>}
    <Text>Selected date: {selected.toLocaleDateString(undefined, { dateStyle: 'full' })}</Text>
  </View>;
}
```

Use a stable key and a selected state on each date button:

```tsx
<Pressable
  key={dateKey(day)}
  accessibilityRole="button"
  accessibilityLabel={day.toLocaleDateString(undefined, { dateStyle: 'full' })}
  accessibilityState={{ selected: dateKey(day) === dateKey(selectedDate) }}
  onPress={() => setSelectedDate(day)}
>
  <Text>{day.getDate()}</Text>
</Pressable>
```

The spoken label includes the full date while the compact visual can show only the day number.

In `apps/mobile/app/(tabs)/_layout.tsx`, register the new file-based routes in the existing `<Tabs>` component (keep your existing style options):

```tsx
<Tabs.Screen name="day" options={{ title: 'Day' }} />
<Tabs.Screen name="week" options={{ title: 'Week' }} />
<Tabs.Screen name="month" options={{ title: 'Month' }} />
```

Remove the Expo starter `index`/`two` screen entries after those files have been replaced. Route names come from filenames; these declarations provide the visible tab labels.

## Verify

Check week/month changes at year boundaries, leap day, and month edges. Compare the events shown for a selected date against the Day endpoint. Confirm keyboard/screen-reader focus reaches each date in a predictable order.

## Common mistakes

- Month grid has the wrong number of cells: calculate leading and trailing dates from week boundaries.
- Clicking a date changes the displayed day: avoid parsing date-only strings as UTC.
- Density is shown only by a colored dot: add a spoken/text event count.

## Exercise

Support a Sunday-start week. Update helper tests and ensure the Week and Month layouts agree.

## Commit

```bash
git add services/api/app services/api/tests apps/mobile docs/labs/22-week-and-month-views.md
git commit -m "feat(mobile): add week and month planning views"
git push
```
