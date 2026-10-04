# Lab 37 — Make tests independent of personal development data

## Goal

Run tests against a dedicated disposable database with deterministic fixtures. A test must never depend on the developer's personal Supabase rows or mutate them.

## Before you start

Complete Labs 8–10 and have PostgreSQL available locally or as a dedicated test project. Do not point tests at the development project containing personal data.

## 1. Add test configuration

Add `TEST_DATABASE_URL` to local environment and `.env.example` as an empty placeholder. Use a separate local PostgreSQL database or isolated test Supabase project. Fail fast if the test URL equals the development URL.

In `tests/conftest.py`, create a session-scoped SQLAlchemy engine from `TEST_DATABASE_URL`, run Alembic migrations once, and make a connection/transaction fixture for each test. Roll back each test transaction during teardown. Do not run migrations against the normal project as part of pytest.

Start with a guard in `conftest.py`:

```python
import os
import pytest


@pytest.fixture(scope="session")
def test_database_url() -> str:
    value = os.environ.get("TEST_DATABASE_URL")
    if not value:
        pytest.fail("Set TEST_DATABASE_URL to a dedicated disposable database.")
    if value == os.environ.get("DATABASE_URL"):
        pytest.fail("Refusing to run tests against the development database.")
    return value
```

This is a first safety net, not complete URL validation. Also refuse known production hostnames, and never print the full URL because it contains credentials.

## 2. Create reusable fixtures

Add fixtures for two distinct UUID users, a test DB session, an authenticated FastAPI client, and common preference/calendar rows. Use factories or helper functions so each test controls the data it needs. Avoid fixtures that silently create a large hidden graph.

## 3. Test ownership and migrations

Write tests proving user A cannot read or mutate user B's preferences, events, export, or calendar connection. Add a migration smoke test that creates an empty database, upgrades to head, and checks expected tables/constraints exist.

## 4. Run safely

```bash
python -m pytest
```

Add a guard to the test configuration that prints which database host is in use (never credentials) and refuses known production URLs. Test the guard with deliberately identical URLs in a local isolated config.

## Exercise

Add a fixture with two users and one calendar connection each. Write a test that would fail if an ownership filter were removed.

## Common mistakes

- Tests pass only on one laptop: use migrations and fixtures to create their own data.
- Tests mutate development database: require `TEST_DATABASE_URL` and fail on a mismatch.
- Shared test rows leak between cases: rollback transactions or use explicit cleanup.

## Commit

```bash
git add services/api/tests services/api/app/config.py docs/labs/37-test-isolation.md
git commit -m "test: isolate API database tests"
git push
```
