# Lab 23 — Connect the calendar journey into one Plan area

## What you will build

This integration lab wires the prior pieces into one understandable flow: first-time empty state, connect, select, sync, day/week/month planning, and disconnect. Integration work is where independently working features often reveal mismatched assumptions.

## Before you start

Complete Labs 17–22. Have one test account, one synthetic connected calendar, and known test events. Use the same account for the full flow.

## 1. Agree on source-of-truth rules

Write these rules in a comment near the event service and in the app docs:

- Google is authoritative for events created in Google.
- beforeburn stores a read cache for planning and must refresh it from Google.
- beforeburn-created recovery blocks have a distinct origin and provider event ID.
- Removing a Google connection revokes/deletes stored credentials and stops future sync.
- Whether cached event details are immediately deleted on disconnect is an explicit retention choice; implement and explain one behavior.

Do not let sync overwrite a beforeburn-owned recovery record. A unique key must include source identity.

## 2. Build Plan navigation states

The Plan screen checks connection state from `GET /me/calendar-connections`. Render:

```text
not connected → explanation + Connect calendar
connected but no calendars selected → select calendars
selected but never synced → Sync now
synced → Day / Week / Month views and last sync time
request failed → safe error and Retry
```

These are different product situations; avoid showing one generic blank state.

Represent the state explicitly in `apps/mobile/types/plan.ts`:

```ts
export type PlanState =
  | { kind: 'not-connected' }
  | { kind: 'choose-calendar' }
  | { kind: 'needs-sync' }
  | { kind: 'ready'; lastSyncedAt: string }
  | { kind: 'error'; message: string };
```

Create `apps/mobile/app/(tabs)/plan.tsx`. This is the complete state loader and state renderer. It uses the endpoints and helpers introduced in Labs 17–20:

```tsx
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { apiFetch } from '../../lib/api';
import { refreshCalendarSources, syncCalendarSource } from '../../lib/calendarSources';
import { ConnectGoogleCalendar } from '../../components/ConnectGoogleCalendar';
import type { CalendarSource } from '../../types/calendarSource';
import type { PlanState } from '../../types/plan';

export default function PlanScreen() {
  const [state, setState] = useState<PlanState | null>(null);
  const [sources, setSources] = useState<CalendarSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const connectionResponse = await apiFetch('/me/calendar-connections');
      if (!connectionResponse.ok) throw new Error('Could not load calendar connection.');
      const connections = await connectionResponse.json() as { id: string }[];
      if (connections.length === 0) { setSources([]); setState({ kind: 'not-connected' }); return; }
      const calendarSources = await refreshCalendarSources();
      setSources(calendarSources);
      const enabled = calendarSources.filter((source) => source.is_enabled);
      if (enabled.length === 0) { setState({ kind: 'choose-calendar' }); return; }
      if (enabled.some((source) => source.synced_at === null)) { setState({ kind: 'needs-sync' }); return; }
      const lastSyncedAt = enabled.map((source) => source.synced_at ?? '')
        .sort().at(-1) ?? '';
      setState({ kind: 'ready', lastSyncedAt });
    } catch {
      setState({ kind: 'error', message: 'Could not load your Plan. Check your connection and retry.' });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function syncEnabled() {
    setSyncing(true);
    try {
      for (const source of sources.filter((item) => item.is_enabled)) {
        await syncCalendarSource(source.id);
      }
      await load();
    } catch {
      setState({ kind: 'error', message: 'Calendar sync failed. Your existing plan is unchanged; retry when ready.' });
    } finally { setSyncing(false); }
  }

  if (loading || state === null) return <View><ActivityIndicator accessibilityLabel="Loading Plan" /></View>;
  switch (state.kind) {
    case 'not-connected': return <View style={{ padding: 20, gap: 12 }}>
      <Text accessibilityRole="header">Plan around your day</Text>
      <Text>Connect a calendar to see your schedule. beforeburn reads selected calendars to help plan recovery time.</Text>
      <ConnectGoogleCalendar onConnected={() => void load()} />
    </View>;
    case 'choose-calendar': return <View style={{ padding: 20, gap: 12 }}>
      <Text>Select at least one calendar before importing events.</Text>
      <Link href="/calendar-selection">Choose calendars</Link>
    </View>;
    case 'needs-sync': return <View style={{ padding: 20, gap: 12 }}>
      <Text>Your selected calendars are ready to sync.</Text>
      <Pressable accessibilityRole="button" disabled={syncing} onPress={() => void syncEnabled()}>
        <Text>{syncing ? 'Syncing…' : 'Sync now'}</Text>
      </Pressable>
    </View>;
    case 'ready': return <View style={{ padding: 20, gap: 12 }}>
      <Text>Last synced: {new Date(state.lastSyncedAt).toLocaleString()}</Text>
      <Link href="/(tabs)/day">Day</Link><Link href="/(tabs)/week">Week</Link>
      <Link href="/(tabs)/month">Month</Link>
      <Pressable accessibilityRole="button" disabled={syncing} onPress={() => void syncEnabled()}>
        <Text>{syncing ? 'Syncing…' : 'Sync now'}</Text>
      </Pressable>
    </View>;
    case 'error': return <View style={{ padding: 20, gap: 12 }}>
      <Text accessibilityRole="alert">{state.message}</Text>
      <Pressable accessibilityRole="button" onPress={() => void load()}><Text>Retry</Text></Pressable>
    </View>;
    default: { const exhaustive: never = state; return exhaustive; }
  }
}
```

The explicit state type and exhaustive `switch` make TypeScript surface a missing screen state if the product flow changes.

## 3. Add pull-to-refresh

Wrap the event list in `RefreshControl` or the matching Expo-supported refresh pattern. Pulling refreshes the API cache only; if the provider sync is needed, show that action and its result clearly. Do not trigger a long Google sync on every screen render.

## 4. Integrate disconnect

The Settings connection screen calls the authenticated disconnect endpoint. The backend deletes/invalidates credentials and applies the chosen cache-retention behavior. The Plan screen then returns to the not-connected state. Handle a provider revocation failure separately from local credential deletion: local access must stop even if Google is temporarily unavailable.

## 5. End-to-end verification

Walk this checklist with a test account:

1. New account sees an explanation, not a broken empty calendar.
2. Connect, cancel, and retry each produce clear states.
3. Select one source, sync it twice, and see no duplicates.
4. Day, Week, and Month show consistent dates.
5. Disconnect returns the app to the correct empty state.
6. A second account cannot see the first account's calendar data.

Record any remaining integration defects as GitHub issues rather than silently skipping them.

## Common mistakes

- A screen fetches on every render: trigger loads from route focus or explicit refresh.
- Disconnect leaves old events visible: invalidate/refetch Plan data after the mutation.
- Provider and recovery events overwrite each other: retain distinct source identity and ownership.

## Exercise

Write user-facing copy describing what happens to cached event data when calendar access is disconnected. It must match the behavior actually implemented.

## Commit

```bash
git add services/api/app services/api/tests apps/mobile docs/labs/23-plan-integration.md
git commit -m "feat: complete calendar planning experience"
git push
```
