# Lab 24 — Store one daily energy check-in

## Goal

Add a 1–5 self-reported energy check-in that belongs to one user and one local calendar date. This exercise teaches schema constraints, authenticated ownership, API validation, and mobile form states.

## Before you start

Labs 7–10 are complete. Read the existing preference model, service, route, and tests to follow this repository's conventions.

## 1. Design the table

Create `app/models/check_in.py`:

```python
from datetime import date, datetime
from uuid import UUID, uuid4
from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class CheckIn(Base):
    __tablename__ = "check_ins"
    __table_args__ = (
        CheckConstraint("energy_score BETWEEN 1 AND 5", name="ck_check_in_score_1_5"),
        UniqueConstraint("user_id", "local_date", name="uq_check_in_user_date"),
    )

    id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True), ForeignKey("auth.users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    local_date: Mapped[date] = mapped_column(Date, nullable=False)
    energy_score: Mapped[int] = mapped_column(nullable=False)
    note: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
```

The DB check constraint protects data even if a future import bypasses the API. The unique pair means one row per person per local day. `local_date` is not UTC: the user's preference timezone determines which day a check-in belongs to.

Register the model, generate migration, inspect constraints, and apply it:

```bash
alembic revision --autogenerate -m "add daily check ins"
alembic upgrade head
```

## 2. Validate API input

Create `app/schemas/check_in.py` with a Pydantic request model containing `energy_score: int` constrained from 1 through 5, and optional `note` limited to 500 characters. Add response fields `id`, `local_date`, `energy_score`, `note`, and timestamps. Never accept `user_id`; the authenticated identity supplies it.

Example for Pydantic 2:

```python
from datetime import date, datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class CheckInUpdate(BaseModel):
    energy_score: int = Field(ge=1, le=5)
    note: str | None = Field(default=None, max_length=500)


class CheckInResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    local_date: date
    energy_score: int
    note: str | None
    created_at: datetime
    updated_at: datetime
```

## 3. Create the service and route

Create `app/services/check_ins.py` with this complete service:

```python
from datetime import date
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.check_in import CheckIn


def get_for_date(session: Session, user_id: UUID, local_date: date) -> CheckIn | None:
    return session.scalar(select(CheckIn).where(
        CheckIn.user_id == user_id, CheckIn.local_date == local_date
    ))


def save_for_date(session: Session, user_id: UUID, local_date: date,
                  energy_score: int, note: str | None) -> CheckIn:
    row = get_for_date(session, user_id, local_date)
    if row is None:
        row = CheckIn(user_id=user_id, local_date=local_date,
                      energy_score=energy_score, note=note)
        session.add(row)
    else:
        row.energy_score = energy_score
        row.note = note
    session.commit()
    session.refresh(row)
    return row
```

Add these imports to `app/main.py`, then add these route functions. This project already has `current_user_dependency` and `get_session`; preserve those established names:

```python
from datetime import date
from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from app.schemas.check_in import CheckInUpdate, CheckInResponse
from app.services.check_ins import get_for_date, save_for_date


@app.get("/me/check-ins/{local_date}", response_model=CheckInResponse)
def read_check_in(local_date: date,
                  current_user: dict = Depends(current_user_dependency),
                  session: Session = Depends(get_session)):
    row = get_for_date(session, UUID(current_user["id"]), local_date)
    if row is None:
        raise HTTPException(status_code=404, detail="Check-in not found")
    return row


@app.put("/me/check-ins/{local_date}", response_model=CheckInResponse)
def write_check_in(local_date: date, payload: CheckInUpdate,
                   current_user: dict = Depends(current_user_dependency),
                   session: Session = Depends(get_session)):
    return save_for_date(session, UUID(current_user["id"]), local_date,
                         payload.energy_score, payload.note)
```

Also add `from uuid import UUID` if it is not already imported. `PUT` means “make this date's check-in equal to this payload,” so repeating it is safe. The unique constraint prevents duplicates if simultaneous requests race; if this becomes a common race in production, replace the read-then-write with PostgreSQL `INSERT ... ON CONFLICT`.

## 4. Add tests before mobile

Test score 0 and 6 return 422; score 1 and 5 succeed; same user/date updates one row; another user's row is never returned. Mock or use the test session fixture from Lab 8. Run `python -m pytest`.

Add an API route test that authenticates as user A and requests user B's UUID in any route that takes a record ID. The check-in date route itself has no user ID parameter, which is one reason it is harder to misuse.

## Common mistakes

- Duplicate rows for one date: enforce the user/date unique constraint and update existing rows.
- User changes another account's data: derive identity from auth, never the request body.
- Check-in belongs to the wrong day: use the profile timezone to determine local date.

## 5. Build the mobile interaction

Create `apps/mobile/components/CheckInCard.tsx`:

```tsx
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { apiFetch } from '../lib/api';

type Props = { localDate: string; initialScore?: number | null };

export function CheckInCard({ localDate, initialScore = null }: Props) {
  const [score, setScore] = useState<number | null>(initialScore);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  async function save() {
    if (score === null) return;
    setStatus('saving');
    try {
      const response = await apiFetch(`/me/check-ins/${localDate}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ energy_score: score, note: null }),
      });
      if (!response.ok) throw new Error('Save failed');
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  }

  return <View accessibilityLabel="Daily energy check-in">
    <Text>How is your energy today?</Text>
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {[1, 2, 3, 4, 5].map((value) => <Pressable key={value}
        accessibilityRole="radio" accessibilityState={{ selected: score === value }}
        accessibilityLabel={`Energy ${value} of 5`} onPress={() => setScore(value)}>
        <Text>{score === value ? `● ${value}` : `${value}`}</Text>
      </Pressable>)}
    </View>
    <Text>{score === null ? 'Choose 1 to 5' : `Energy: ${score} of 5`}</Text>
    <Pressable accessibilityRole="button" disabled={score === null || status === 'saving'} onPress={save}>
      {status === 'saving' ? <ActivityIndicator /> : <Text>Save check-in</Text>}
    </Pressable>
    {status === 'saved' && <Text accessibilityLiveRegion="polite">Saved</Text>}
    {status === 'error' && <Text accessibilityRole="alert">Could not save. Try again.</Text>}
  </View>;
}
```

Pass the user's local date as `YYYY-MM-DD` from the profile timezone, not a UTC date produced by `toISOString()`.

## Why this is general

Many app records are “one per user per period”: daily habit completion, weekly review, monthly budget. A unique constraint encodes that rule at the database level.

## Exercise

Add `sleep_hours` as an optional decimal field. Decide a credible range, validate it in Pydantic and PostgreSQL, and write tests for each boundary.

## Commit

```bash
git add services/api/app services/api/migrations services/api/tests apps/mobile docs/labs/24-daily-energy-check-in.md
git commit -m "feat: add daily energy check-ins"
git push
```
