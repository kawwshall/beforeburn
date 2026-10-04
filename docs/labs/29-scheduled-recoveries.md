# Lab 29 — Schedule recovery intentionally

Create `scheduled_recoveries` with owner FK, catalogue FK, start/end, status, and timestamps. Enforce valid transitions in a service: `suggested → accepted → started → completed`, with cancellation allowed before completion. Test every forbidden transition. Build a suggestion card and confirmation sheet. Exercise: identify why completed → started is invalid. Commit: `feat: schedule recovery sessions`.
