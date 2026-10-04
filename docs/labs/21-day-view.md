# Lab 21 — Build the Day view

## Outcome

Show one local calendar day as an accessible timeline using real synced events.

## Build

1. Add `GET /me/events?start=...&end=...`; validate ISO dates, restrict results to owned enabled sources, and order by start time.
2. Calculate day boundaries in the user’s IANA time zone on the server; convert only for display on mobile.
3. Create `app/(tabs)/day.tsx` with date controls, loading, empty, error/retry, and populated states.
4. Make `TimelineEvent` accept an event object rather than fetch data itself.
5. Announce event title, start/end time, and calendar name in each accessibility label.

## Verify

Test events near midnight and an all-day event. The same UTC instant must appear on the correct local day.

## Exercise

Add a 12-hour/24-hour display preference without changing stored timestamps.

## Commit

`git commit -am "feat(mobile): add calendar day view"`
