# Lab 18 — Connect and disconnect Google Calendar

## Outcome

Implement the OAuth handoff: mobile opens a server authorization URL, Google returns to the API callback, the API stores the server-only token, and mobile shows success or cancellation.

## Build

1. Add Google client ID, client secret, redirect URL, and token-encryption key to `services/api/.env`; add names only to `.env.example`.
2. Create `GET /me/calendar-connections/google/authorize`. Authenticate the beforeburn user, generate a random one-time `state`, save it server-side with expiry, and return the authorization URL.
3. Request only read-only calendar scope initially. Least privilege means requesting the smallest permission needed now.
4. Create the Google callback. Verify `state` before exchanging `code` for tokens; upsert the connection; redirect to a mobile deep link indicating success or failure.
5. Create `DELETE /me/calendar-connections/{id}`. Delete encrypted credentials and the connection record.
6. In mobile, use `expo-web-browser` to open the URL and handle success, cancel, and denial states.

## Test

Unit-test missing/expired/mismatched state, not just the happy path. Never log `code`, access token, refresh token, or calendar event titles.

## Exercise

Add a visible “Cancel connection” state. Explain why cancellation is not an error.

## Commit

`git commit -am "feat: add Google Calendar connection flow"`
