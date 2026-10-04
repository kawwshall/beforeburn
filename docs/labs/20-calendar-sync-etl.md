# Lab 20 — Sync calendar events without duplicates

## Outcome

Build an ETL pipeline: extract paginated provider events, transform them into beforeburn’s safe event shape, and load them with idempotent upserts.

## Build

1. Create `calendar_events` with `source_id`, provider event ID, title, starts/ends with time zone, all-day flag, updated-at, and unique `(source_id, provider_event_id)`.
2. Make a `CalendarSyncService`; keep HTTP/provider code out of routes.
3. Fetch pages until `nextPageToken` is absent. Transform all-day dates separately from timed date-times.
4. Upsert by provider ID. Store a sync cursor and last successful sync time on the source.
5. Expose `POST /me/calendar-sources/{id}/sync`; return counts, not event bodies in logs.
6. Build mobile sync status: last synced time, Sync now, spinner, error, Retry.

## Why

ETL means Extract, Transform, Load. Idempotency means repeating the same request produces the same final result instead of duplicate events.

## Verify

Sync twice; row count must not double. Change an event in Google, sync again, and confirm one local row updates.

## Commit

`git commit -am "feat: sync calendar events idempotently"`
