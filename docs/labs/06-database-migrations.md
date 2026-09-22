# Lab 6 — Set up database migrations

## Objective

Add Alembic, the database change-history tool, and use it to create a first baseline migration in Supabase.

## Why this matters

We never create beforeburn tables manually in the Supabase dashboard. Instead, each database change becomes a small versioned Python file called a **migration**. A fresh database can replay those files to rebuild the same structure.

## Prerequisites

- Labs 1–5 completed.
- `python -m scripts.check_database` prints `Database connection succeeded.`
- `services/api/.env` contains a working `DATABASE_URL` and is ignored by Git.

## Vocabulary

- **Schema:** the structure of a database: tables, columns, and constraints.
- **Migration:** one version-controlled instruction for changing the schema.
- **Alembic:** the migration tool used with SQLAlchemy.
- **Upgrade:** apply pending migrations to a database.
- **Downgrade:** reverse a migration.
- **Revision:** one numbered migration version.

## Expected result

The repository contains an `alembic.ini` configuration file and a `migrations/` folder. Supabase contains an `alembic_version` table that records the currently applied migration.

## Steps

### 1. Activate the backend environment

From the project root, run:

```bash
cd services/api
source .venv/bin/activate
```

### 2. Add Alembic to dependencies

Open `services/api/requirements.txt`. Add this line and save:

```text
alembic>=1.13,<2.0
```

Install it:

```bash
pip install -r requirements.txt
```

### 3. Create Alembic’s project files

Run this command once from `services/api`:

```bash
alembic init migrations
```

It creates:

```text
services/api/
  alembic.ini
  migrations/
    env.py
    script.py.mako
    versions/
```

### 4. Configure Alembic to read the local secret

Open `services/api/migrations/env.py`. Replace its entire contents with the following code:

```python
import os
from logging.config import fileConfig

from alembic import context
from dotenv import load_dotenv
from sqlalchemy import engine_from_config, pool

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

load_dotenv()

database_url = os.environ.get("DATABASE_URL")

if not database_url:
    raise RuntimeError("DATABASE_URL is missing. Add it to services/api/.env.")

# Alembic reads this value from its config object. Double percent signs protect
# percent-encoded characters that may be present in a database password.
config.set_main_option("sqlalchemy.url", database_url.replace("%", "%%"))

# Models will be added in a later lab. For now, migrations are written manually.
target_metadata = None


def run_migrations_offline() -> None:
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

Do not put the real connection string in `alembic.ini`.

### 5. Create the baseline migration

Run:

```bash
alembic revision -m "baseline schema"
```

Alembic creates a new Python file inside `migrations/versions/`. Its generated name includes a revision ID; do not rename it.

This baseline has empty `upgrade()` and `downgrade()` functions. It records the point from which beforeburn schema changes begin.

### 6. Apply the migration to Supabase

Run:

```bash
alembic upgrade head
```

`head` means “the newest migration.” Alembic connects using the local `.env` secret and marks the baseline revision as applied.

### 7. Verify the migration version

Run:

```bash
alembic current
```

Expected result: it prints the generated revision ID followed by `(head)`.

In Supabase Dashboard, open **Database → Tables**. You should see `alembic_version`. This is Alembic’s tracking table, not a beforeburn feature table.

### 8. Confirm the health test still passes

Run:

```bash
python -m pytest
```

Expected result:

```text
1 passed
```

### 9. Commit and push safe files

From the project root, run:

```bash
cd ../..
git status
```

Confirm `.env` is not listed. Then run:

```bash
git add docs/labs services/api/requirements.txt services/api/alembic.ini services/api/migrations
git commit -m "chore(api): set up Alembic migrations"
git push
```

## Verify

- `alembic current` reports one revision at `(head)`.
- Supabase has an `alembic_version` table.
- `python -m pytest` reports `1 passed`.
- GitHub contains migrations but not `.env`.

## What you learned

A migration is not moving existing user data. It is a saved, ordered instruction for building or changing database structure. From now on, every table and column change will be made through a migration and committed to GitHub.

## Models, migrations, and the real database

These three things are related but different:

```text
Model:      readable code describing what a table should look like
Migration:  versioned instructions for moving from one schema version to another
Database:   the actual tables currently running in Supabase
```

Changing a model file does not change an already-running database. A migration performs that change safely and records its order. In later labs, we will use models as the readable design and let Alembic generate a migration draft where appropriate; a developer still reviews it before applying it.

## Independent exercise

Imagine a production app already has `users(name, email)` and needs an optional `avatar_url`.

Write—in plain English—the `upgrade` and `downgrade` actions. Then answer: why is changing an old, already-applied migration worse than adding a new migration?
