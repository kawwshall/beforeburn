# Lab 30 — Add a recovery block to Google Calendar once

## Goal

Let the user add a beforeburn recovery session to a selected Google calendar. The same action may be retried after a timeout without creating duplicate events.

## Concepts

- **Idempotency key:** a unique ID for one user action. Retries reuse it.
- **External side effect:** Google and PostgreSQL cannot share one transaction.
- **Deterministic provider ID:** derive Google's event ID from the request key so a retry can find the event even if the DB write failed.
- **Least privilege:** this feature needs event-write permission, separate from Lab 18's initial read-only grant.

## Before you start

Complete Labs 18, 20, and 29. Use a synthetic Google account. Lab 18's default permission is read-only; before event creation, explicitly show the user a separate explanation and use `<ConnectGoogleCalendar writeAccess />`. The account must also have writer access to the target calendar. Google's [scope guide](https://developers.google.com/workspace/calendar/api/auth) describes these sensitive permissions.

## 1. Add idempotency columns

In `app/models/scheduled_recovery.py`, import `UniqueConstraint` and `String`, then add this item to `__table_args__`:

```python
UniqueConstraint("user_id", "idempotency_key", name="uq_recovery_user_idempotency"),
```

Add these fields to `ScheduledRecovery`:

```python
idempotency_key: Mapped[UUID | None] = mapped_column(PostgreSQLUUID(as_uuid=True))
provider_event_id: Mapped[str | None] = mapped_column(String(128))
calendar_source_id: Mapped[UUID | None] = mapped_column(
    PostgreSQLUUID(as_uuid=True), ForeignKey("calendar_sources.id", ondelete="SET NULL")
)
```

Create and apply the migration from `services/api`:

```bash
alembic revision --autogenerate -m "add recovery calendar idempotency"
alembic upgrade head
alembic current
```

Review it. Existing scheduled sessions must remain valid; all three new columns are nullable. PostgreSQL permits multiple NULL values in this unique constraint.

## 2. Define the narrow request

Create `services/api/app/schemas/calendar_write.py`:

```python
from uuid import UUID
from pydantic import BaseModel


class AddToCalendarRequest(BaseModel):
    idempotency_key: UUID
    calendar_source_id: UUID
```

The phone may select an app-owned source UUID. It may not send the event title, owner ID, provider calendar ID, provider connection ID, or event times. The server gets those values from authenticated database rows.

## 3. Implement the provider operation

Create `services/api/app/services/calendar_write.py`:

```python
from uuid import UUID
from urllib.parse import quote
import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.config import GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
from app.models.calendar_connection import CalendarConnection
from app.models.calendar_source import CalendarSource
from app.models.scheduled_recovery import ScheduledRecovery
from app.services.token_crypto import decrypt_token


def add_recovery_event(session: Session, user_id: UUID, recovery_id: UUID,
                       request_key: UUID, source_id: UUID) -> ScheduledRecovery:
    recovery = session.scalar(select(ScheduledRecovery).where(
        ScheduledRecovery.id == recovery_id,
        ScheduledRecovery.user_id == user_id,
    ))
    if recovery is None:
        raise LookupError("Recovery not found")
    if recovery.status != "accepted":
        raise ValueError("Only an accepted recovery can be added to a calendar")
    if (recovery.starts_at.utcoffset() is None or
            recovery.ends_at.utcoffset() is None or
            recovery.ends_at <= recovery.starts_at):
        raise ValueError("Recovery must have valid timezone-aware start and end times")

    existing = session.scalar(select(ScheduledRecovery).where(
        ScheduledRecovery.user_id == user_id,
        ScheduledRecovery.idempotency_key == request_key,
    ))
    if existing is not None:
        if existing.id != recovery.id:
            raise ValueError("This request key belongs to another recovery")
        if existing.provider_event_id:
            return existing

    pair = session.execute(select(CalendarSource, CalendarConnection)
        .join(CalendarConnection, CalendarConnection.id == CalendarSource.connection_id)
        .where(CalendarSource.id == source_id,
            CalendarConnection.user_id == user_id,
            CalendarSource.is_enabled.is_(True),
            CalendarConnection.status == "connected",
            CalendarConnection.scope_mode == "write")).first()
    if pair is None:
        raise PermissionError("Choose a connected calendar with event-write access")
    source, connection = pair

    token_response = httpx.post("https://oauth2.googleapis.com/token", data={
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "refresh_token": decrypt_token(connection.encrypted_refresh_token),
        "grant_type": "refresh_token",
    }, timeout=15.0)
    token_response.raise_for_status()
    access_token = token_response.json()["access_token"]

    event_id = request_key.hex
    event_body = {
        "id": event_id,
        "summary": "Recovery break",
        "description": "A recovery break scheduled in beforeburn.",
        "start": {"dateTime": recovery.starts_at.isoformat()},
        "end": {"dateTime": recovery.ends_at.isoformat()},
    }
    url = ("https://www.googleapis.com/calendar/v3/calendars/" +
           quote(source.provider_calendar_id, safe="") + "/events")
    headers = {"Authorization": f"Bearer {access_token}"}
    response = httpx.post(url, headers=headers, json=event_body, timeout=15.0)
    if response.status_code == 409:
        response = httpx.get(url + "/" + event_id, headers=headers, timeout=15.0)
    response.raise_for_status()

    recovery.idempotency_key = request_key
    recovery.provider_event_id = response.json()["id"]
    recovery.calendar_source_id = source.id
    session.commit()
    session.refresh(recovery)
    return recovery
```

Google receives the same deterministic event ID for a retry. If creation already happened, Google returns conflict and the API reads that event back, then saves the same ID in PostgreSQL. Never log request/response bodies, event details, access tokens, or refresh tokens.

## 4. Add the authenticated route

Create `services/api/app/routes/calendar_write.py`:

```python
from typing import Any
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_session
from app.dependencies import current_user_dependency
from app.schemas.scheduled_recovery import ScheduledRecoveryResponse
from app.schemas.calendar_write import AddToCalendarRequest
from app.services.calendar_write import add_recovery_event

router = APIRouter(prefix="/me/recoveries", tags=["recoveries"])


@router.post("/{recovery_id}/calendar-event", response_model=ScheduledRecoveryResponse)
def create_calendar_event(recovery_id: UUID, payload: AddToCalendarRequest,
    user: dict[str, Any] = Depends(current_user_dependency),
    session: Session = Depends(get_session)):
    try:
        return add_recovery_event(session, UUID(user["id"]), recovery_id,
            payload.idempotency_key, payload.calendar_source_id)
    except LookupError:
        raise HTTPException(status_code=404, detail="Recovery not found")
    except PermissionError as error:
        raise HTTPException(status_code=403, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
```

Register it in `app/main.py`:

```python
from app.routes.calendar_write import router as calendar_write_router
app.include_router(calendar_write_router)
```

Provider/network exceptions are mapped to safe retryable errors in Lab 38. They must never include Google's response body in the API message.

## 5. Add the mobile confirmation action

Install `expo-crypto` from `apps/mobile`:

```bash
npx expo install expo-crypto
```

Create `apps/mobile/components/AddRecoveryToCalendar.tsx`:

```tsx
import { useState } from 'react';
import * as Crypto from 'expo-crypto';
import { Pressable, Text, View } from 'react-native';
import { apiFetch } from '../lib/api';

type Props = { recoveryId: string; sourceId: string; onDone: () => void };

export function AddRecoveryToCalendar({ recoveryId, sourceId, onDone }: Props) {
  const [requestKey] = useState(() => Crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function add() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const response = await apiFetch(`/me/recoveries/${recoveryId}/calendar-event`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idempotency_key: requestKey, calendar_source_id: sourceId }),
      });
      if (!response.ok) throw new Error('Add failed');
      onDone();
    } catch {
      setError('Could not add the break. Retry; the same request will be used.');
    } finally { setBusy(false); }
  }

  return <View>
    <Pressable accessibilityRole="button" disabled={busy} onPress={() => void add()}>
      <Text>{busy ? 'Adding…' : 'Add to calendar'}</Text>
    </Pressable>
    {error !== '' && <Text accessibilityRole="alert">{error}</Text>}
  </View>;
}
```

Show the chosen calendar and recovery time in the confirmation sheet before this component is used. Provide a separate Not now action that does not call the API.

## Verify

With mocked Google requests, test success, same-key retry after a DB-save failure, repeated success, another user's recovery/source, read-only connection, and provider timeout. Manually confirm that two identical requests result in one Google event.

## Exercise

Explain idempotency using an online payment retry. Which value tells the server that the second request is the same purchase?

## Common mistakes

- Retry generates a new key: keep the UUID in component state for the same sheet/action.
- Read-only token attempts a write: require the separately granted write scope and writable calendar.
- Google event succeeds but DB save fails: deterministic provider event IDs let the retry recover the existing event.

## Commit

```bash
git add services/api/app services/api/migrations services/api/tests apps/mobile docs/labs/30-add-recovery-to-calendar.md
git commit -m "feat: add recovery blocks to calendar"
git push
```
