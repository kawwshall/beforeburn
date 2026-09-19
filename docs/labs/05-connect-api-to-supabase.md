git commit -m "docs: add reproducible labs for setup and health check"
# Lab 5 — Connect the API to Supabase safely

## Objective

Store the Supabase database connection string only on your computer, install the Python database tools, and run a small script that confirms the API project can reach PostgreSQL.

## Prerequisites

- Labs 1–4 completed.
- The `beforeburn-dev` Supabase project status is ready.
- The backend virtual environment uses Python 3.12.
- The Supabase database password is available in a password manager.

## Vocabulary

- **Environment variable:** a configuration value supplied outside source code.
- **`.env` file:** a local file holding environment variables; it must never be committed.
- **SQLAlchemy:** the Python library that connects our API to PostgreSQL.
- **Session pooler:** Supabase’s connection option for common IPv4 local networks and development environments.

## Safety rules

- Never commit `.env`.
- Never paste `DATABASE_URL` into GitHub, a screenshot, or chat.
- The mobile app must never receive this connection string.
- Use the Session pooler connection string in this lab. It is the practical default for local development networks.

## Steps

### 1. Activate the backend environment

From the project root in the VS Code terminal, run:

```bash
cd services/api
source .venv/bin/activate
python --version
```

The final command should show Python 3.12.

### 2. Add database packages

Open `services/api/requirements.txt` in VS Code. Add these lines at the end and save:

```text
SQLAlchemy>=2.0,<3.0
psycopg[binary]>=3.2,<4.0
python-dotenv>=1.0,<2.0
```

Install them:

```bash
pip install -r requirements.txt
```

### 3. Copy the safe development connection format

1. Open the `beforeburn-dev` Supabase project dashboard.
2. Select **Connect** near the top of the dashboard.
3. Select **Session pooler**.
4. Copy the PostgreSQL connection string.
5. Replace `[YOUR-PASSWORD]` with the database password from your password manager.

If your password includes special URL characters such as `@`, `:`, `/`, `?`, `#`, or a space, it must be percent-encoded inside the connection string. Supabase documents this requirement in its connection guide.

### 4. Create the local `.env` file

In `services/api`, create a file named exactly:

```text
.env
```

Add this one line, replacing the example with the completed Session pooler connection string:

```text
DATABASE_URL=postgresql://postgres.PROJECT_REF:YOUR_PASSWORD@POOLER_HOST:5432/postgres
```

Save it. Do not show this file to anyone and do not commit it.

### 5. Create the safe `.env.example` template

In `services/api`, create `.env.example`. Paste and save:

```text
# Copy this file to .env and replace the placeholder locally.
# Never commit a real database connection string.
DATABASE_URL=postgresql://postgres.PROJECT_REF:YOUR_PASSWORD@POOLER_HOST:5432/postgres
```

This template tells a future developer what configuration is required without exposing a secret.

### 6. Create a one-purpose connection check

Create the folders and package marker:

```bash
mkdir -p scripts
touch scripts/__init__.py
```

Create `services/api/scripts/check_database.py`. Paste and save:

```python
import os

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()

database_url = os.environ.get("DATABASE_URL")

if not database_url:
    raise RuntimeError("DATABASE_URL is missing. Add it to services/api/.env.")

engine = create_engine(database_url, pool_pre_ping=True)

with engine.connect() as connection:
    result = connection.execute(text("SELECT 1"))
    assert result.scalar_one() == 1

print("Database connection succeeded.")
```

### 7. Verify the connection

From `services/api`, run:

```bash
python -m scripts.check_database
```

Expected result:

```text
Database connection succeeded.
```

### 8. Confirm no secret will be committed

Run:

```bash
git status
```

You should see `.env.example`, `requirements.txt`, and `scripts/`, but you must **not** see `.env`.

### 9. Run the existing automated test

Run:

```bash
python -m pytest
```

Expected result:

```text
1 passed
```

### 10. Commit and push only safe files

From the project root, run:

```bash
cd ../..
git add docs/labs services/api/requirements.txt services/api/.env.example services/api/scripts
git commit -m "chore(api): add database connection setup"
git push
```

## Verify

- The database check prints `Database connection succeeded.`
- `python -m pytest` reports `1 passed`.
- `.env` does not appear in `git status`.
- GitHub contains `.env.example`, never `.env`.

## What you learned

The connection string is a backend secret, not application code. `.env` supplies it locally, `.env.example` documents the required shape safely, and the one-purpose script proves the backend can reach the empty hosted database.

## Reference

Supabase connection guidance: <https://supabase.com/docs/guides/database/connecting-to-postgres>

