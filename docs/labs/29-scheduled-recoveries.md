# Lab 29 — Schedule and track recovery sessions

## Goal

Turn catalogue items into a person's scheduled recovery sessions. Catalogue content is shared; a scheduled session is private user-owned data.

## Before you start

Complete Labs 24–28. The catalogue migration and API must work, and the authenticated-user dependency must be available.

## 1. Create the model

Create `app/models/scheduled_recovery.py`:

```python
from datetime import datetime, timedelta
from uuid import UUID, uuid4
from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class ScheduledRecovery(Base):
    __tablename__ = "scheduled_recoveries"
    __table_args__ = (
        CheckConstraint("ends_at > starts_at", name="ck_recovery_end_after_start"),
        CheckConstraint(
            "status IN ('suggested', 'accepted', 'started', 'completed', 'cancelled')",
            name="ck_scheduled_recovery_status",
        ),
    )
    id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True), ForeignKey("auth.users.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    catalogue_item_id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True), ForeignKey("recovery_catalogue_items.id", ondelete="RESTRICT"), nullable=False
    )
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="suggested")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
```

`RESTRICT` protects catalogue history from deletion while sessions refer to it. Generate and review an Alembic migration before applying.

## 2. Define allowed state transitions

Create `app/services/recovery_lifecycle.py`:

```python
ALLOWED = {
    "suggested": {"accepted", "cancelled"},
    "accepted": {"started", "cancelled"},
    "started": {"completed", "cancelled"},
    "completed": set(),
    "cancelled": set(),
}


def transition(current: str, requested: str) -> str:
    if requested not in ALLOWED.get(current, set()):
        raise ValueError(f"Cannot change recovery from {current} to {requested}.")
    return requested
```

The service owns this rule so all routes enforce the same lifecycle. Add tests for every allowed edge and representative forbidden edges.

## 3. Add exact request/response schemas

Create `app/schemas/scheduled_recovery.py`:

```python
from datetime import datetime
from typing import Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, field_validator


class ScheduledRecoveryCreate(BaseModel):
    catalogue_item_id: UUID
    starts_at: datetime

    @field_validator("starts_at")
    @classmethod
    def start_must_have_timezone(cls, value: datetime) -> datetime:
        if value.utcoffset() is None:
            raise ValueError("starts_at must include a timezone")
        return value


class ScheduledRecoveryStatusUpdate(BaseModel):
    status: Literal["accepted", "started", "completed", "cancelled"]


class ScheduledRecoveryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    catalogue_item_id: UUID
    starts_at: datetime
    ends_at: datetime
    status: str
```

The request intentionally omits `user_id`; the response omits internal ownership and provider credential fields.

## 4. Add owner-scoped API

Create `app/routes/scheduled_recoveries.py`:

```python
from datetime import timedelta
from typing import Annotated, Any
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.database import get_session
from app.dependencies import current_user_dependency
from app.models.recovery_catalogue import RecoveryCatalogueItem
from app.models.scheduled_recovery import ScheduledRecovery
from app.schemas.scheduled_recovery import (
    ScheduledRecoveryCreate, ScheduledRecoveryResponse, ScheduledRecoveryStatusUpdate,
)
from app.services.recovery_lifecycle import transition

router = APIRouter(prefix="/me/recoveries", tags=["recoveries"])


@router.post("", response_model=ScheduledRecoveryResponse, status_code=201)
def create_recovery(
    payload: ScheduledRecoveryCreate,
    user: Annotated[dict[str, Any], Depends(current_user_dependency)],
    session: Session = Depends(get_session),
):
    item = session.get(RecoveryCatalogueItem, payload.catalogue_item_id)
    if item is None or not item.is_active:
        raise HTTPException(status_code=404, detail="Recovery activity not found")
    row = ScheduledRecovery(
        user_id=UUID(user["id"]), catalogue_item_id=item.id,
        starts_at=payload.starts_at,
        ends_at=payload.starts_at + timedelta(minutes=item.duration_minutes),
        status="suggested",
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return row


@router.get("", response_model=list[ScheduledRecoveryResponse])
def list_recoveries(
    user: Annotated[dict[str, Any], Depends(current_user_dependency)],
    session: Session = Depends(get_session),
):
    rows = session.scalars(select(ScheduledRecovery).where(
        ScheduledRecovery.user_id == UUID(user["id"])
    ).order_by(ScheduledRecovery.starts_at)).all()
    return rows


@router.patch("/{recovery_id}/status", response_model=ScheduledRecoveryResponse)
def update_recovery_status(
    recovery_id: UUID,
    payload: ScheduledRecoveryStatusUpdate,
    user: Annotated[dict[str, Any], Depends(current_user_dependency)],
    session: Session = Depends(get_session),
):
    row = session.scalar(select(ScheduledRecovery).where(
        ScheduledRecovery.id == recovery_id,
        ScheduledRecovery.user_id == UUID(user["id"]),
    ))
    if row is None:
        raise HTTPException(status_code=404, detail="Recovery not found")
    try:
        row.status = transition(row.status, payload.status)
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    session.commit()
    session.refresh(row)
    return row
```

Include this router in `app/main.py` with `app.include_router(scheduled_recoveries.router)`.

## 5. Build the mobile card and confirmation

Create `apps/mobile/components/ScheduleRecoveryButton.tsx`:

```tsx
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { apiFetch } from '../lib/api';

type Props = { catalogueItemId: string; title: string; durationMinutes: number };

export function ScheduleRecoveryButton({ catalogueItemId, title, durationMinutes }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  function proposedStartTime() {
    const value = new Date(Date.now() + 30 * 60_000);
    value.setSeconds(0, 0);
    return value;
  }
  async function create(proposedStart: Date) {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const response = await apiFetch('/me/recoveries', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ catalogue_item_id: catalogueItemId,
          starts_at: proposedStart.toISOString() }),
      });
      if (!response.ok) throw new Error('Schedule failed');
      const created = await response.json() as { id: string };
      router.push({ pathname: '/recovery-player', params: { recoveryId: created.id } });
    } catch { setError('Could not schedule this recovery. Try again.'); }
    finally { setBusy(false); }
  }
  function confirm() {
    const start = proposedStartTime();
    Alert.alert(`Schedule ${title}?`,
      `${durationMinutes} minutes, starting ${start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`,
      [{ text: 'Not now', style: 'cancel' },
       { text: 'Add this break', onPress: () => void create(start) }]);
  }
  return <View>
    <Pressable accessibilityRole="button" disabled={busy} onPress={confirm}>
      <Text>{busy ? 'Scheduling…' : 'Add this break'}</Text>
    </Pressable>
    {error !== '' && <Text accessibilityRole="alert">{error}</Text>}
  </View>;
}
```

The schedule API derives owner and duration on the server. The client proposes an ISO timestamp; the confirmation shows the local display time. Only the confirmation button creates the personal session.

## Verify

Test create, accept, start, complete, cancel, forbidden transition, unknown catalogue item, and user isolation. Confirm deleting a catalogue item referenced by a session is restricted.

## Exercise

Add a `snoozed` state. Draw its allowed transitions first, then update the transition map and tests.

## Common mistakes

- Client sets status directly to `completed`: only accept a requested transition and validate it in the service.
- User ID comes from JSON: derive it from the verified token.
- Catalogue row gets deleted unexpectedly: use `RESTRICT` because scheduled records reference it.

## Commit

```bash
git add services/api/app services/api/migrations services/api/tests apps/mobile docs/labs/29-scheduled-recoveries.md
git commit -m "feat: schedule recovery sessions"
git push
```
