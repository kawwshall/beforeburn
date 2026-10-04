# Lab 28 — Build the Recovery catalogue from database to mobile

## What you will build

The Recovery screen will display product-curated activities from a database-backed API. You will create the table and seed data in a migration, add a read-only endpoint, and render API-driven cards with loading, error, and empty states.

The pattern transfers to any app-owned reference content: recipe lists, workout plans, lesson templates, or help articles.

## Product example

Maya has a dense afternoon. beforeburn offers “One-minute reset” and “Cosmic Drift.” The catalogue is shared across users and edited by the product team. Maya can read the entries; her phone cannot create or edit the catalogue.

## Before you start

- Labs 6–10: API, database, Alembic, and tests work.
- Labs 11–16: Expo app and API request helper exist.
- Run the API tests before beginning and fix existing failures first.

## Concepts

| Term | Meaning here |
| --- | --- |
| Reference data | Product-controlled records used by many users. |
| Seed data | Initial records inserted during schema setup. |
| Stable ID | Identifier that remains the same if a title changes. |
| Read-only API | A route that can list data but cannot mutate it from the client. |
| UI state | Loading, error, empty, and populated are distinct states. |

## Part A — Database model and migration

### 1. Create the model

Create `services/api/app/models/recovery_catalogue.py`:

```python
from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, DateTime, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class RecoveryCatalogueItem(Base):
    __tablename__ = "recovery_catalogue_items"
    __table_args__ = (
        CheckConstraint("duration_minutes BETWEEN 1 AND 180", name="ck_recovery_duration"),
    )

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    slug: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    kind: Mapped[str] = mapped_column(String(40), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
```

`id` identifies the row. `slug` is a human-readable stable key and must be unique. Duration is stored as an integer, not display text like “5 min.” The check constraint prevents nonsensical durations even if data is inserted outside the API. The catalogue has no `user_id`: these entries belong to the product, not an individual.

### 2. Register the model and generate migration

Add this import to `services/api/app/models/__init__.py`:

```python
from app.models.recovery_catalogue import RecoveryCatalogueItem
```

From `services/api`, run:

```bash
alembic revision --autogenerate -m "create recovery catalogue"
```

Open the new migration. Check the table, primary key, unique slug, non-null fields, and duration constraint. Autogenerate proposes schema changes; a human reviews them.

### 3. Seed the initial catalogue

In that migration's `upgrade()`, after `op.create_table(...)`, insert two rows:

```python
recovery_catalogue = sa.table(
    "recovery_catalogue_items",
    sa.column("id", postgresql.UUID),
    sa.column("slug", sa.String),
    sa.column("title", sa.String),
    sa.column("description", sa.Text),
    sa.column("duration_minutes", sa.Integer),
    sa.column("kind", sa.String),
    sa.column("is_active", sa.Boolean),
)
op.bulk_insert(recovery_catalogue, [
    {
        "id": "6a65c6d6-39d0-4bd4-95df-0bc68e05eb00",
        "slug": "one-minute-reset",
        "title": "One-minute reset",
        "description": "Pause, breathe slowly, and return with a little more space.",
        "duration_minutes": 1, "kind": "breathing", "is_active": True,
    },
    {
        "id": "6a65c6d6-39d0-4bd4-95df-0bc68e05eb01",
        "slug": "cosmic-drift",
        "title": "Cosmic Drift",
        "description": "A quiet guided pause for stepping away from a busy day.",
        "duration_minutes": 5, "kind": "audio", "is_active": True,
    },
])
```

Ensure the migration imports `sqlalchemy as sa` and `from sqlalchemy.dialects import postgresql`; Alembic's generated migration may already include them. Fixed UUIDs make seed rows predictable across environments. The downgrade should drop the table, which also removes its seed rows.

Apply and inspect:

```bash
alembic upgrade head
alembic current
```

### 4. Add the SQLAlchemy query

Create `services/api/app/services/recovery.py`:

```python
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.recovery_catalogue import RecoveryCatalogueItem


def list_active_recoveries(session: Session) -> list[RecoveryCatalogueItem]:
    statement = (
        select(RecoveryCatalogueItem)
        .where(RecoveryCatalogueItem.is_active.is_(True))
        .order_by(RecoveryCatalogueItem.duration_minutes, RecoveryCatalogueItem.title)
    )
    return list(session.scalars(statement).all())
```

The query filters inactive entries server-side. The phone must not be responsible for hiding retired content because another client could still request it.

## Part B — Read-only API

### 5. Define the response contract

Create `services/api/app/schemas/recovery.py`:

```python
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class RecoveryCatalogueItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    slug: str
    title: str
    description: str
    duration_minutes: int
    kind: str
```

The response is an allowlist; internal fields such as `is_active` and timestamps are not exposed.

### 6. Add the route

Create `services/api/app/routes/recovery.py`:

```python
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_session
from app.schemas.recovery import RecoveryCatalogueItemResponse
from app.services.recovery import list_active_recoveries

router = APIRouter(prefix="/recoveries", tags=["recoveries"])


@router.get("", response_model=list[RecoveryCatalogueItemResponse])
def get_recoveries(session: Session = Depends(get_session)):
    return list_active_recoveries(session)
```

Import and include this router in `app/main.py` using the same pattern as the existing preferences router. This endpoint is public because the catalogue contains no personal data. Do not reuse this public route for user-specific recommendations.

### 7. Test the service and endpoint

Write tests that verify active-only ordering and `GET /recoveries` returns the safe shape. Seed test rows using the test database fixture; do not depend on your personal Supabase data. Include an inactive row and assert it is absent.

Run:

```bash
python -m pytest
uvicorn app.main:app --reload
```

Open `http://127.0.0.1:8000/recoveries`; expect a JSON list with the two entries. `/docs` should list the route and response fields.

## Part C — Mobile catalogue screen

### 8. Create a type and public fetch function

Create `apps/mobile/types/recovery.ts`:

```ts
export type RecoveryCatalogueItem = {
  id: string;
  slug: string;
  title: string;
  description: string;
  duration_minutes: number;
  kind: string;
};
```

Add `publicApiFetch(path)` to `apps/mobile/lib/api.ts`. It calls the configured API base URL without a bearer token, checks `response.ok`, and throws a user-safe error. Use it only for public endpoints like this catalogue; all personal routes continue using `apiFetch`.

Implementation, alongside the existing authenticated helper:

```ts
export async function publicApiFetch(path: string): Promise<Response> {
  const response = await fetch(`${apiUrl}${path}`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error('Could not load recovery activities. Please try again.');
  }
  return response;
}
```

### 9. Create the Recovery screen

Create `apps/mobile/app/(tabs)/recovery.tsx`. Keep state for `items`, `isLoading`, and `error`. Put network loading in one `loadRecoveries()` function and call it from `useEffect`; the Retry button calls that same function.

Core screen implementation (add theme styling to match your app):

```tsx
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { publicApiFetch } from '@/lib/api';
import { RecoveryCatalogueItem } from '@/types/recovery';

export default function RecoveryScreen() {
  const [items, setItems] = useState<RecoveryCatalogueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadRecoveries() {
    setIsLoading(true);
    setError(null);
    try {
      const response = await publicApiFetch('/recoveries');
      setItems(await response.json());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load activities.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { void loadRecoveries(); }, []);

  if (isLoading) return <ActivityIndicator accessibilityLabel="Loading recovery activities" />;
  if (error) return <View><Text>{error}</Text><Pressable onPress={() => void loadRecoveries()}><Text>Retry</Text></Pressable></View>;
  if (items.length === 0) return <Text>No recovery activities are available right now.</Text>;

  return <FlatList
    data={items}
    keyExtractor={(item) => item.id}
    renderItem={({ item }) => <View accessible accessibilityLabel={`${item.title}, ${item.duration_minutes} minutes. ${item.description}`}>
      <Text>{item.title}</Text>
      <Text>{item.description}</Text>
      <Text>{item.duration_minutes} min</Text>
    </View>}
  />;
}
```

Each early return corresponds to a distinct state. `finally` turns loading off on both success and failure. The `keyExtractor` gives React a stable row identity even if the title changes.

Render these cases explicitly:

```text
loading       → labeled ActivityIndicator
error         → friendly message and Retry button
empty list    → “No recovery activities are available right now.”
populated     → cards with title, description, and duration badge
```

Use `FlatList` for a list that may grow. Give each card an accessibility label such as “Cosmic Drift, 5 minutes. A quiet guided pause…” Reuse the app theme tokens rather than hardcoding arbitrary colors. Add this inside the existing `<Tabs>` in `apps/mobile/app/(tabs)/_layout.tsx`:

```tsx
<Tabs.Screen name="recovery" options={{ title: 'Recovery' }} />
```

## Verify end to end

1. Run API and mobile in separate terminals.
2. Confirm the two migration-seeded entries appear.
3. Stop the API and verify the screen shows an error and Retry, not a crash.
4. Temporarily return an empty list in a local test and verify the empty message.
5. Confirm inactive catalogue entries never appear.
6. Inspect `git status` and ensure `.env` is not staged.

## Troubleshooting

- Empty migration: import model before Alembic reads `Base.metadata`.
- API 500: ensure migration is applied and table name matches the model.
- Phone network failure: use your Mac's LAN IP instead of `127.0.0.1` on a physical device.
- Duplicate seed error: migration likely ran twice manually; seed belongs to a versioned migration and should be applied once by Alembic.

## Independent exercise

Add a `featured` boolean to the model, create a new migration, expose it in the response, and render an accessible Featured label. Explain why the server owns this choice rather than the app guessing from the title.

## Commit

```bash
git add services/api/app services/api/migrations services/api/tests apps/mobile docs/labs/28-recovery-catalogue.md
git commit -m "feat: add recovery catalogue"
git push
```
