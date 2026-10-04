# Lab 21 — Build the Day planning view

## What you will build

The user sees the events from selected calendars on a chosen local day. This lesson builds a protected API query, a mobile fetch function, a reusable event row, date navigation, and clear loading/empty/error states.

## Before you start

- Labs 17–20 are complete and test calendar events exist in PostgreSQL.
- Mobile has the authenticated `apiFetch` helper from Lab 15.
- The profile preference stores an IANA time zone such as `Asia/Kolkata`.

## 1. Define a safe event response

Create `services/api/app/schemas/events.py`:

```python
from datetime import date, datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class CalendarEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    title: str
    starts_at: datetime | None
    ends_at: datetime | None
    start_date: date | None
    end_date: date | None
    is_all_day: bool
    time_zone: str | None
```

Do not include refresh tokens, provider event IDs, or internal database fields in this response.

## 2. Query a half-open time range

Create `services/api/app/services/events.py`:

```python
from datetime import date, datetime, time, timedelta, timezone
from uuid import UUID
from zoneinfo import ZoneInfo
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session
from app.models.calendar_connection import CalendarConnection
from app.models.calendar_event import CalendarEvent
from app.models.calendar_source import CalendarSource


def list_events_for_day(session: Session, user_id: UUID, day: date,
                        zone_name: str) -> list[CalendarEvent]:
    zone = ZoneInfo(zone_name)
    start_local = datetime.combine(day, time.min, tzinfo=zone)
    end_local = datetime.combine(day + timedelta(days=1), time.min, tzinfo=zone)
    start_utc = start_local.astimezone(timezone.utc)
    end_utc = end_local.astimezone(timezone.utc)
    timed = and_(CalendarEvent.is_all_day.is_(False),
        CalendarEvent.starts_at.is_not(None), CalendarEvent.ends_at.is_not(None),
        CalendarEvent.starts_at < end_utc, CalendarEvent.ends_at > start_utc)
    all_day = and_(CalendarEvent.is_all_day.is_(True),
        CalendarEvent.start_date < day + timedelta(days=1),
        CalendarEvent.end_date > day)
    statement = (select(CalendarEvent)
        .join(CalendarSource, CalendarSource.id == CalendarEvent.source_id)
        .join(CalendarConnection, CalendarConnection.id == CalendarSource.connection_id)
        .where(CalendarConnection.user_id == user_id,
            CalendarConnection.status == "connected",
            CalendarSource.is_enabled.is_(True), or_(timed, all_day))
        .order_by(CalendarEvent.is_all_day.desc(), CalendarEvent.starts_at,
                  CalendarEvent.start_date, CalendarEvent.title))
    return list(session.scalars(statement).all())


def count_events_for_range(session: Session, user_id: UUID, first_day: date,
                           last_day: date, zone_name: str) -> dict[str, int]:
    zone = ZoneInfo(zone_name)
    start_local = datetime.combine(first_day, time.min, tzinfo=zone)
    end_local = datetime.combine(last_day + timedelta(days=1), time.min, tzinfo=zone)
    start_utc = start_local.astimezone(timezone.utc)
    end_utc = end_local.astimezone(timezone.utc)
    timed = and_(CalendarEvent.is_all_day.is_(False),
        CalendarEvent.starts_at.is_not(None), CalendarEvent.ends_at.is_not(None),
        CalendarEvent.starts_at < end_utc, CalendarEvent.ends_at > start_utc)
    all_day = and_(CalendarEvent.is_all_day.is_(True),
        CalendarEvent.start_date < last_day + timedelta(days=1),
        CalendarEvent.end_date > first_day)
    statement = (select(CalendarEvent)
        .join(CalendarSource, CalendarSource.id == CalendarEvent.source_id)
        .join(CalendarConnection, CalendarConnection.id == CalendarSource.connection_id)
        .where(CalendarConnection.user_id == user_id,
            CalendarConnection.status == "connected",
            CalendarSource.is_enabled.is_(True), or_(timed, all_day)))
    counts = {}
    day = first_day
    while day <= last_day:
        counts[day.isoformat()] = 0
        day += timedelta(days=1)
    for event in session.scalars(statement).all():
        if event.is_all_day:
            first = max(event.start_date, first_day)
            final = min(event.end_date - timedelta(days=1), last_day)
        else:
            local_start = max(event.starts_at, start_utc).astimezone(zone)
            local_end = min(event.ends_at, end_utc).astimezone(zone)
            first = max(local_start.date(), first_day)
            final = min((local_end - timedelta(microseconds=1)).date(), last_day)
        day = first
        while day <= final:
            counts[day.isoformat()] += 1
            day += timedelta(days=1)
    return counts
```

Use a half-open range `[start, end)` so adjacent days do not both include an event at exactly midnight. Resolve the requested day in the user's IANA time zone first, then convert the boundary instants to UTC for the timed-event query. A daylight-saving transition may make a local day 23 or 25 hours; never assume every day equals 24 hours.

Boundary calculation:

```python
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo


def utc_bounds(day: date, zone_name: str) -> tuple[datetime, datetime]:
    zone = ZoneInfo(zone_name)
    start_local = datetime.combine(day, time.min, tzinfo=zone)
    end_local = datetime.combine(day + timedelta(days=1), time.min, tzinfo=zone)
    return start_local.astimezone(timezone.utc), end_local.astimezone(timezone.utc)
```

The next local midnight is calculated before converting to UTC, so daylight-saving days get the correct boundary length.

## 3. Add the endpoint

Create `services/api/app/routes/events.py`:

```python
from datetime import date
from typing import Any
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_session
from app.dependencies import current_user_dependency
from app.models.user_preference import UserPreference
from app.schemas.events import CalendarEventResponse
from app.services.events import count_events_for_range, list_events_for_day

router = APIRouter(prefix="/me/events", tags=["events"])


@router.get("/day", response_model=list[CalendarEventResponse])
def day_events(day: date = Query(alias="date"),
               current_user: dict[str, Any] = Depends(current_user_dependency),
               session: Session = Depends(get_session)):
    user_id = UUID(current_user["id"])
    preferences = session.get(UserPreference, user_id)
    zone_name = preferences.time_zone if preferences else "UTC"
    return list_events_for_day(session, user_id, day, zone_name)


@router.get("/range", response_model=dict[str, int])
def event_counts(start: date, end: date,
    current_user: dict[str, Any] = Depends(current_user_dependency),
    session: Session = Depends(get_session)):
    if end < start or (end - start).days > 44:
        raise HTTPException(status_code=422, detail="Choose a valid range of at most 45 days")
    user_id = UUID(current_user["id"])
    preferences = session.get(UserPreference, user_id)
    zone_name = preferences.time_zone if preferences else "UTC"
    return count_events_for_range(session, user_id, start, end, zone_name)
```

Register it in `services/api/app/main.py`:

```python
from app.routes.events import router as events_router
app.include_router(events_router)
```

FastAPI parses ISO date query parameters and returns 422 for malformed dates. An empty day result serializes to `[]`; a range response contains each requested date with an integer count, including zeros. The range endpoint accepts at most 45 inclusive dates.

## 4. Add mobile types and loader

Create `apps/mobile/types/event.ts`:

```ts
export type CalendarEvent = {
  id: string;
  title: string;
  starts_at: string | null;
  ends_at: string | null;
  start_date: string | null;
  end_date: string | null;
  is_all_day: boolean;
  time_zone: string | null;
};
```

Create `apps/mobile/lib/events.ts`:

```ts
import { apiFetch } from './api';
import type { CalendarEvent } from '../types/event';

export async function getDayEvents(day: string): Promise<CalendarEvent[]> {
  const response = await apiFetch(`/me/events/day?date=${encodeURIComponent(day)}`);
  if (!response.ok) throw new Error('Could not load this day.');
  return response.json() as Promise<CalendarEvent[]>;
}
```

## 5. Build the Day screen

Create `apps/mobile/components/TimelineEvent.tsx`:

```tsx
import { Text, View } from 'react-native';
import type { CalendarEvent } from '../types/event';

export function TimelineEvent({ event }: { event: CalendarEvent }) {
  const label = event.is_all_day ? 'All day' :
    `${new Date(event.starts_at!).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}–${new Date(event.ends_at!).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  return <View accessible accessibilityLabel={`${event.title}, ${label}`} style={{ padding: 12 }}>
    <Text>{event.title}</Text><Text>{label}</Text>
  </View>;
}
```

Create `apps/mobile/app/(tabs)/day.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { dateKey } from '../../lib/calendarDates';
import { getDayEvents } from '../../lib/events';
import type { CalendarEvent } from '../../types/event';
import { TimelineEvent } from '../../components/TimelineEvent';

export default function DayScreen() {
  const [day, setDay] = useState(() => new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  async function load() {
    setLoading(true); setError(null);
    try { setEvents(await getDayEvents(dateKey(day))); }
    catch { setError('Could not load events for this date.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [dateKey(day)]);
  function move(days: number) {
    setDay((current) => new Date(current.getFullYear(), current.getMonth(), current.getDate() + days));
  }
  return <View style={{ padding: 16, gap: 12 }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Previous day" onPress={() => move(-1)}><Text>‹</Text></Pressable>
      <Text accessibilityRole="header">{day.toLocaleDateString(undefined, { dateStyle: 'full' })}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Next day" onPress={() => move(1)}><Text>›</Text></Pressable>
    </View>
    {loading ? <ActivityIndicator accessibilityLabel="Loading events" /> : error ? <>
      <Text accessibilityRole="alert">{error}</Text>
      <Pressable accessibilityRole="button" onPress={() => void load()}><Text>Retry</Text></Pressable>
    </> : events.length === 0 ? <Text>Nothing planned for this day.</Text> :
      events.map((event) => <TimelineEvent key={event.id} event={event} />)}
  </View>;
}
```

```text
loading        → labeled spinner
error          → explanation and Retry
empty list     → “Nothing planned for this day” plus a date control
events         → sorted timeline and all-day section
```

## Verify

Test an empty day, several overlapping events, an all-day event, and events near local midnight. Create a daylight-saving boundary test for a supported zone. Check the screen reader can distinguish event title and time.

## Common mistakes

- Events from another account appear: add the owner join/filter in the query service.
- An event at midnight appears on two days: use a half-open range with `< end_utc`.
- Date shifts by a day: treat local date keys as calendar dates; don't parse them as UTC instants.
- Screen is blank while loading: render each request state explicitly.

## Exercise

Add previous-day and next-day controls. Ensure the date never changes through local string parsing that shifts it to the prior day.

## Commit

```bash
git add services/api/app services/api/tests apps/mobile docs/labs/21-day-view.md
git commit -m "feat(mobile): add calendar day view"
git push
```
