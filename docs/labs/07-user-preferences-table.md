# Lab 7 — Model, generate, and apply user preferences

## Objective

Design the first beforeburn data model in readable Python, generate a migration from that model, review the migration, and apply it to Supabase.

This is the usual professional workflow:

```text
Product statement → SQLAlchemy model → Alembic migration draft → review → database
```

## Product story

Nysa signs in to beforeburn. She chooses `Asia/Kolkata`, optionally enters her usual sleep window, and enables reduced motion if immersive visuals make her uncomfortable. Those facts must remain available after she closes the app.

One row means: **one authenticated user’s beforeburn preferences**.

## Prerequisites

- Labs 1–6 and the schema-design masterclass completed.
- `alembic current` reports the baseline revision at `(head)`.
- The local `.env` database connection works.

## The three layers

| Layer | Job | Example |
| --- | --- | --- |
| Model | Readable current design in Python | `UserPreference` class |
| Migration | Historical instructions for changing an existing database | `create_user_preferences.py` |
| Database | Actual running tables | Supabase PostgreSQL |

Changing the model alone does not change Supabase. Alembic compares the model metadata with the database history and generates a migration draft.

## Schema decisions

| Column | Decision and reason |
| --- | --- |
| `user_id` | UUID primary key. One user can have only one preference row. |
| `time_zone` | Required text, defaulting to `UTC`; dates and reminders need a time zone. |
| `sleep_start`, `sleep_end` | Optional times; onboarding answers may be skipped. |
| `reduced_motion` | Required Boolean, default `false`; accessibility preference. |
| `created_at`, `updated_at` | Time-zone-aware timestamps with database defaults. |

Supabase owns the `auth.users` table. We will add its cross-schema foreign-key rule in the generated migration review, rather than pretending that beforeburn owns the auth table in its model metadata.

## Steps

### 1. Create the shared model base

From `services/api`, create `app/database.py`:

```python
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Parent class for beforeburn's SQLAlchemy models."""
```

**What it means:** every model will inherit from `Base`. SQLAlchemy collects the table descriptions from these model classes into `Base.metadata`; Alembic reads that metadata when generating migrations.

### 2. Create the models package

Create `app/models/__init__.py` with:

```python
from app.models.user_preference import UserPreference

__all__ = ["UserPreference"]
```

This import is intentional. It ensures Python loads the model before Alembic looks at `Base.metadata`.

### 3. Create the `UserPreference` model

Create `app/models/user_preference.py`:

```python
from datetime import datetime, time
from uuid import UUID

from sqlalchemy import Boolean, DateTime, String, Time, false, text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class UserPreference(Base):
    """One user's beforeburn preferences."""

    __tablename__ = "user_preferences"

    user_id: Mapped[UUID] = mapped_column(primary_key=True)
    time_zone: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        server_default=text("'UTC'"),
    )
    sleep_start: Mapped[time | None] = mapped_column(Time(), nullable=True)
    sleep_end: Mapped[time | None] = mapped_column(Time(), nullable=True)
    reduced_motion: Mapped[bool] = mapped_column(
        Boolean(),
        nullable=False,
        server_default=false(),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )
```

## Code walkthrough

| Code | Meaning |
| --- | --- |
| `class UserPreference(Base)` | A Python class that SQLAlchemy maps to a database table. |
| `__tablename__` | The exact PostgreSQL table name. |
| `Mapped[str]` | The Python type of the value when the application reads a row. |
| `mapped_column(...)` | The database-column details: SQL type, required/optional rule, and default. |
| `primary_key=True` | Makes `user_id` unique and required. |
| `time | None` | The app can receive a time or no value at all. |
| `server_default` | PostgreSQL creates a value even when another tool—not Python—adds a row. |
| `DateTime(timezone=True)` | Stores an instant safely across time zones. |

`server_default` is different from a Python `default`: it runs inside PostgreSQL. That is safer for imports, admin tools, and future services that may create rows without using this exact Python class.

### 4. Point Alembic at the model metadata

Open `migrations/env.py`. Add these two imports below the existing SQLAlchemy imports:

```python
from app.database import Base
from app import models  # noqa: F401
```

Then replace:

```python
target_metadata = None
```

with:

```python
target_metadata = Base.metadata
```

The unused-looking `models` import is required: it loads `UserPreference`, which registers its table with `Base.metadata`.

### 5. Predict the migration

Before generating it, answer:

1. Which table name should Alembic detect?
2. Which columns should be nullable?
3. Which columns should have database defaults?
4. Why does changing this Python file not immediately create a Supabase table?

### 6. Generate the migration draft

Run from `services/api` with `(.venv)` active:

```bash
alembic revision --autogenerate -m "create user preferences"
```

Alembic creates a file inside `migrations/versions/`. Open it before applying it. You should see an `op.create_table("user_preferences", ...)` call with the columns from the model.

### 7. Add the cross-schema foreign key during review

The model cannot fully describe Supabase’s separate `auth.users` table because beforeburn does not own that table’s metadata. In the new migration’s `upgrade()` function, directly after `op.create_table(...)`, add:

```python
op.create_foreign_key(
    "user_preferences_user_id_fkey",
    "user_preferences",
    "users",
    ["user_id"],
    ["id"],
    source_schema="public",
    referent_schema="auth",
    ondelete="CASCADE",
)
```

At the beginning of `downgrade()`, before `op.drop_table(...)`, add:

```python
op.drop_constraint(
    "user_preferences_user_id_fkey",
    "user_preferences",
    schema="public",
    type_="foreignkey",
)
```

**Why `CASCADE`?** A preference row belongs only to its user. If that Supabase Auth account is deleted, keeping its preferences would be private orphaned data with no useful owner.

### 8. Apply and inspect

Run:

```bash
alembic upgrade head
alembic current
```

Open Supabase **Database → Tables → user_preferences**. Confirm its seven columns. Inspect the foreign-key relationship to `auth.users` if the dashboard displays relationships separately.

### 9. Test and commit

Run:

```bash
python -m pytest
```

Then, from the project root:

```bash
cd ../..
git status
```

Confirm `.env` is not listed, then commit the safe files:

```bash
git add docs/labs services/api/app services/api/migrations
git commit -m "feat(api): add user preferences schema"
git push
```

## Independent exercise

Before running `alembic upgrade head`, add a new model field for a morning-plan notification preference:

```python
morning_plan_notifications: Mapped[bool] = mapped_column(
    Boolean(),
    nullable=False,
    server_default=text("true"),
)
```

Generate a fresh migration only after adding the model. Then inspect whether Alembic included the new column.

Explain:

1. Why is this a Boolean rather than text?
2. Why does it need a default?
3. What would happen if it were `nullable=False` with no default while existing users already had preference rows?

## What you learned

Models make the present schema readable. Migrations make schema history repeatable. Autogeneration accelerates normal work, but review remains essential—especially where a database has externally owned tables, sensitive data, or non-trivial constraints.

