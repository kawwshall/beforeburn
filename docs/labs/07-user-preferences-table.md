# Lab 7 — Create the user-preferences table

## Objective

Create the first beforeburn application table, `user_preferences`, through an Alembic migration. It stores preferences that the app will later read and update for each signed-in user.

## Prerequisites

- Labs 1–6 completed.
- `alembic current` reports the baseline revision at `(head)`.
- The local `.env` database connection works.

## What this table stores

| Column | Purpose |
| --- | --- |
| `user_id` | The unique ID of the user in Supabase Auth. One user has one preference row. |
| `time_zone` | The user’s time zone, needed for dates, reminders, and calendar events. |
| `sleep_start` / `sleep_end` | Optional usual sleep window used to protect recovery time. |
| `reduced_motion` | Whether immersive visuals should reduce animation. |
| `created_at` / `updated_at` | When the preference row was created or last changed. |

## Vocabulary

- **Table:** a structured collection of related records.
- **Row:** one record in a table; here, one user’s preferences.
- **Column:** one named value in every row.
- **Primary key:** a value that uniquely identifies a row.
- **Foreign key:** a value that must refer to an existing record in another table.
- **Constraint:** a database rule that prevents invalid data.

## Design decision

`user_id` is both the primary key and a foreign key to `auth.users.id`, the Supabase Auth user. This guarantees one preference row per real authenticated user and automatically deletes preferences if that user is deleted.

## Steps

### 1. Activate the backend environment

From the project root, run:

```bash
cd services/api
source .venv/bin/activate
```

### 2. Create a migration file

Run:

```bash
alembic revision -m "create user preferences"
```

Alembic creates a new file in `migrations/versions/`. Its filename has a unique ID. Keep that filename and the generated values of `revision` and `down_revision` unchanged.

### 3. Define the table in the migration

Open the new migration file. Keep its generated `revision` and `down_revision` lines, but replace the bodies of `upgrade()` and `downgrade()` with:

```python
def upgrade() -> None:
    op.create_table(
        "user_preferences",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column(
            "time_zone",
            sa.String(length=64),
            nullable=False,
            server_default=sa.text("'UTC'"),
        ),
        sa.Column("sleep_start", sa.Time(), nullable=True),
        sa.Column("sleep_end", sa.Time(), nullable=True),
        sa.Column(
            "reduced_motion",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.ForeignKeyConstraint(["user_id"], ["auth.users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
    )


def downgrade() -> None:
    op.drop_table("user_preferences")
```

The file must also have these imports near its top:

```python
from alembic import op
import sqlalchemy as sa
```

## Code walkthrough

Read the migration before running it. It is a small program that describes a database change.

| Code | Meaning |
| --- | --- |
| `def upgrade()` | The instructions for moving the database forward to this version. |
| `op.create_table(...)` | Ask Alembic to create one table. `op` means “database operation.” |
| `"user_preferences"` | The name of the table that PostgreSQL will create. |
| `sa.Column(...)` | Define one column: its name, type, and rules. `sa` is the SQLAlchemy library. |
| `sa.Uuid()` | Store a universally unique identifier. Supabase Auth uses UUIDs for user IDs. |
| `nullable=False` | This value is required; PostgreSQL rejects a row that omits it. |
| `server_default=...` | PostgreSQL supplies this value when the application does not. For example, new users begin with `UTC` and reduced motion off. |
| `sa.Time()` | A time of day, such as `23:00`, without an attached date. |
| `sa.DateTime(timezone=True)` | A date and time that includes time-zone information. |
| `sa.ForeignKeyConstraint(...)` | Require `user_id` to point to a real Supabase Auth user. |
| `ondelete="CASCADE"` | If the auth user is deleted, delete that user’s preferences automatically. |
| `sa.PrimaryKeyConstraint("user_id")` | Make one row per user. A second preference row with the same ID is rejected. |
| `def downgrade()` | The reverse of `upgrade()`. It lets developers undo this migration during local development. |

### Predict before running

Answer these questions in your own words before moving to Step 4:

1. Why is `sleep_start` allowed to be empty while `time_zone` is required?
2. Why does `user_id` make a better primary key here than an automatically generated number?
3. What would happen to an existing user’s preferences if that user is deleted from Supabase Auth?

## Independent exercise — add one notification preference

Complete the core table first. Then, before you run `alembic upgrade head`, add a new column yourself below `reduced_motion`:

```python
sa.Column(
    "morning_plan_notifications",
    sa.Boolean(),
    nullable=False,
    server_default=sa.true(),
),
```

Think through the choices:

- Why is a Boolean appropriate?
- Why must it have a default?
- Why does `sa.true()` make sense as a starting value for this specific preference?

After applying the migration, confirm this extra column appears in Supabase. If you complete the exercise, your table has eight columns rather than seven.

## Next lesson preview

Lab 8 will introduce API routes. We will first create a `GET /me/preferences` route that returns one user’s data. The guided build will explain how a request becomes a response, and the independent exercise will add a small related route with its own test.

### 4. Apply the migration

Run:

```bash
alembic upgrade head
```

### 5. Verify the table in Supabase

In Supabase Dashboard, open **Database → Tables** and select `user_preferences`.

Confirm the seven columns exist:

```text
user_id
time_zone
sleep_start
sleep_end
reduced_motion
created_at
updated_at
```

The dashboard may also display system details and constraints separately. The key facts are that `user_id` is the primary key and points to `auth.users`.

### 6. Verify migration history and existing test

Run:

```bash
alembic current
python -m pytest
```

The first command should show the new revision as `(head)`. The second should report `1 passed`.

### 7. Commit and push

From the project root, run:

```bash
cd ../..
git status
```

Confirm `.env` is not listed. Then commit:

```bash
git add docs/labs services/api/migrations
git commit -m "feat(api): add user preferences schema"
git push
```

## Verify

- `user_preferences` appears in Supabase.
- It has the intended columns and a `user_id` primary key.
- `alembic current` identifies the new migration as `(head)`.
- Existing tests pass.

## What you learned

This migration is the source of truth for the table. The table is not just a visual dashboard object: it is a repeatable, reviewable piece of project code with a matching reverse operation (`downgrade`).

## General app-development connection

The same pattern applies to any product preference table:

```text
fitness app: goal, measurement unit, reminder preference
reading app: reading target, theme, notification preference
delivery app: default address, language, contact preference
```

The product statement comes first; the table is its careful translation. A good schema asks what one row means, which values must be true, and what should happen if its owner disappears.

## After this manual example

This lab deliberately shows the migration directly so you can see the database rules in full. The next schema lesson will also introduce a readable SQLAlchemy model file and show how it relates to an Alembic-generated migration. The model is the design; the migration is the documented change; both are professional tools.
