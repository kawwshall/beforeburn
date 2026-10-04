# Lab 26 — Return and display workload explanations

## Goal

Connect real calendar facts to Lab 25's rule and show a useful explanation in the Plan UI.

## Before you start

Complete Labs 20–21 and 25. Verify calendar event queries enforce ownership and pure workload rules pass their tests.

## 1. Build a query service

Create `services/api/app/services/workload_query.py`:

```python
from datetime import date, datetime, time, timedelta, timezone
from uuid import UUID
from zoneinfo import ZoneInfo
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.calendar_connection import CalendarConnection
from app.models.calendar_event import CalendarEvent
from app.models.calendar_source import CalendarSource
from app.services.workload import EventBlock


def get_owned_event_blocks(session: Session, user_id: UUID, day: date,
                           zone_name: str) -> list[EventBlock]:
    zone = ZoneInfo(zone_name)
    local_start = datetime.combine(day, time.min, tzinfo=zone)
    local_end = datetime.combine(day + timedelta(days=1), time.min, tzinfo=zone)
    utc_start = local_start.astimezone(timezone.utc)
    utc_end = local_end.astimezone(timezone.utc)
    statement = (select(CalendarEvent)
        .join(CalendarSource, CalendarSource.id == CalendarEvent.source_id)
        .join(CalendarConnection, CalendarConnection.id == CalendarSource.connection_id)
        .where(CalendarConnection.user_id == user_id,
               CalendarConnection.status == "connected",
               CalendarSource.is_enabled.is_(True),
               CalendarEvent.is_all_day.is_(False),
               CalendarEvent.starts_at.is_not(None),
               CalendarEvent.ends_at.is_not(None),
               CalendarEvent.starts_at < utc_end,
               CalendarEvent.ends_at > utc_start))
    blocks = []
    for event in session.scalars(statement).all():
        clipped_start = max(event.starts_at, utc_start).astimezone(zone)
        clipped_end = min(event.ends_at, utc_end).astimezone(zone)
        blocks.append(EventBlock(
            start_minute=int((clipped_start - local_start).total_seconds() // 60),
            end_minute=int((clipped_end - local_start).total_seconds() // 60),
        ))
    return blocks
```

All-day events have no timed minute offsets and are excluded from this rule. Events crossing midnight are clipped to this local day. Database query code stays separate from the pure rule function.

## 2. Add an API route

Add this route to `services/api/app/main.py` (add the listed imports alongside the existing imports):

```python
from datetime import date
from app.models.user_preference import UserPreference
from app.schemas.workload import WorkloadSummary
from app.services.workload import summarize_workload
from app.services.workload_query import get_owned_event_blocks


@app.get("/me/workload/day", response_model=WorkloadSummary)
def read_day_workload(day: date,
                      current_user: Annotated[dict[str, Any], Depends(current_user_dependency)],
                      session: Session = Depends(get_session)):
    user_id = UUID(current_user["id"])
    preferences = session.get(UserPreference, user_id)
    zone_name = preferences.time_zone if preferences else "UTC"
    blocks = get_owned_event_blocks(session, user_id, day, zone_name)
    return summarize_workload(blocks)
```

The project already imports `Annotated`, `Any`, `Depends`, `Session`, and `UUID` in `main.py`; do not duplicate those imports. Do not accept a user ID query parameter.

## 3. Add mobile types and fetch

Create `apps/mobile/types/workload.ts`:

```ts
export type WorkloadSummary = {
  level: 'open' | 'steady' | 'busy';
  reason: string;
  suggestion: string;
  scheduled_minutes: number;
  longest_streak_minutes: number;
};
```

Create `apps/mobile/lib/workload.ts`:

```ts
export async function getWorkloadForDay(day: string): Promise<WorkloadSummary> {
  const response = await apiFetch(`/me/workload/day?date=${encodeURIComponent(day)}`);
  if (!response.ok) throw new Error('Could not load the day summary.');
  return response.json();
}
```

## 4. Build a card component

Create `apps/mobile/components/WorkloadCard.tsx`:

```tsx
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import type { WorkloadSummary } from '../types/workload';

type Props = { summary: WorkloadSummary | null; loading: boolean;
  error: string | null; onRetry: () => void };

export function WorkloadCard({ summary, loading, error, onRetry }: Props) {
  if (loading) return <View accessibilityLabel="Loading day summary"><ActivityIndicator /></View>;
  if (error) return <View><Text accessibilityRole="alert">{error}</Text>
    <Pressable accessibilityRole="button" onPress={onRetry}><Text>Retry</Text></Pressable></View>;
  if (!summary) return null;
  const label = summary.level === 'busy' ? 'Busy day'
    : summary.level === 'steady' ? 'A few plans' : 'Open space';
  return <View accessible accessibilityLabel={`${label}. ${summary.reason}`}>
    <Text accessibilityRole="header">{label}</Text>
    <Text>{summary.reason}</Text>
    <Text>{summary.suggestion}</Text>
    <Text>{summary.scheduled_minutes} minutes scheduled</Text>
  </View>;
}
```

The explanation and calculation basis make the recommendation inspectable rather than mysterious.

## 5. Verify

Compare API summary with known events for open, steady, and busy test days. Check another user's events do not affect the response. Confirm date boundaries use the user's timezone and empty schedule is handled.

## Exercise

Rewrite one rule explanation for a student planner while keeping its factual basis accurate.

## Common mistakes

- Empty day returns 404: return a valid `open` summary for an empty schedule.
- Explanation disagrees with calendar: ensure both use the same local-day boundaries.
- Client supplies a user ID: remove it from the route and use the auth dependency.

## Commit

```bash
git add services/api/app services/api/tests apps/mobile docs/labs/26-workload-explanations.md
git commit -m "feat: show workload explanations"
git push
```
