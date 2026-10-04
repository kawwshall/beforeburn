# Lab 38 — Make errors useful and logs safe

## Goal

Give developers enough information to investigate failures while keeping private content and credentials out of logs. Give users messages they can act on.

## Before you start

Complete Labs 8–10 and 37. Use the test client and log-capture fixture so errors can be verified without production monitoring credentials.

## 1. Define the error response

Create `app/schemas/errors.py`:

```python
from pydantic import BaseModel


class ErrorBody(BaseModel):
    code: str
    message: str
    request_id: str
```

Use stable codes such as `NOT_FOUND`, `AUTH_REQUIRED`, and `PROVIDER_UNAVAILABLE`. The message is safe for display; stack traces stay in server logs.

## 2. Add request IDs and exception handling

Create FastAPI middleware that accepts or generates a UUID request ID, stores it in request state, and returns it in a response header. Add exception handlers that map known errors to status/code/message. Unknown failures return a generic 500 with request ID; log the exception with the same ID.

Middleware example for `app/main.py`:

```python
from uuid import uuid4
from fastapi import Request


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or str(uuid4())
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response
```

Do not blindly trust a client-supplied value for logging: validate its length/format or always generate your own ID. This short example shows where middleware fits; production code should validate incoming IDs.

## 3. Redact sensitive fields

Review log calls. Never log authorization headers, passwords, refresh/access tokens, event titles, private notes, or export contents. Prefer structured fields such as route name, status code, elapsed milliseconds, user UUID where policy permits, and request ID. Add a test that captures logs and searches for a fake token string.

## 4. Improve mobile errors

Update `apiFetch` to parse the stable `code` and display a plain message. Show “Please sign in again” for auth expiry, “Calendar is temporarily unavailable” for provider trouble, and a retry action where appropriate. Include request ID in a support detail view, not as the main message.

## Verify

Test known 404, validation, provider outage, and unknown exception responses. Confirm an unknown error doesn't expose stack trace and the request ID appears in both response and safe log.

## Exercise

Convert a raw database exception into a user-safe message and a separate developer log entry. Explain what information appears in each.

## Common mistakes

- Returning exception text to a user: map known cases to safe messages and hide unknown details.
- Logging the whole request: headers/body can contain tokens or private notes.
- Generating a new request ID in each layer: carry the same ID through response and logs.

## Commit

```bash
git add services/api/app services/api/tests apps/mobile docs/labs/38-safe-errors-and-observability.md
git commit -m "feat: add safe error handling"
git push
```
