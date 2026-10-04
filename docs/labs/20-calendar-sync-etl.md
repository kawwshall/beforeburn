# Lab 20 — Import calendar events without duplicates

## What you will build

You will sync selected calendars into a local cache. The API reads provider pages, transforms them into a consistent event shape, and upserts by provider identity. Mobile sees sync status, never provider credentials.

## Before you start

Complete Labs 17–19. Confirm migrations are current and a test calendar source is selected. Use a dedicated Google development account with synthetic events.

## Concepts

- **ETL:** Extract data from a provider, Transform it to our shape, Load it into our database.
- **Cursor:** a provider token saying where the next incremental sync should continue.
- **Idempotent upsert:** repeating a sync updates the same record instead of creating duplicates.
- **All-day event:** a date without a clock time; do not convert it as if it were midnight UTC.

## 1. Create the event model

Create `services/api/app/models/calendar_event.py`:

```python
from datetime import date, datetime
from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class CalendarEvent(Base):
    __tablename__ = "calendar_events"
    __table_args__ = (
        UniqueConstraint("source_id", "provider_event_id", name="uq_event_source_provider_id"),
        CheckConstraint(
            "(is_all_day AND starts_at IS NULL AND ends_at IS NULL AND start_date IS NOT NULL AND end_date > start_date) OR "
            "(NOT is_all_day AND starts_at IS NOT NULL AND ends_at > starts_at AND start_date IS NULL AND end_date IS NULL)",
            name="ck_calendar_event_time_shape",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    source_id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey("calendar_sources.id", ondelete="CASCADE"), nullable=False
    )
    provider_event_id: Mapped[str] = mapped_column(String(512), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    time_zone: Mapped[str | None] = mapped_column(String(80))
    is_all_day: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    provider_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    synced_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
```

Timed events use instants with a timezone. All-day events use date columns. This prevents an all-day date from shifting when converted between zones.

In `services/api/app/models/calendar_source.py`, add this mapped field to `CalendarSource`:

```python
sync_token: Mapped[str | None] = mapped_column(String(2048))
```

This stores Google's opaque incremental cursor. Alembic will add this nullable column alongside the new event table. Register `CalendarEvent`, generate and review a migration, then apply it:

```bash
alembic revision --autogenerate -m "add calendar event cache"
alembic upgrade head
alembic current
```

## 2. Normalize provider responses

Create `services/api/app/services/calendar_sync.py`. Keep parsing in a pure function so it can be tested without Google:

```python
from datetime import date, datetime
from typing import Any


def normalize_event(raw: dict[str, Any]) -> dict[str, Any]:
    start = raw["start"]
    end = raw["end"]
    all_day = "date" in start
    return {
        "provider_event_id": raw["id"],
        "title": raw.get("summary") or "Busy",
        "is_all_day": all_day,
        "start_date": date.fromisoformat(start["date"]) if all_day else None,
        "end_date": date.fromisoformat(end["date"]) if all_day else None,
        "starts_at": datetime.fromisoformat(start["dateTime"].replace("Z", "+00:00")) if not all_day else None,
        "ends_at": datetime.fromisoformat(end["dateTime"].replace("Z", "+00:00")) if not all_day else None,
        "time_zone": start.get("timeZone"),
    }
```

Provider payloads can contain missing titles and different date shapes. Keep that handling here and build representative fixtures from sanitized responses.

## 3. Fetch pages and load safely

Append the following provider and sync functions to `services/api/app/services/calendar_sync.py`. They use Google's incremental sync token, but fetch all pages before committing so a partial provider failure does not advance the cursor:

```python
from datetime import datetime, timedelta, timezone
from uuid import UUID
import httpx
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session
from app.config import GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
from app.models.calendar_connection import CalendarConnection
from app.models.calendar_event import CalendarEvent
from app.models.calendar_source import CalendarSource
from app.services.token_crypto import decrypt_token


def google_access_token(refresh_token: str) -> str:
    response = httpx.post("https://oauth2.googleapis.com/token", data={
        "client_id": GOOGLE_CLIENT_ID, "client_secret": GOOGLE_CLIENT_SECRET,
        "refresh_token": refresh_token, "grant_type": "refresh_token",
    }, timeout=15.0)
    response.raise_for_status()
    return response.json()["access_token"]


def fetch_pages(calendar_id: str, access_token: str, sync_token: str | None):
    url = f"https://www.googleapis.com/calendar/v3/calendars/{calendar_id}/events"
    headers = {"Authorization": f"Bearer {access_token}"}
    params = {"showDeleted": "true", "maxResults": "2500"}
    if sync_token:
        params["syncToken"] = sync_token
    else:
        params.update({"singleEvents": "true",
            "timeMin": (datetime.now(timezone.utc) - timedelta(days=30)).isoformat(),
            "timeMax": (datetime.now(timezone.utc) + timedelta(days=365)).isoformat()})
    events, page_token, final_sync_token = [], None, None
    while True:
        if page_token:
            params["pageToken"] = page_token
        response = httpx.get(url, headers=headers, params=params, timeout=20.0)
        response.raise_for_status()
        payload = response.json()
        events.extend(payload.get("items", []))
        page_token = payload.get("nextPageToken")
        if not page_token:
            final_sync_token = payload.get("nextSyncToken")
            break
    if not final_sync_token:
        raise RuntimeError("Google did not return a sync token")
    return events, final_sync_token


def upsert_event(session: Session, source_id: UUID, values: dict) -> None:
    statement = insert(CalendarEvent).values(source_id=source_id, **values)
    statement = statement.on_conflict_do_update(
        index_elements=[CalendarEvent.source_id, CalendarEvent.provider_event_id],
        set_={key: getattr(statement.excluded, key) for key in values},
    )
    session.execute(statement)


def sync_source(session: Session, user_id: UUID, source_id: UUID) -> dict[str, int]:
    owned = (select(CalendarSource, CalendarConnection)
        .join(CalendarConnection, CalendarConnection.id == CalendarSource.connection_id)
        .where(CalendarSource.id == source_id, CalendarConnection.user_id == user_id,
            CalendarSource.is_enabled.is_(True), CalendarConnection.status == "connected"))
    pair = session.execute(owned).first()
    if pair is None:
        raise LookupError("Calendar source not found")
    source, connection = pair
    access_token = google_access_token(decrypt_token(connection.encrypted_refresh_token))
    old_cursor = source.sync_token
    full_sync = old_cursor is None
    try:
        raw_events, next_cursor = fetch_pages(source.provider_calendar_id, access_token, old_cursor)
    except httpx.HTTPStatusError as error:
        if error.response.status_code != 410 or old_cursor is None:
            raise
        full_sync = True
        raw_events, next_cursor = fetch_pages(source.provider_calendar_id, access_token, None)
    if full_sync:
        session.execute(delete(CalendarEvent).where(CalendarEvent.source_id == source.id))
    imported = 0
    for raw in raw_events:
        if raw.get("status") == "cancelled":
            old = session.scalar(select(CalendarEvent).where(
                CalendarEvent.source_id == source.id,
                CalendarEvent.provider_event_id == raw["id"]))
            if old is not None:
                session.delete(old)
            continue
        upsert_event(session, source.id, normalize_event(raw))
        imported += 1
    source.sync_token = next_cursor
    source.synced_at = datetime.now(timezone.utc)
    session.commit()
    return {"imported": imported}
```

Create the composite unique constraint in PostgreSQL. Application code alone cannot prevent two concurrent sync requests from inserting duplicates.

`values` must contain only mapped event fields, never `id` or `source_id`; the source ID is supplied separately. The unique DB constraint and conflict target must match exactly.

## 4. Add the endpoint and mobile status

Create `services/api/app/routes/calendar_sync.py`:

```python
from typing import Any
from uuid import UUID
import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_session
from app.dependencies import current_user_dependency
from app.services.calendar_sync import sync_source

router = APIRouter(prefix="/me/calendar-sources", tags=["calendar sync"])


@router.post("/{source_id}/sync")
def sync_calendar_source(source_id: UUID,
    current_user: dict[str, Any] = Depends(current_user_dependency),
    session: Session = Depends(get_session)):
    try:
        return sync_source(session, UUID(current_user["id"]), source_id)
    except LookupError:
        raise HTTPException(status_code=404, detail="Calendar source not found")
    except httpx.HTTPError:
        session.rollback()
        raise HTTPException(status_code=502, detail="Calendar sync failed. Retry shortly.")
```

Register with `app.include_router(calendar_sync.router)` in `main.py`. In `apps/mobile/lib/calendarSources.ts`, add this exact function:

```ts
export async function syncCalendarSource(id: string): Promise<{ imported: number }> {
  const response = await apiFetch(`/me/calendar-sources/${encodeURIComponent(id)}/sync`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Calendar sync failed. Retry shortly.');
  return response.json() as Promise<{ imported: number }>;
}
```

Call it only from a Sync now button. Disable the button while pending, display the imported count on success, and show Retry on failure. Do not run provider sync on every screen render.

## 5. Tests and verification

Use fixtures for timed, all-day, missing-title, and two-page responses. Test date normalization, repeated upsert, failed-page cursor behavior, disabled source, and cross-user access. Then sync the same real test calendar twice; row count must remain constant.

## Common mistakes

- Duplicate rows: missing database uniqueness or wrong upsert conflict columns.
- Day shifts: converting an all-day date through UTC.
- Lost events after provider error: advancing cursor before all pages complete.
- Sensitive logs: dumping provider responses can reveal event titles and attendee information.

If a real provider payload differs from a fixture, update the normalization adapter and add a sanitized fixture. Do not spread provider-specific parsing across routes and screens.

## Independent exercise

Sketch ETL for an external book API and name the provider ID that makes each import repeat-safe.

## Commit

```bash
git add services/api/app services/api/migrations services/api/tests apps/mobile docs/labs/20-calendar-sync-etl.md
git commit -m "feat: sync calendar events idempotently"
git push
```
