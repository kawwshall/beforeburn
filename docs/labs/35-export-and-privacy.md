# Lab 35 — Export and remove personal data

## Goal

Give a signed-in user an export of their own data and a way to delete a check-in. This lab teaches owner-scoped queries, privacy boundaries, and honest product copy.

## Before you start

Complete Labs 24 and 29 and the test-user setup from Lab 37. Use two synthetic users to validate the privacy boundary.

## 1. Define what belongs in an export

Include user preferences, check-ins, and beforeburn-created recovery sessions in a versioned JSON document. Exclude password/auth credentials, OAuth tokens, internal logs, other users' data, and provider event content unless the product has a clear user-facing reason and authorization to include it.

## 2. Build an export service

The export is a versioned JSON allowlist. It contains only a user's preferences, check-ins, and scheduled recoveries; it never reads calendar connection secrets or provider event contents. Its top-level shape is:

```json
{
  "export_version": 1,
  "generated_at": "2026-10-04T10:30:00Z",
  "preferences": {},
  "check_ins": [],
  "scheduled_recoveries": []
}
```

Create the complete `services/api/app/services/data_export.py`:

```python
from datetime import datetime, timezone
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.user_preference import UserPreference
from app.models.check_in import CheckIn
from app.models.scheduled_recovery import ScheduledRecovery


def build_user_export(session: Session, user_id: UUID) -> dict:
    preferences = session.scalar(select(UserPreference).where(
        UserPreference.user_id == user_id))
    check_ins = session.scalars(select(CheckIn).where(
        CheckIn.user_id == user_id).order_by(CheckIn.local_date)).all()
    recoveries = session.scalars(select(ScheduledRecovery).where(
        ScheduledRecovery.user_id == user_id).order_by(ScheduledRecovery.starts_at)).all()
    return {
        "export_version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "preferences": None if preferences is None else {
            "time_zone": preferences.time_zone,
            "sleep_start": preferences.sleep_start.isoformat() if preferences.sleep_start else None,
            "sleep_end": preferences.sleep_end.isoformat() if preferences.sleep_end else None,
            "reduced_motion": preferences.reduced_motion,
        },
        "check_ins": [{
            "local_date": row.local_date.isoformat(), "energy_score": row.energy_score,
            "note": row.note, "created_at": row.created_at.isoformat(),
        } for row in check_ins],
        "scheduled_recoveries": [{
            "id": str(row.id), "catalogue_item_id": str(row.catalogue_item_id),
            "starts_at": row.starts_at.isoformat(), "ends_at": row.ends_at.isoformat(),
            "status": row.status,
        } for row in recoveries],
    }
```

The explicit dictionaries are field allowlists. Do not use `model.__dict__` or serialize every ORM field, because new internal columns could become public by accident.

Add this route to `services/api/app/main.py`:

```python
from fastapi import HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy import select
from app.services.data_export import build_user_export


@app.get("/me/export")
def export_my_data(
    current_user: Annotated[dict[str, Any], Depends(current_user_dependency)],
    session: Session = Depends(get_session),
):
    document = build_user_export(session, UUID(current_user["id"]))
    return JSONResponse(
        content=document,
        headers={"Cache-Control": "no-store", "Content-Disposition": 'attachment; filename="beforeburn-data-export.json"'},
    )
```

## 3. Add deletion for an individual check-in

Add this route to `services/api/app/main.py`:

```python
from fastapi import Response
from app.models.check_in import CheckIn


@app.delete("/me/check-ins/{check_in_id}", status_code=204)
def delete_check_in(check_in_id: UUID,
                    current_user: Annotated[dict[str, Any], Depends(current_user_dependency)],
                    session: Session = Depends(get_session)) -> Response:
    row = session.scalar(select(CheckIn).where(
        CheckIn.id == check_in_id,
        CheckIn.user_id == UUID(current_user["id"]),
    ))
    if row is None:
        raise HTTPException(status_code=404, detail="Check-in not found")
    session.delete(row)
    session.commit()
    return Response(status_code=204)
```

## 4. Build mobile Privacy actions

Create `apps/mobile/components/PrivacyActions.tsx`. The native share sheet lets the person choose where to save/send their own export; the app never logs the document:

```tsx
import { useState } from 'react';
import { Alert, Pressable, Share, Text, View } from 'react-native';
import { apiFetch } from '../lib/api';

type Props = { checkInId: string | null; onCheckInDeleted: () => void };

export function PrivacyActions({ checkInId, onCheckInDeleted }: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function exportData() {
    setBusy(true); setMessage('');
    try {
      const response = await apiFetch('/me/export');
      if (!response.ok) throw new Error('Export failed');
      const data = await response.json();
      await Share.share({ title: 'beforeburn data export', message: JSON.stringify(data, null, 2) });
      setMessage('Export ready to share or save.');
    } catch { setMessage('Could not prepare your export. Try again.'); }
    finally { setBusy(false); }
  }

  function confirmDelete() {
    if (!checkInId) return;
    Alert.alert('Delete this check-in?', 'This removes the saved check-in and cannot be undone.',
      [{ text: 'Keep it', style: 'cancel' },
       { text: 'Delete', style: 'destructive', onPress: () => void deleteCheckIn() }]);
  }

  async function deleteCheckIn() {
    if (!checkInId || busy) return;
    setBusy(true); setMessage('');
    try {
      const response = await apiFetch(`/me/check-ins/${encodeURIComponent(checkInId)}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Delete failed');
      onCheckInDeleted(); setMessage('Check-in deleted.');
    } catch { setMessage('Could not confirm deletion. Refresh the check-in before retrying.'); }
    finally { setBusy(false); }
  }

  return <View style={{ gap: 12 }}>
    <Pressable accessibilityRole="button" disabled={busy} onPress={() => void exportData()}>
      <Text>{busy ? 'Working…' : 'Export my data'}</Text>
    </Pressable>
    {checkInId && <Pressable accessibilityRole="button" disabled={busy} onPress={confirmDelete}>
      <Text>Delete this check-in</Text>
    </Pressable>}
    {message !== '' && <Text accessibilityLiveRegion="polite">{message}</Text>}
  </View>;
}
```

## Verify

Create two test users and prove exports do not cross. Test empty export, malformed/large records, safe filename, cache headers, and deleting another user's check-in.

## Exercise

List five fields that must never be written to application logs and explain one risk for each.

## Common mistakes

- Export includes another user's rows: filter every query using the authenticated ID.
- New ORM field silently appears in export: explicitly serialize an allowlist.
- Sensitive export is cached: set no-store headers and avoid analytics/logging of the body.

## Commit

```bash
git add services/api/app services/api/tests apps/mobile docs/labs/35-export-and-privacy.md
git commit -m "feat: add privacy export"
git push
```
