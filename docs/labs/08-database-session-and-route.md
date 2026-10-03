# Lab 8 — Database sessions and a tested API route

## Objective

Give the FastAPI application a reusable PostgreSQL session, then add `GET /health/database`: a route that confirms the API can query the database without exposing any private information.

## Product story

Before the app reads Nysa’s preferences or calendar, it must safely open a database conversation, make one query, and close that conversation. A database health route proves this path independently of a user screen.

## General idea

```text
HTTP request → FastAPI route → short-lived database session → PostgreSQL → JSON response
```

The same pattern works for any application: a recipe app loading recipes, a marketplace loading listings, or a habit tracker loading completions.

## New vocabulary

| Term | Meaning |
| --- | --- |
| Engine | SQLAlchemy’s reusable connection factory for one database. |
| Session | A short-lived workspace for one unit of database work. |
| Dependency injection | FastAPI supplies a route with something it needs, such as a session. |
| `yield` | Provide a value temporarily, then run cleanup after the route completes. |
| Test double | A small fake object used in a test instead of a real external system. |

## Why not open one global connection?

A web API serves multiple requests. Sharing one long-lived connection makes failures and concurrent requests difficult to manage. Instead, create an engine once, then provide a session per request and close it afterward.

## Steps

### 1. Create central configuration

Create `app/config.py`:

```python
import os

from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is missing. Add it to services/api/.env.")
```

### Code walkthrough

- `load_dotenv()` loads local values from `.env` during development.
- `os.environ.get(...)` reads a setting without putting secrets in code.
- The `RuntimeError` fails early with a useful message instead of failing later during a user request.

### 2. Expand the database module

Replace `app/database.py` with:

```python
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import DATABASE_URL


class Base(DeclarativeBase):
    """Parent class for beforeburn's SQLAlchemy models."""


engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_session() -> Generator[Session, None, None]:
    """Provide one database session for one request, then close it."""
    with SessionLocal() as session:
        yield session
```

### Code walkthrough

| Code | Meaning |
| --- | --- |
| `create_engine(...)` | Stores how SQLAlchemy should connect; it does not make every request share one live connection. |
| `pool_pre_ping=True` | Checks a reused connection before giving it to a request. |
| `sessionmaker(...)` | Creates new sessions with consistent settings. |
| `autoflush=False` | Avoids unexpected database writes while a query is still being prepared. |
| `autocommit=False` | Requires future write routes to choose explicitly when to commit data. |
| `with SessionLocal()` | Guarantees the session closes after the route completes, including after an error. |
| `yield session` | Gives the session to FastAPI for the current request. |

### 3. Add a database-health route

In `app/main.py`, add these imports:

```python
from fastapi import Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_session
```

Keep the existing `FastAPI` import. Add this route below `/health`:

```python
@app.get("/health/database")
def database_health_check(
    session: Session = Depends(get_session),
) -> dict[str, str]:
    session.execute(text("SELECT 1"))
    return {"status": "ok", "database": "connected"}
```

### Code walkthrough

- `Depends(get_session)` asks FastAPI to run `get_session` and provide its result as `session`.
- `SELECT 1` does not read app data. It only confirms PostgreSQL accepted a query.
- The JSON response reveals connection status, not table names, user data, or database credentials.

### 4. Test the route without using Supabase

Replace `tests/test_health.py` with:

```python
from fastapi.testclient import TestClient

from app.database import get_session
from app.main import app


class FakeResult:
    def scalar_one(self) -> int:
        return 1


class FakeSession:
    def execute(self, statement: object) -> FakeResult:
        return FakeResult()


client = TestClient(app)


def test_health_check_returns_ok() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_database_health_check_returns_connected() -> None:
    def override_get_session():
        yield FakeSession()

    app.dependency_overrides[get_session] = override_get_session

    try:
        response = client.get("/health/database")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "connected"}
```

### Why use a fake session?

The test checks our API logic and JSON contract without depending on internet access, a live Supabase project, or real private data. The browser check in the next step verifies the separate real-database connection.

### 5. Verify both kinds of correctness

Run the automated tests:

```bash
python -m pytest
```

Expected result:

```text
2 passed
```

Start the API:

```bash
fastapi dev app/main.py
```

Open <http://127.0.0.1:8000/health/database>. Expected JSON:

```json
{"status":"ok","database":"connected"}
```

Stop the API with `Ctrl + C` when finished.

### 6. Independent exercise

Create `GET /health/version` that returns the API version already set in `FastAPI(...)`.

Requirements:

1. The route must be a `GET` request.
2. Write its automated test.
3. It must not access the database.
4. Return JSON shaped like:

```json
{"status":"ok","version":"0.1.0"}
```

Explain why this route should not use `Depends(get_session)`.

### 7. Commit and push

From the project root, run:

```bash
cd ../..
git status
```

Confirm `.env` is not listed. Then commit:

```bash
git add docs/labs services/api/app services/api/tests
git commit -m "feat(api): add database health route"
git push
```

## What you learned

Database access is a controlled resource: configure it once, create a session for each request, close it reliably, and give routes only the dependency they need. Tests can replace expensive or private dependencies with fakes while a local browser check proves the real integration.

