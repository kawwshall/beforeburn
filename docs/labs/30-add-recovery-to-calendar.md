# Lab 30 — Add recovery to the calendar once

When accepting a recovery, require an idempotency key. Store it with the scheduled recovery and calendar provider event ID; retrying must return the same result, never create a second event. Show confirmation, failure/retry, and “Not now.” Test two identical requests. Exercise: explain idempotency using a payment example. Commit: `feat: add recovery blocks to calendar`.
