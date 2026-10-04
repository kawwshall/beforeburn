# beforeburn — Complete build syllabus

This is the complete teaching and build sequence for beforeburn. It uses **eight sprints** and **45 labs**. Every product area is completed end-to-end—backend, mobile UI, tests, accessibility, and documentation—before moving to the next area.

## How to use this syllabus

- `docs/labs/` is the course. Each lab there is a self-contained hands-on lesson.
- Each phase folder below is only a navigation map: it groups related labs into an end-to-end product slice.
- Do not treat a phase table as teaching material. A learner should always follow the matching lab document in `docs/labs/`.
- Do not skip the acceptance checks just because the UI looks correct.

## Sprint map

| Sprint | Labs | Product outcome |
| --- | ---: | --- |
| [1. Foundation](sprint-01-foundation/README.md) | 1–10 | Secure API, database, migrations, authenticated preferences API |
| [2. Account & Preferences](sprint-02-account-preferences/README.md) | 11–16 | Complete mobile welcome, sign-in, onboarding, and preferences flow |
| [3. Calendar & Plan](sprint-03-calendar-plan/README.md) | 17–23 | Google Calendar connection, sync, and complete Day/Week/Month planning UI |
| [4. Energy Intelligence](sprint-04-energy-intelligence/README.md) | 24–27 | Check-ins and explainable workload suggestions |
| [5. Recovery](sprint-05-recovery/README.md) | 28–32 | Recovery scheduling, experiences, and nap timer |
| [6. Settings & Privacy](sprint-06-settings-privacy/README.md) | 33–36 | Settings, notifications, export, disconnect, and deletion |
| [7. Quality & Reliability](sprint-07-quality-reliability/README.md) | 37–41 | Test depth, accessibility, offline behavior, CI, observability |
| [8. Release & Beta](sprint-08-release-beta/README.md) | 42–45 | Staging deployment, beta, learning loop, release decision |

## Course-wide definition of done

A lab is done only when its product behavior works, tests pass, accessibility and error states are considered, the lesson document is updated, and the change is committed to GitHub.

## Current position

- Labs 1–10: completed foundation.
- Labs 11–12: Expo scaffold and theme completed.
- Lab 13: currently in progress.
- Labs 14–45: lesson documents are present in `docs/labs/`; application implementation proceeds as the learner completes each lesson.
