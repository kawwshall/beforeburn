# Lab 19 — Let users select calendars

## Outcome

Fetch calendar metadata after connection and let a person choose which calendars beforeburn reads.

## Build

1. Create `calendar_sources` with `connection_id`, provider calendar ID, display name, color, `is_enabled`, and a unique constraint on `(connection_id, provider_calendar_id)`.
2. Add a protected API route that fetches the provider calendar list using the server token, upserts source metadata, and returns safe response fields.
3. Add `PATCH /me/calendar-sources/{id}` accepting only `is_enabled`.
4. Build a mobile list using a `Switch`, accessible label “Include {calendar name} in planning,” loading state, retry, and selected-count text.
5. Do not let the client submit an arbitrary `connection_id`; derive ownership from the authenticated user.

## Verify

Toggle a calendar, restart the app, and verify the choice remains. Attempt to PATCH another user’s source in a test: it must return 404 or 403 without revealing data.

## Exercise

Add “Select all” only when it is reversible and announces the changed count accessibly.

## Commit

`git commit -am "feat: add calendar selection"`
