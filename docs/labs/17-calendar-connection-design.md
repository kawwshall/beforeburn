# Lab 17 — Design and store a secure calendar connection

## What you will build

Add the server-side record representing a person connecting Google Calendar. This lab stops before OAuth: first decide where the account link and provider credential belong.

## Product story

Maya signs in to beforeburn, then grants Google permission to read calendar data. These are separate identities and grants: Supabase proves Maya is a beforeburn user; Google grants scoped access to a calendar account.

A Google refresh token can obtain future access tokens. Treat it like a password. Keep it on the API server, encrypt it before storing, never return it to mobile, and never print it in logs. The phone receives only connection status and safe account metadata.

## Before you start

- Labs 6–10 are complete: Alembic, models, DB session, auth dependency, and tests exist.
- Review `services/api/app/models/__init__.py`, `database.py`, and the preference route to follow repository conventions.
- Do not create real Google credentials yet; Lab 18 configures OAuth.

## 0. Put the shared auth dependency in its own file

Later route files need the same bearer-token dependency. Create `services/api/app/dependencies.py`:

```python
from typing import Annotated, Any
from fastapi import Header
from app.auth import get_current_user


def current_user_dependency(
    authorization: Annotated[str | None, Header()] = None,
) -> dict[str, Any]:
    return get_current_user(authorization)
```

In `app/main.py`, import `current_user_dependency` from `app.dependencies` and remove the local function with that name. Existing `/me` and preference routes keep working. This avoids importing route dependencies from `main.py`, which would create circular imports once routers are included.

## 1. Create a calendar connection model

Create `services/api/app/models/calendar_connection.py`:

```python
from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class CalendarConnection(Base):
    __tablename__ = "calendar_connections"
    __table_args__ = (UniqueConstraint("user_id", "provider", name="uq_calendar_user_provider"),)

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    user_id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey("auth.users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    provider: Mapped[str] = mapped_column(String(30), nullable=False, default="google")
    provider_account_email: Mapped[str | None] = mapped_column(String(320))
    encrypted_refresh_token: Mapped[str] = mapped_column(String(4096), nullable=False)
    scope_mode: Mapped[str] = mapped_column(String(20), nullable=False, default="read")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="connected")
    connected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
```

`user_id` references Supabase's `auth.users` table, following the cross-schema FK pattern already used in Lab 7. `ON DELETE CASCADE` removes the connection if the auth user is deleted. The index speeds up owner-scoped lookups, and every service still filters by the signed-in user.

`encrypted_refresh_token` names the expected stored form. Lab 18 supplies encryption/decryption; until then do not store a real token.

## 2. Register and migrate the model

Add to `services/api/app/models/__init__.py`:

```python
from app.models.calendar_connection import CalendarConnection
```

Then, from `services/api`:

```bash
alembic revision --autogenerate -m "add calendar connections"
```

Review the generated migration. Confirm the UUID primary key, owner index, required token column, and that downgrade only removes the new table/index. Then apply:

```bash
alembic upgrade head
alembic current
```

Autogenerate creates a draft from SQLAlchemy metadata; you review before applying it.

## 3. Create an allowlisted response schema

Create `services/api/app/schemas/calendar.py`:

```python
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class CalendarConnectionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    provider: str
    provider_account_email: str | None
    status: str
    scope_mode: str
    connected_at: datetime
```

This response intentionally does not declare `encrypted_refresh_token`. Response schemas are allowlists: only listed fields cross the API boundary.

Create `services/api/app/routes/calendar_connections.py` so the app can ask whether it is connected without receiving a credential:

```python
from typing import Any
from uuid import UUID
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.database import get_session
from app.dependencies import current_user_dependency
from app.models.calendar_connection import CalendarConnection
from app.schemas.calendar import CalendarConnectionResponse

router = APIRouter(prefix="/me/calendar-connections", tags=["calendar"])


@router.get("", response_model=list[CalendarConnectionResponse])
def list_connections(current_user: dict[str, Any] = Depends(current_user_dependency),
                     session: Session = Depends(get_session)):
    statement = select(CalendarConnection).where(
        CalendarConnection.user_id == UUID(current_user["id"])
    ).order_by(CalendarConnection.connected_at.desc())
    return list(session.scalars(statement).all())
```

Register it in `app/main.py` with:

```python
from app.routes.calendar_connections import router as calendar_connections_router
app.include_router(calendar_connections_router)
```

The GET route returns only safe fields and an empty list when disconnected. OAuth connect/callback routes are added in Lab 18; they share the URL prefix but use the more specific `/google/...` paths.

## 4. Design the permission explanation

Before showing a Connect button, the mobile screen explains what data is read, how it supports planning, that the connection can be removed, and where to remove it. Avoid absolute privacy promises until the feature's storage, deletion, and logging behavior is implemented.

## Verify

Run `alembic current`, inspect the table, and review the response schema. Search app code for `DATABASE_URL` and ensure it appears only in the API. Check no service-role key or Google secret exists in the mobile project.

## Troubleshooting

- Empty migration: import the model before Alembic reads metadata.
- Permission error for `auth.users`: compare with Lab 7's established FK. Do not grant broad privileges casually.
- Token in API JSON: return the Pydantic response model, not the raw ORM row.

## Independent exercise

For a reading app connecting an outside book service, list three response-safe fields and the credential that remains server-only.

## Commit

```bash
git add services/api/app/models services/api/app/schemas services/api/migrations docs/labs/17-calendar-connection-design.md
git commit -m "feat(api): add calendar connection model"
git push
```
