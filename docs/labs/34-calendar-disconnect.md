# Lab 34 — Disconnect a calendar and stop syncing

## Goal

Make disconnect a complete account-link lifecycle: stop scheduled sync, remove server credentials, apply the documented cached-data policy, and update the UI.

## Before you start

Complete Labs 17–23. Have a connected development calendar and imported test events. Do not test against a personal account with data you need.

## 1. Define the data policy

Choose and document whether cached provider events are deleted immediately or retained briefly for a stated product reason. For this app, implement immediate deletion of imported events and calendar source metadata when the connection is removed. Keep beforeburn-created recovery sessions separate.

## 2. Implement the service transaction

For this course version, choose to delete the local connection and its imported event cache immediately. The refresh token is removed locally in the same database transaction. Google-side revocation is deliberately not part of this request: local access stops even if Google is unavailable. Add `services/api/app/services/calendar_disconnect.py`:

```python
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.calendar_connection import CalendarConnection


def disconnect_calendar(session: Session, user_id: UUID,
                        connection_id: UUID) -> bool:
    connection = session.scalar(select(CalendarConnection).where(
        CalendarConnection.id == connection_id,
        CalendarConnection.user_id == user_id,
    ))
    if connection is None:
        return False
    # The FK from calendar_sources to calendar_connections uses ON DELETE CASCADE;
    # calendar_events cascade from their source. One delete removes the cache and token.
    session.delete(connection)
    session.commit()
    return True
```

Create `services/api/app/routes/calendar_disconnect.py`:

```python
from typing import Any
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from app.database import get_session
from app.dependencies import current_user_dependency
from app.services.calendar_disconnect import disconnect_calendar

router = APIRouter(prefix="/me/calendar-connections", tags=["calendar"])


@router.delete("/{connection_id}", status_code=204)
def delete_connection(connection_id: UUID,
    current_user: dict[str, Any] = Depends(current_user_dependency),
    session: Session = Depends(get_session)) -> Response:
    deleted = disconnect_calendar(session, UUID(current_user["id"]), connection_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Calendar connection not found")
    return Response(status_code=204)
```

Register this router in `app/main.py` with `app.include_router(calendar_disconnect.router)`. Keep the ownership filter on both connection ID and authenticated owner; that two-part filter is the security boundary. Every sync service must also load only rows from a still-existing connected connection, so a job queued before deletion cannot use credentials afterward.

## 3. Build mobile confirmation

Create `apps/mobile/components/DisconnectCalendarButton.tsx`:

```tsx
import { useState } from 'react';
import { Alert, Pressable, Text } from 'react-native';
import { apiFetch } from '../lib/api';

export function DisconnectCalendarButton({ connectionId, onDisconnected }:
  { connectionId: string; onDisconnected: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  function confirm() {
    Alert.alert('Disconnect Google Calendar?',
      'Imported calendar events will be deleted from beforeburn. Your recovery sessions will remain. This does not delete events from Google.',
      [{ text: 'Keep connected', style: 'cancel' },
       { text: 'Disconnect', style: 'destructive', onPress: () => void disconnect() }]);
  }
  async function disconnect() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const response = await apiFetch(`/me/calendar-connections/${encodeURIComponent(connectionId)}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Disconnect failed');
      onDisconnected();
    } catch { setError('Could not confirm disconnection. Refresh status before trying again.'); }
    finally { setBusy(false); }
  }
  return <>
    <Pressable accessibilityRole="button" disabled={busy} onPress={confirm}>
      <Text>{busy ? 'Disconnecting…' : 'Disconnect Google Calendar'}</Text>
    </Pressable>
    {error !== '' && <Text accessibilityRole="alert">{error}</Text>}
  </>;
}
```

On success, call `load()` in the Plan screen to clear stale source data and show the not-connected state. The copy distinguishes this local cache deletion from the Google account and beforeburn-created recovery sessions.

## 4. Verify

Test normal disconnect, unknown ID, another user's ID, provider outage during revocation, and a queued sync attempting to run after disconnect. Confirm no usable token remains in the database.

For the route test, create user A's connection, authenticate as user B, call DELETE, and assert 404 plus that the connection still exists for A. This proves the route cannot delete based on an ID alone.

## Exercise

Add reconnect flow and decide whether old calendar selections are restored or start disabled. Document the reasoning.

## Common mistakes

- API removes another user's connection: include both record ID and authenticated owner in the query.
- Background job syncs after disconnect: re-check connection status immediately before provider access.
- Mobile still shows cached events: invalidate local cache after successful disconnect.

## Commit

```bash
git add services/api/app services/api/tests apps/mobile docs/labs/34-calendar-disconnect.md
git commit -m "feat: add calendar disconnect"
git push
```
