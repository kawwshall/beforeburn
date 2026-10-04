# Lab 36 — Delete an account and its data

## Goal

Implement a clear, server-coordinated account deletion path that removes application data and Supabase Auth identity without leaving usable provider credentials behind.

## Before you start

Complete Labs 34–35 and use a disposable Auth project with synthetic data. Confirm the server-only admin key is configured locally and never exposed to mobile.

## 1. Map deletion dependencies

Write down the tables that belong to a user and their FK behavior. Personal rows should cascade where deletion is truly intended. Product catalogue rows should not be deleted. Calendar credentials require explicit deletion. This dependency map is the plan for the transaction.

Create `account_deletion_jobs` through an Alembic migration. Store a UUID job ID, `user_id` UUID **without** a cascading FK, client idempotency key, status (`pending`, `processing`, `completed`, `failed`), attempt count, and timestamps. Add a unique constraint on `(user_id, idempotency_key)`. The missing FK is intentional: the retry job must survive deletion of `auth.users`.

Create `services/api/app/models/account_deletion.py`:

```python
from datetime import datetime
from uuid import UUID, uuid4
from sqlalchemy import DateTime, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class AccountDeletionJob(Base):
    __tablename__ = "account_deletion_jobs"
    __table_args__ = (UniqueConstraint("user_id", "idempotency_key",
        name="uq_deletion_user_request_key"),)
    id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), nullable=False, index=True)
    idempotency_key: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
```

Register the model in `app/models/__init__.py`, then run `alembic revision --autogenerate -m "add account deletion jobs"` and `alembic upgrade head`. Inspect that `user_id` has no FK.

## 2. Add the server operation

Create `DELETE /me/account`. Require a valid session and a confirmation token/phrase in the request so an accidental tap cannot delete data. The API uses a server-only Supabase Admin credential from its environment to delete the auth user; it never returns this credential to mobile.

The database and Supabase Auth cannot share one transaction. Use a durable deletion job/outbox. The API marks the account `deletion_pending`, writes a job, revokes/removes provider credentials, and returns `202 Accepted`. A worker then deletes the Supabase Auth user and application rows, retrying failures. Keep the job's user UUID as plain job metadata rather than a cascading FK, so deleting `auth.users` does not erase the retry record.

Create `services/api/app/schemas/account_deletion.py`:

```python
from uuid import UUID
from pydantic import BaseModel


class AccountDeletionRequest(BaseModel):
    confirmation: str
    request_key: UUID


class AccountDeletionAccepted(BaseModel):
    job_id: UUID
    status: str
```

Create `services/api/app/services/account_deletion.py`. The job row is the durable outbox; a repeated request key returns the same job:

```python
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session
from app.models.account_deletion import AccountDeletionJob


def request_account_deletion(session: Session, user_id: UUID,
                             confirmation: str, request_key: UUID) -> UUID:
    if confirmation != "DELETE":
        raise ValueError("Type DELETE to confirm account removal")
    statement = insert(AccountDeletionJob).values(
        user_id=user_id, idempotency_key=request_key, status="pending", attempts=0
    ).on_conflict_do_nothing(
        index_elements=[AccountDeletionJob.user_id, AccountDeletionJob.idempotency_key]
    )
    session.execute(statement)
    session.flush()
    existing = session.scalar(
        select(AccountDeletionJob).where(
            AccountDeletionJob.user_id == user_id,
            AccountDeletionJob.idempotency_key == request_key,
        )
    )
    session.commit()
    return existing.id
```

Create `services/api/app/routes/account_deletion.py`:

```python
from typing import Any
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_session
from app.dependencies import current_user_dependency
from app.schemas.account_deletion import AccountDeletionAccepted, AccountDeletionRequest
from app.services.account_deletion import request_account_deletion

router = APIRouter(prefix="/me/account", tags=["privacy"])


@router.delete("", status_code=status.HTTP_202_ACCEPTED,
               response_model=AccountDeletionAccepted)
def delete_account(payload: AccountDeletionRequest,
    current_user: dict[str, Any] = Depends(current_user_dependency),
    session: Session = Depends(get_session)):
    try:
        job_id = request_account_deletion(session, UUID(current_user["id"]),
            payload.confirmation, payload.request_key)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    return {"job_id": job_id, "status": "pending"}
```

Register the route in `main.py`. Add `SUPABASE_SERVICE_ROLE_KEY=` to `.env.example`, and add the real key only to the API's ignored `.env`/deployment secret. Do not make it a required setting for unrelated routes. The worker must be idempotent; after the API accepts the request, the mobile app clears its local session and tells the user deletion is processing.

Create `services/api/scripts/process_account_deletions.py`:

```python
from datetime import datetime, timedelta, timezone
import os
import httpx
from sqlalchemy import and_, or_, select
from app.config import SUPABASE_URL
from app.database import SessionLocal
from app.models.account_deletion import AccountDeletionJob


def process_one() -> bool:
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not key:
        raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY is missing")
    with SessionLocal() as session:
        stale_before = datetime.now(timezone.utc) - timedelta(minutes=5)
        job = session.scalar(select(AccountDeletionJob)
            .where(or_(AccountDeletionJob.status == "pending",
                and_(AccountDeletionJob.status == "processing",
                     AccountDeletionJob.updated_at < stale_before)))
            .order_by(AccountDeletionJob.created_at)
            .with_for_update(skip_locked=True))
        if job is None:
            return False
        job.status = "processing"
        job.attempts += 1
        session.commit()
        user_id = str(job.user_id)
        job_id = job.id
    try:
        response = httpx.delete(
            f"{SUPABASE_URL}/auth/v1/admin/users/{user_id}",
            headers={"apikey": key, "Authorization": f"Bearer {key}"}, timeout=20.0,
        )
    except httpx.HTTPError:
        with SessionLocal() as session:
            retry_job = session.get(AccountDeletionJob, job_id)
            if retry_job:
                retry_job.status = "pending"
                session.commit()
        raise
    if response.status_code not in (200, 204, 404):
        with SessionLocal() as session:
            retry_job = session.get(AccountDeletionJob, job_id)
            if retry_job:
                retry_job.status = "pending"
                session.commit()
        response.raise_for_status()
    with SessionLocal() as session:
        completed = session.get(AccountDeletionJob, job_id)
        if completed:
            completed.status = "completed"
            session.commit()
    return True


if __name__ == "__main__":
    while process_one():
        pass
```

Run it locally from `services/api` with `python -m scripts.process_account_deletions`. Run it as a protected one-off worker/cron in staging and production; do not expose a public worker endpoint. Supabase deletion cascades user-owned rows and credentials; the deletion job survives because it has no Auth FK. A 404 is treated as success, making retries after an interrupted run safe.

## 3. Build the final confirmation flow

Install `expo-crypto` and AsyncStorage: `cd apps/mobile && npx expo install expo-crypto @react-native-async-storage/async-storage`. In the Profile/Privacy screen, add these imports and handler. It retains one request key after a network failure, so Retry cannot accidentally create a second deletion job:

```tsx
import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { apiFetch } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { router } from 'expo-router';

async function submitAccountDeletion() {
  const storageKey = 'beforeburn.accountDeletion.requestKey';
  const requestKey = await AsyncStorage.getItem(storageKey) ?? Crypto.randomUUID();
  await AsyncStorage.setItem(storageKey, requestKey);
  let response: Response;
  try {
    response = await apiFetch('/me/account', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmation: 'DELETE', request_key: requestKey }),
    });
    if (!response.ok) throw new Error('Request failed');
  } catch {
    Alert.alert('Request not confirmed', 'Your account was not confirmed as deleted. Retry to check using the same request.');
    return;
  }
  await AsyncStorage.removeItem(storageKey);
  await new Promise<void>((resolve) => Alert.alert('Deletion requested',
    'Your account deletion is processing. This may take a short time.',
    [{ text: 'Continue', onPress: resolve }], { cancelable: false }));
  await supabase.auth.signOut();
  router.replace('/welcome');
}

function confirmAccountDeletion() {
  Alert.alert('Delete your account permanently?',
    'This removes your beforeburn account and connected calendar credentials. It cannot be undone.',
    [{ text: 'Cancel', style: 'cancel' },
     { text: 'Delete account', style: 'destructive', onPress: () => void submitAccountDeletion() }]);
}
```

Render a button with `onPress={confirmAccountDeletion}`. This uses a second native destructive confirmation instead of a typed phrase; the API's fixed `DELETE` value is still validated. Place this control separately from Sign out. The job processor script above must be run by a scheduled worker for processing to complete.

## 4. Test failure modes

Test wrong confirmation, expired session, app-data transaction failure, auth-provider failure, repeated request, and ensuring calendar tokens are gone. Use a dedicated test auth project or mocks, never the real account.

Mock `httpx.delete` in the worker test and assert the admin endpoint is called with the job's user UUID. In route tests, override `current_user_dependency` and the test session, then assert the phrase is checked before a job is committed. Add an integration test in a disposable Auth project for the full deletion lifecycle.

## Exercise

Write a short confirmation sentence that explains permanence, data removed, and any data retained for legal/security reasons. Do not promise instant deletion if the system is asynchronous.

## Common mistakes

- Deleting Auth user first erases a cascading job row: keep the deletion job independent of `auth.users`.
- Returning success before background work finishes: return accepted/pending status and explain the state.
- Admin key is shipped to mobile: it belongs only in server environment secrets.

## Commit

```bash
git add services/api/app services/api/tests apps/mobile docs/labs/36-account-deletion.md
git commit -m "feat: add account deletion"
git push
```
