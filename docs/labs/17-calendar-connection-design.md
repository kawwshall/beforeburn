# Lab 17 — Design a secure calendar connection

## Outcome

Design the data boundary before writing Google OAuth code: a connected calendar account belongs to one beforeburn user, its provider token is never returned to the mobile app, and disconnecting removes access.

## Build

1. In `services/api/app/models/`, create `calendar_connection.py` with a UUID primary key, `user_id` FK to `auth.users`, provider name, encrypted refresh-token field, token expiry, and timestamps.
2. Use `ondelete="CASCADE"` on `user_id`: deleting an account removes its connection record.
3. Add `CalendarConnection` to `app/models/__init__.py`, autogenerate an Alembic migration, inspect it, then run `alembic upgrade head`.
4. Create a response schema that exposes only `id`, `provider`, `email`, `connected_at`, and `status`. It must not include tokens.
5. Add a mobile screen explaining why calendar access is requested before any connection button exists.

## Why

OAuth separates **permission to access a third-party account** from beforeburn’s own sign-in. A refresh token is equivalent to an ongoing permission grant. It belongs only on the server, ideally encrypted with a key outside the database.

## Verify

Run `alembic current`, inspect the table in Supabase, and confirm the mobile screen contains no token, client secret, or database URL.

## Exercise

For a book-tracking app, list which data would be safe in a client response and which OAuth data must remain server-only.

## Commit

`git commit -am "feat(api): add calendar connection model"`
