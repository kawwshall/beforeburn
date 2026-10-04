# Lab 19 — Select which calendars beforeburn can read

## What you will build

After OAuth succeeds, Google may return several calendars: personal, work, shared, and holidays. This lab stores the user's selection and builds the mobile screen that controls it. The same pattern applies whenever an app lets a user choose which connected data sources to include.

## Before you start

- Labs 17–18 are complete.
- You can identify the current user in a protected FastAPI route.
- Your provider client can list calendar metadata.

## 1. Create the database model

Create `services/api/app/models/calendar_source.py`:

```python
from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class CalendarSource(Base):
    __tablename__ = "calendar_sources"
    __table_args__ = (UniqueConstraint("connection_id", "provider_calendar_id"),)

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    connection_id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey("calendar_connections.id", ondelete="CASCADE"), nullable=False
    )
    provider_calendar_id: Mapped[str] = mapped_column(String(512), nullable=False)
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    color: Mapped[str | None] = mapped_column(String(20))
    is_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
```

The unique pair prevents duplicate copies of one provider calendar. `is_enabled` defaults false so data is not imported before the user chooses. `ON DELETE CASCADE` means deleting the connection removes the dependent source rows.

## 2. Create and apply the migration

Import `CalendarSource` in `app/models/__init__.py`, then run from `services/api`:

```bash
alembic revision --autogenerate -m "add calendar sources"
```

Inspect the migration. Confirm the FK points to `calendar_connections.id`, the unique key has both columns, and downgrade removes only this table. Then:

```bash
alembic upgrade head
alembic current
```

Autogenerate is a draft. The review step catches missing constraints before schema changes reach the database.

## 3. Restrict what the API accepts and returns

Create `services/api/app/schemas/calendar_source.py`:

```python
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class CalendarSourceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    display_name: str
    color: str | None
    is_enabled: bool
    synced_at: datetime | None


class CalendarSourceUpdate(BaseModel):
    is_enabled: bool
```

The update model only permits the one editable field. Do not accept `user_id`, `connection_id`, or provider ID from the phone.

## 4. Implement ownership-scoped access

Create `services/api/app/services/calendar_sources.py`:

```python
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.calendar_connection import CalendarConnection
from app.models.calendar_source import CalendarSource


def list_for_user(session: Session, user_id: UUID) -> list[CalendarSource]:
    statement = (select(CalendarSource)
        .join(CalendarConnection, CalendarConnection.id == CalendarSource.connection_id)
        .where(CalendarConnection.user_id == user_id,
               CalendarConnection.status == "connected")
        .order_by(CalendarSource.display_name))
    return list(session.scalars(statement).all())


def set_enabled(session: Session, user_id: UUID, source_id: UUID,
                enabled: bool) -> CalendarSource | None:
    statement = (select(CalendarSource)
        .join(CalendarConnection, CalendarConnection.id == CalendarSource.connection_id)
        .where(CalendarSource.id == source_id,
               CalendarConnection.user_id == user_id))
    source = session.scalar(statement)
    if source is None:
        return None
    source.is_enabled = enabled
    session.commit()
    session.refresh(source)
    return source
```

Create `services/api/app/routes/calendar_sources.py`:

```python
from typing import Any
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_session
from app.dependencies import current_user_dependency
from app.schemas.calendar_source import CalendarSourceResponse, CalendarSourceUpdate
from app.services.calendar_sources import list_for_user, set_enabled

router = APIRouter(prefix="/me/calendar-sources", tags=["calendar sources"])


@router.get("", response_model=list[CalendarSourceResponse])
def get_sources(current_user: dict[str, Any] = Depends(current_user_dependency),
                session: Session = Depends(get_session)):
    return list_for_user(session, UUID(current_user["id"]))


@router.patch("/{source_id}", response_model=CalendarSourceResponse)
def patch_source(source_id: UUID, changes: CalendarSourceUpdate,
                 current_user: dict[str, Any] = Depends(current_user_dependency),
                 session: Session = Depends(get_session)):
    row = set_enabled(session, UUID(current_user["id"]), source_id,
                      changes.is_enabled)
    if row is None:
        raise HTTPException(status_code=404, detail="Calendar source not found")
    return row
```

At the bottom of `app/main.py`, register the router:

```python
from app.routes.calendar_sources import router as calendar_sources_router
app.include_router(calendar_sources_router)
```

The list route reads stored rows; add a refresh route so a successful OAuth connection actually populates them. Append to `services/api/app/routes/calendar_sources.py`:

```python
import httpx
from urllib.parse import urlencode
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from fastapi import HTTPException
from app.models.calendar_connection import CalendarConnection
from app.services.token_crypto import decrypt_token
from app.config import GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET


@router.post("/refresh", response_model=list[CalendarSourceResponse])
def refresh_sources(current_user: dict[str, Any] = Depends(current_user_dependency),
                    session: Session = Depends(get_session)):
    user_id = UUID(current_user["id"])
    connection = session.scalar(select(CalendarConnection).where(
        CalendarConnection.user_id == user_id,
        CalendarConnection.provider == "google",
        CalendarConnection.status == "connected"))
    if connection is None:
        raise HTTPException(status_code=404, detail="Calendar connection not found")
    token_response = httpx.post("https://oauth2.googleapis.com/token", data={
        "client_id": GOOGLE_CLIENT_ID, "client_secret": GOOGLE_CLIENT_SECRET,
        "refresh_token": decrypt_token(connection.encrypted_refresh_token),
        "grant_type": "refresh_token",
    }, timeout=15.0)
    token_response.raise_for_status()
    headers = {"Authorization": f"Bearer {token_response.json()['access_token']}"}
    url = "https://www.googleapis.com/calendar/v3/users/me/calendarList"
    calendars = []
    while url:
        response = httpx.get(url, headers=headers, timeout=15.0)
        response.raise_for_status()
        page = response.json()
        calendars.extend(page.get("items", []))
        page_token = page.get("nextPageToken")
        url = ("https://www.googleapis.com/calendar/v3/users/me/calendarList?" +
               urlencode({"pageToken": page_token})) if page_token else ""
    for item in calendars:
        if item.get("deleted"):
            continue
        statement = insert(CalendarSource).values(
            connection_id=connection.id, provider_calendar_id=item["id"],
            display_name=item.get("summary") or "Calendar",
            color=item.get("backgroundColor"), is_enabled=False,
        ).on_conflict_do_update(
            index_elements=[CalendarSource.connection_id, CalendarSource.provider_calendar_id],
            set_={"display_name": item.get("summary") or "Calendar",
                  "color": item.get("backgroundColor")},
        )
        session.execute(statement)
    session.commit()
    return list_for_user(session, user_id)
```

This upsert preserves the user's existing `is_enabled` choice while updating Google-owned display metadata. Never return access or refresh tokens.

## 5. Build the mobile selection screen

Create `apps/mobile/types/calendarSource.ts`:

```ts
export type CalendarSource = {
  id: string;
  display_name: string;
  color: string | null;
  is_enabled: boolean;
  synced_at: string | null;
};
```

Create `apps/mobile/lib/calendarSources.ts`:

```ts
import { apiFetch } from './api';
import type { CalendarSource } from '../types/calendarSource';

export async function getCalendarSources(): Promise<CalendarSource[]> {
  const response = await apiFetch('/me/calendar-sources');
  if (!response.ok) throw new Error('Could not load calendars.');
  return response.json() as Promise<CalendarSource[]>;
}

export async function refreshCalendarSources(): Promise<CalendarSource[]> {
  const response = await apiFetch('/me/calendar-sources/refresh', { method: 'POST' });
  if (!response.ok) throw new Error('Could not refresh Google calendars.');
  return response.json() as Promise<CalendarSource[]>;
}

export async function setCalendarSourceEnabled(id: string, enabled: boolean): Promise<CalendarSource> {
  const response = await apiFetch(`/me/calendar-sources/${encodeURIComponent(id)}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_enabled: enabled }),
  });
  if (!response.ok) throw new Error('Could not update this calendar.');
  return response.json() as Promise<CalendarSource>;
}
```

Create `apps/mobile/app/calendar-selection.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Switch, Text, View } from 'react-native';
import { refreshCalendarSources, setCalendarSourceEnabled } from '../lib/calendarSources';
import type { CalendarSource } from '../types/calendarSource';

export default function CalendarSelectionScreen() {
  const [items, setItems] = useState<CalendarSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true); setError(null);
    try {
      setItems(await refreshCalendarSources());
    }
    catch { setError('Calendars could not be loaded.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  async function change(item: CalendarSource, value: boolean) {
    setBusyId(item.id); setError(null);
    setItems((old) => old.map((row) => row.id === item.id ? { ...row, is_enabled: value } : row));
    try { await setCalendarSourceEnabled(item.id, value); }
    catch {
      setItems((old) => old.map((row) => row.id === item.id ? { ...row, is_enabled: item.is_enabled } : row));
      setError(`Could not update ${item.display_name}. Try again.`);
    } finally { setBusyId(null); }
  }

  if (loading) return <View><ActivityIndicator accessibilityLabel="Loading calendars" /></View>;
  if (error && items.length === 0) return <View><Text accessibilityRole="alert">{error}</Text>
    <Pressable onPress={() => void load()}><Text>Retry</Text></Pressable></View>;
  const selected = items.filter((item) => item.is_enabled).length;
  return <View style={{ padding: 20, gap: 12 }}>
    <Text>Choose calendars to include</Text>
    {error && <Text accessibilityRole="alert">{error}</Text>}
    {items.length === 0 ? <Text>No calendars found. Connect Google Calendar first.</Text> : items.map((item) =>
      <View key={item.id} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text>{item.display_name}</Text>
        <Switch value={item.is_enabled} disabled={busyId === item.id}
          accessibilityLabel={`Include ${item.display_name} in planning`}
          onValueChange={(value) => void change(item, value)} />
      </View>)}
    <Text>{selected} calendar{selected === 1 ? '' : 's'} included</Text>
  </View>;
}
```

## Verify

Test an empty list, one source, multiple sources, a failed PATCH, and an attempted update to another user's source. Restart the app and verify the server's saved value is shown.

## Common mistakes

- Duplicate-key error: upsert by `(connection_id, provider_calendar_id)` when refreshing provider metadata.
- Every account shares one selection: keep `is_enabled` on the per-user source record.
- Client changes ownership: ensure the update schema and service never accept IDs that determine owner.

## Independent exercise

Add Select all / Clear all. Report the resulting count and decide how the UI behaves if one of several network updates fails.

## Commit

```bash
git add services/api/app services/api/migrations services/api/tests apps/mobile docs/labs/19-calendar-selection.md
git commit -m "feat: add calendar selection"
git push
```
