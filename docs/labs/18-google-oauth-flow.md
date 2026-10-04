# Lab 18 — Connect Google Calendar with OAuth

## What you will build

The user taps Connect, the app opens Google's consent page, and Google returns an authorization code to the API. The API exchanges the code, encrypts the refresh token, and stores it against the authenticated beforeburn user. Mobile receives only a success/cancel result.

OAuth is a permission handoff; the app never asks for the user's Google password.

## Before you start

- Lab 17's model and safe response shape exist.
- You can sign into the mobile app and call protected API routes.
- You have access to a Google Cloud project. Keep credentials private.

## 1. Configure local values

In Google Cloud Console, create an OAuth client for a web server. For local API testing on the same computer, add this exact loopback redirect URI:

```text
http://127.0.0.1:8000/me/calendar-connections/google/callback
```

When the OAuth browser runs on a physical phone, `127.0.0.1` refers to the phone itself. Use a deployed HTTPS staging callback or a temporary HTTPS tunnel to your development API. Configure that exact URI in Google Cloud and set the same value in the API environment. Google's local redirect exception applies to localhost loopback; deployed callbacks require HTTPS.

Add variable names to `services/api/.env.example`:

```dotenv
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
TOKEN_ENCRYPTION_KEY=
MOBILE_RETURN_URL=beforeburn://calendar-result
```

Store real values only in ignored `services/api/.env`. Confirm with `git check-ignore services/api/.env`. The encryption key must be generated, backed up securely, and supplied by a secret manager in deployment. Never put it in the mobile bundle.

## 2. Add typed settings and token encryption

Extend `app/config.py` with the five settings. Fail clearly if a required setting is absent when OAuth is used. Add `app/services/token_crypto.py` with encrypt/decrypt helpers using a vetted authenticated-encryption library and key format; do not invent a cipher. Add a round-trip test and a wrong-key failure test. Keep crypto calls behind this module so storage code cannot accidentally store plaintext.

For a first local exercise, Python's Fernet provides authenticated symmetric encryption. Install it in the API virtual environment and add the dependency to `requirements.txt`:

```bash
python -m pip install cryptography
python -m pip freeze | rg '^cryptography=='
```

Generate a key once and store it only in the API `.env` or a secret manager:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Example `app/services/token_crypto.py`:

```python
from cryptography.fernet import Fernet
from app.config import TOKEN_ENCRYPTION_KEY


def encrypt_token(token: str) -> str:
    key = TOKEN_ENCRYPTION_KEY.encode()
    return Fernet(key).encrypt(token.encode()).decode()


def decrypt_token(ciphertext: str) -> str:
    key = TOKEN_ENCRYPTION_KEY.encode()
    return Fernet(key).decrypt(ciphertext.encode()).decode()
```

This simple format needs a key-rotation plan before production. Losing the key makes stored tokens unreadable; storing it beside the database defeats the purpose.

Add these optional constants to `app/config.py`. OAuth is an optional feature during earlier lessons, so missing Google values must not prevent `/health` or the rest of the API from starting:

```python
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.environ.get("GOOGLE_REDIRECT_URI", "")
TOKEN_ENCRYPTION_KEY = os.environ.get("TOKEN_ENCRYPTION_KEY", "")
MOBILE_RETURN_URL = os.environ.get("MOBILE_RETURN_URL", "beforeburn://calendar-result")
```

Keep these optional values blank in `.env.example`; set actual values only in ignored `.env`. Do not make the entire API fail at startup when the optional Google feature is not configured.

## 3. Store one-time OAuth state

Create an `oauth_states` table with a hashed random state, owner UUID, expiry, and consumed timestamp. Use a migration. Generate raw state with:

```python
import hashlib
import secrets

raw_state = secrets.token_urlsafe(32)
state_hash = hashlib.sha256(raw_state.encode()).hexdigest()
```

Store only the hash. State is short-lived and single-use, preventing another site from attaching a Google account through a forged callback.

Exact model for `app/models/oauth_state.py`:

```python
from datetime import datetime
from uuid import UUID, uuid4
from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class OAuthState(Base):
    __tablename__ = "oauth_states"
    id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), primary_key=True, default=uuid4)
    state_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    scope_mode: Mapped[str] = mapped_column(String(20), nullable=False, default="read")
    user_id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True), ForeignKey("auth.users.id", ondelete="CASCADE"), nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
```

Import `OAuthState` in `app/models/__init__.py` before generating the migration.

From `services/api`, create and apply the migration:

```bash
alembic revision --autogenerate -m "add OAuth state records"
alembic upgrade head
alembic current
```

## 4. Agree on the authorize route contract

The default connection requests read-only permission. A later user-initiated “Add to Google Calendar” feature may request a separate write scope; it must not silently expand permissions. Google documents the available scopes and recommends requesting the narrowest scope required: [Calendar API authorization scopes](https://developers.google.com/workspace/calendar/api/auth).

Before implementation, check Google's current server OAuth requirements for state, code exchange, exact redirect URI matching, and offline access: [Google OAuth 2.0 for web server applications](https://developers.google.com/identity/protocols/oauth2/web-server).

## 5. Copy the API router implementation

Create `app/routes/calendar_oauth.py`:

```python
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from typing import Annotated, Any
from urllib.parse import urlencode
from uuid import UUID
import secrets

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.config import (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI,
                        MOBILE_RETURN_URL)
from app.database import get_session
from app.models.calendar_connection import CalendarConnection
from app.models.oauth_state import OAuthState
from app.services.token_crypto import encrypt_token

router = APIRouter(prefix="/me/calendar-connections/google", tags=["calendar"])


def require_oauth_settings() -> None:
    required = (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI,
                TOKEN_ENCRYPTION_KEY)
    if any(not value or value == "replace-me" for value in required):
        raise HTTPException(status_code=503, detail="Google Calendar is not configured")


def authenticated_user(authorization: Annotated[str | None, Header()] = None) -> dict[str, Any]:
    return get_current_user(authorization)


@router.get("/authorize")
def authorize_google(
    user: Annotated[dict[str, Any], Depends(authenticated_user)],
    session: Session = Depends(get_session),
    write_access: bool = False,
) -> dict[str, str]:
    require_oauth_settings()
    raw_state = secrets.token_urlsafe(32)
    session.add(OAuthState(
        state_hash=sha256(raw_state.encode()).hexdigest(),
        scope_mode="write" if write_access else "read",
        user_id=UUID(user["id"]),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
    ))
    session.commit()
    scopes = (["https://www.googleapis.com/auth/calendar.events",
               "https://www.googleapis.com/auth/calendar.calendarlist.readonly"]
              if write_access else
              ["https://www.googleapis.com/auth/calendar.readonly"])
    query = urlencode({
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(scopes),
        "access_type": "offline",
        "include_granted_scopes": "true",
        "prompt": "consent" if write_access else "select_account",
        "state": raw_state,
    })
    return {"authorization_url": f"https://accounts.google.com/o/oauth2/v2/auth?{query}"}


@router.get("/callback")
def google_callback(
    state: str,
    code: str | None = None,
    error: str | None = None,
    session: Session = Depends(get_session),
) -> RedirectResponse:
    require_oauth_settings()
    if error or not code:
        return RedirectResponse(f"{MOBILE_RETURN_URL}?result=cancelled")
    state_hash = sha256(state.encode()).hexdigest()
    record = session.scalar(
        select(OAuthState).where(OAuthState.state_hash == state_hash).with_for_update()
    )
    now = datetime.now(timezone.utc)
    if record is None or record.consumed_at is not None or record.expires_at <= now:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OAuth state is invalid or expired")
    record.consumed_at = now
    session.commit()

    token_response = httpx.post(
        "https://oauth2.googleapis.com/token",
        data={"code": code, "client_id": GOOGLE_CLIENT_ID,
              "client_secret": GOOGLE_CLIENT_SECRET, "redirect_uri": GOOGLE_REDIRECT_URI,
              "grant_type": "authorization_code"},
        timeout=10.0,
    )
    if token_response.status_code != 200:
        return RedirectResponse(f"{MOBILE_RETURN_URL}?result=failed")
    token_data = token_response.json()
    refresh_token = token_data.get("refresh_token")
    connection = session.scalar(select(CalendarConnection).where(
        CalendarConnection.user_id == record.user_id,
        CalendarConnection.provider == "google",
    ))
    if record.scope_mode == "write" and not refresh_token:
        return RedirectResponse(f"{MOBILE_RETURN_URL}?result=write-consent-failed")
    if not refresh_token and connection is None:
        return RedirectResponse(f"{MOBILE_RETURN_URL}?result=reauthorize")
    if connection is None:
        connection = CalendarConnection(
            user_id=record.user_id,
            provider="google",
            encrypted_refresh_token=encrypt_token(refresh_token),
            scope_mode=record.scope_mode,
        )
        session.add(connection)
    elif refresh_token:
        connection.encrypted_refresh_token = encrypt_token(refresh_token)
        connection.status = "connected"
        connection.scope_mode = record.scope_mode
    else:
        connection.status = "connected"  # preserve the existing encrypted token
    session.commit()
    return RedirectResponse(f"{MOBILE_RETURN_URL}?result=success")
```

The callback's state record binds the Google response to the signed-in beforeburn user. Register the router in `app/main.py` with `app.include_router(calendar_oauth.router)`. This first version intentionally does not fetch the Google account email; add it only after implementing and testing the provider user-info call. Never log `state`, `code`, or `token_data`.

## 6. Handle the callback safely

Google's callback has no beforeburn bearer token; recover the owner from the state record. In order:

1. Hash supplied state and find an unexpired unused record.
2. Mark it consumed transactionally; reject unknown/reused state.
3. Exchange `code` with Google using server-only credentials.
4. Encrypt refresh token before saving it.
5. Upsert one connection for the state owner's account.
6. Redirect to the mobile deep link with only a safe result code.

Never place authorization code or tokens in the redirect URL, logs, or response body. Calendar disconnection is implemented separately in Lab 34.

## 7. Start OAuth from mobile

Install compatible Expo browser/linking dependencies:

```bash
cd apps/mobile
npx expo install expo-web-browser expo-linking
```

Register the `beforeburn` scheme in `apps/mobile/app.json` (merge this property into the existing Expo config; do not replace other values):

```json
{
  "expo": {
    "scheme": "beforeburn"
  }
}
```

After changing the scheme, restart Expo with a clear cache and use a development build when native deep-link behavior requires it.

Create `apps/mobile/components/ConnectGoogleCalendar.tsx`:

```tsx
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { apiFetch } from '../lib/api';

WebBrowser.maybeCompleteAuthSession();

type Props = { onConnected: () => void; writeAccess?: boolean };

export function ConnectGoogleCalendar({ onConnected, writeAccess = false }: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function connect() {
    setBusy(true); setMessage('');
    try {
      const path = writeAccess
        ? '/me/calendar-connections/google/authorize?write_access=true'
        : '/me/calendar-connections/google/authorize';
      const response = await apiFetch(path);
      if (!response.ok) throw new Error('Could not start Google connection.');
      const payload = await response.json() as { authorization_url: string };
      const result = await WebBrowser.openAuthSessionAsync(
        payload.authorization_url,
        'beforeburn://calendar-result',
      );
      if (result.type === 'cancel' || result.type === 'dismiss') {
        setMessage('Connection cancelled. No calendar was added.');
        return;
      }
      if (result.type !== 'success' || !result.url) {
        setMessage('Google connection did not finish. Try again.');
        return;
      }
      const outcome = new URL(result.url).searchParams.get('result');
      if (outcome === 'success') {
        setMessage('Google Calendar connected.');
        onConnected();
      } else if (outcome === 'cancelled') {
        setMessage('Google authorization was cancelled.');
      } else if (outcome === 'write-consent-failed') {
        setMessage('Write permission was not granted. Your read-only connection is unchanged.');
      } else {
        setMessage('Google could not complete the connection. Try again.');
      }
    } catch {
      setMessage('Could not connect right now. Check your connection and retry.');
    } finally {
      setBusy(false);
    }
  }

  return <View>
    <Pressable accessibilityRole="button" disabled={busy} onPress={() => void connect()}>
      {busy ? <ActivityIndicator /> : <Text>Connect Google Calendar</Text>}
    </Pressable>
    {message !== '' && <Text accessibilityLiveRegion="polite">{message}</Text>}
  </View>;
}
```

This opens Google's consent page after the protected authorize route returns its URL, then handles cancellation, success, denial, and network failure. The redirect contains only `result`, never authorization artifacts. Cancellation creates no connection row.

## Verify

Unit-test unknown, expired, reused, and valid OAuth state. Mock Google's token HTTP endpoint. Test token encryption round-trip and verify persisted token is ciphertext. Manually test consent only with a development Google project. No test should depend on a personal production calendar.

## Troubleshooting

- `redirect_uri_mismatch`: compare URI character-for-character in Google config and `.env`.
- Invalid state: ensure DB transaction commits before opening browser and state is consumed once.
- No refresh token on repeat consent: provider behavior may differ after initial consent; test a fresh development account and consult current Google OAuth documentation.
- App does not reopen: verify Expo scheme and callback URL match exactly.

## Independent exercise

Add a cancel control while the consent page is open. Explain why cancelled authorization must not create a connection row.

## Common mistakes

- Local callback works on computer but not phone: the phone's loopback is not your Mac; use staging HTTPS or a tunnel.
- State is reusable: mark it consumed transactionally before token exchange.
- Token appears in callback redirect: redirect only a result code, never authorization artifacts.

## Commit

```bash
git add services/api/app services/api/migrations services/api/tests apps/mobile docs/labs/18-google-oauth-flow.md
git commit -m "feat: add Google Calendar OAuth flow"
git push
```
