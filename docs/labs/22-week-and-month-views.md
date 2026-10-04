# Lab 22 — Build Week and Month views

## Outcome

Turn the same event data into two useful planning views rather than duplicating a second calendar system.

## Build

1. Add date-range helpers with tests: `startOfWeek`, `endOfWeek`, `monthGridDays`.
2. Add aggregation fields to the events API only when necessary: event count and busy minutes per local day.
3. Create `week.tsx` with a seven-day horizontal grid and a clear selected day.
4. Create `month.tsx` with a calendar grid; show density indicators and an accessible textual summary, not color alone.
5. Reuse one query hook/client for loading, errors, refresh, and cache invalidation.

## Verify

Test a month starting on Sunday, a leap-year February, and a week crossing a month boundary. Check large text does not hide date labels.

## Exercise

Write a unit test for the first day of the week in the locale you support.

## Commit

`git commit -am "feat(mobile): add week and month planning views"`
