# Sprint 5 — Recovery

## Sprint outcome

Users can understand a recovery suggestion, choose a recovery experience, explicitly approve a calendar block, complete/cancel it, and use the nap timer safely.

## Labs

| Lab | Backend scope | Frontend scope | Definition of done | Independent exercise |
| ---: | --- | --- | --- | --- |
| 28 | Versioned recovery catalogue API | Recovery catalogue cards | Catalogue renders from API with loading/error states | Add a duration badge component |
| 29 | `scheduled_recoveries` schema and state transitions | Suggestion card and confirmation sheet | `suggested → accepted → started → completed/cancelled` is enforced | Identify an invalid transition |
| 30 | Calendar write confirmation and idempotency key | Complete “add recovery to calendar” flow | One accepted action creates at most one block | Add a “Not now” exit path |
| 31 | Recovery completion/cancellation endpoints | Cosmic Drift player: controls, Reduce Motion, accessibility | Player starts, finishes, cancels, and returns to Plan | Create an accessible playback label |
| 32 | Nap state/end-time logic; local notification support | 26-minute nap timer, settle period, wake/cancel behavior | Timer survives backgrounding/restart from absolute end time | Add an optional 4-minute settle toggle |

## State machine

```text
suggested → accepted → started → completed
                 └──→ cancelled
```

The API, not only the button UI, validates allowed transitions.

## Safety guardrails

- A user must approve calendar writes; beforeburn never silently changes their schedule.
- The nap timer is not medical guidance.
- Reduced Motion and screen-reader alternatives are part of the feature, not post-launch decoration.

