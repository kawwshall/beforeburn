# Lab 9 — Authentication and a protected `/me` route

## Objective

Use Supabase Auth to identify users and protect a FastAPI route. The API will accept a user access token, verify it with Supabase Auth, and return only that authenticated user’s public profile data.

## Product story

Nysa opens beforeburn on her phone. The mobile app signs her in through Supabase Auth and receives an access token. When the app asks the FastAPI backend for `/me`, it sends that token. The backend verifies it before trusting that the request belongs to Nysa.

```text
Mobile app → Authorization: Bearer <access token> → FastAPI → Supabase Auth → verified user → /me response
```

## What this lab does not do

- It does not create a custom `users` table.
- It does not store passwords in beforeburn code or PostgreSQL tables.
- It does not build the mobile sign-in screen yet.

Supabase Auth owns account credentials and the `auth.users` table. Beforeburn will store only its own data, linked by the authenticated user ID.

## Core concepts

| Concept | Meaning |
| --- | --- |
| Authentication | Proving who a caller is. |
| Authorization | Deciding whether an authenticated caller may perform an action. |
| Access token / JWT | Short-lived signed proof of identity sent with a request. |
| Bearer token | A token that grants access to whoever possesses it; keep it private. |
| `Authorization` header | The standard HTTP place to send `Bearer <token>`. |
| Dependency | Reusable FastAPI code that a route requires before it runs. |
| `401 Unauthorized` | The caller did not provide a valid identity. |
| `403 Forbidden` | The caller is identified but lacks permission for an action. |

## Security model

```text
Password        → only Supabase Auth handles it
Access token    → mobile app sends it to FastAPI over HTTPS
Publishable key → identifies the Supabase project; not a user credential
Database URL    → backend-only secret; never enters the mobile app
```

We verify the token with Supabase Auth’s `/auth/v1/user` endpoint. This is a straightforward, correct first implementation that works whether a Supabase project uses legacy shared-secret tokens or newer asymmetric signing keys. Later, when performance requires it, a backend can verify asymmetric JWTs locally using Supabase’s JWKS endpoint.

## Prerequisites

- Labs 1–8 completed.
- The database connection works.
- The Supabase project is active.

## Steps

### 1. Add Supabase configuration values

In the Supabase dashboard, open **Connect** or **Settings → API**. Copy:

- Project URL
- Publishable key (or legacy anon key if the dashboard presents that name)

Add these values to the local `services/api/.env` file:

```text
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-project-publishable-key
```

Add safe placeholders to `services/api/.env.example`:

```text
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-project-publishable-key
```

The publishable key may be used in a mobile app later, but keeping all configuration in one place now makes development clearer. It is **not** a replacement for a user access token.

### 2. Expand application configuration

Replace `app/config.py` with:

```python
import os

from dotenv import load_dotenv

load_dotenv()


def required_setting(name: str) -> str:
    value = os.environ.get(name)

    if not value:
        raise RuntimeError(f"{name} is missing. Add it to services/api/.env.")

    return value


DATABASE_URL = required_setting("DATABASE_URL")
SUPABASE_URL = required_setting("SUPABASE_URL")
SUPABASE_PUBLISHABLE_KEY = required_setting("SUPABASE_PUBLISHABLE_KEY")
```

### Code walkthrough

`required_setting` avoids copying the same error-checking code three times. Configuration fails as the API starts, which is much easier to diagnose than a failure halfway through a user request.

### 3. Create the authentication dependency

Create `app/auth.py`:

```python
from typing import Any

import httpx
from fastapi import HTTPException, status

from app.config import SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL


def get_current_user(authorization: str | None = None) -> dict[str, Any]:
    """Return the Supabase user represented by a valid Bearer token."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header.",
        )

    access_token = authorization.removeprefix("Bearer ")
    response = httpx.get(
        f"{SUPABASE_URL}/auth/v1/user",
        headers={
            "apikey": SUPABASE_PUBLISHABLE_KEY,
            "Authorization": f"Bearer {access_token}",
        },
        timeout=5.0,
    )

    if response.status_code != status.HTTP_200_OK:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token.",
        )

    return response.json()
```

### Code walkthrough

| Code | Meaning |
| --- | --- |
| `authorization` | Receives the incoming HTTP header. |
| `Bearer ` check | Rejects missing or incorrectly formatted credentials before calling Supabase. |
| `httpx.get(...)` | Asks Supabase Auth to validate the token and return its user. |
| `apikey` | Identifies the Supabase project to the Auth endpoint. It does not identify Nysa. |
| `Authorization: Bearer <token>` | Identifies Nysa’s signed-in session. |
| `401` | Do not reveal whether an account exists; simply reject invalid identity proof. |

### 4. Create the protected route

Replace `app/main.py` with:

```python
from typing import Annotated, Any

from fastapi import Depends, FastAPI, Header
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_session

app = FastAPI(
    title="beforeburn API",
    version="0.1.0",
)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/database")
def database_health_check(
    session: Session = Depends(get_session),
) -> dict[str, str]:
    session.execute(text("SELECT 1"))
    return {"status": "ok", "database": "connected"}


def current_user_dependency(
    authorization: Annotated[str | None, Header()] = None,
) -> dict[str, Any]:
    return get_current_user(authorization)


@app.get("/me")
def read_me(
    current_user: Annotated[dict[str, Any], Depends(current_user_dependency)],
) -> dict[str, str | None]:
    return {
        "id": current_user["id"],
        "email": current_user.get("email"),
    }
```

### Why is there a wrapper dependency?

FastAPI’s `Header()` reads a request header. `get_current_user` is deliberately kept as plain Python logic so it can be reused and tested directly. `current_user_dependency` is the small FastAPI-specific adapter.

### 5. Test authentication without real user tokens

Replace `tests/test_health.py` with:

```python
from unittest.mock import Mock, patch

from fastapi.testclient import TestClient

from app.database import get_session
from app.main import app


class FakeSession:
    def execute(self, statement: object) -> None:
        return None


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


@patch("app.auth.httpx.get")
def test_me_returns_the_verified_user(mock_get: Mock) -> None:
    mock_get.return_value.status_code = 200
    mock_get.return_value.json.return_value = {
        "id": "0f5b624e-06a2-4b6b-9e25-520b3f6bc3a4",
        "email": "nysa@example.com",
    }

    response = client.get(
        "/me",
        headers={"Authorization": "Bearer pretend-access-token"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "id": "0f5b624e-06a2-4b6b-9e25-520b3f6bc3a4",
        "email": "nysa@example.com",
    }


def test_me_rejects_missing_token() -> None:
    response = client.get("/me")

    assert response.status_code == 401
    assert response.json() == {
        "detail": "Missing or invalid Authorization header."
    }
```

### Test walkthrough

`@patch("app.auth.httpx.get")` temporarily replaces the real network call with a mock. The test supplies the response that Supabase would send for a valid user. This proves our route logic without making tests depend on network availability or a real account.

The second test proves that a caller without a Bearer token receives `401` before the API makes any external request.

### 6. Verify and commit

Run:

```bash
python -m pytest
```

Expected result:

```text
4 passed
```

Start the API and inspect `/docs`; `/me` should show the optional `authorization` header.

From the project root, confirm `.env` is absent from `git status`, then commit:

```bash
git add docs/labs services/api/.env.example services/api/app services/api/tests
git commit -m "feat(api): add Supabase token verification"
git push
```

## Independent exercise

Add a protected `GET /me/email-domain` route that returns only the part after `@` in the authenticated user’s email.

Requirements:

1. Reuse the existing current-user dependency; do not make a second authentication system.
2. Add a mocked test for the route.
3. Return `400` if the verified user has no email.
4. Explain why the route must not accept an email address as a query parameter.

## What you learned

Authentication answers “who is this request from?” A verified user object is a trusted starting point; authorization is the next question: “may this user read or change this specific record?” Keeping passwords out of the app and verifying access tokens at the backend is the same pattern used across many web and mobile products.

## References

- [Supabase Auth overview](https://supabase.com/docs/guides/auth)
- [Supabase Python: retrieve a user](https://supabase.com/docs/reference/python/auth-getuser)
- [Supabase JWT guidance](https://supabase.com/docs/guides/auth/jwts)

