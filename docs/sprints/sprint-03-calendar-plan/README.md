# Sprint 3 — Calendar and Plan

## Sprint outcome

A signed-in user can connect Google Calendar, choose calendars, synchronize read-only events, and understand their real day, week, and month through beforeburn’s Plan interface.

## Labs

| Lab | Backend scope | Frontend scope | Definition of done | Independent exercise |
| ---: | --- | --- | --- | --- |
| 17 | Calendar connection schema; encrypted token storage design | Calendar-permission explanation screen | No token is logged or returned to mobile | Explain least-privilege scope |
| 18 | Google OAuth authorize/callback/disconnect endpoints | Browser handoff, return state, connect/error UI | User connects/disconnects account safely | Add a cancellation state |
| 19 | Calendar list, enabled flag, write-target validation | Calendar-selection screen | Selected calendars persist and are accessible | Add selected-count feedback |
| 20 | ETL sync: pagination, upsert, source IDs, sync cursor | Sync status and retry UI | Repeated sync creates no duplicate events | Sketch a book-API ETL pipeline |
| 21 | Events query API; time-zone boundaries | Complete Day view: timeline, empty/loading/error states | Real selected events appear correctly | Add 12/24-hour display preference |
| 22 | Week/month aggregation endpoints | Complete Week and Month views | Each view handles busy, empty, and error states | Add a tested date-range helper |
| 23 | Event ownership and user-created recovery-event rules | Plan navigation, refresh, disconnect behavior | Calendar area works end-to-end on phone and web | Explain source-of-truth rules |

## Core data model

```text
user → calendar_connections → calendars → events
```

Imported events retain an external provider ID and a source field. Sync is idempotent: the same source event updates one record rather than creating copies.

## Sprint acceptance checks

- OAuth scopes are minimal and clearly explained.
- Disabled calendars disappear from all Plan views.
- Import never gives the user an accidental ability to edit Google-owned events.
- Time-zone tests cover day boundaries and daylight-saving behavior where applicable.

