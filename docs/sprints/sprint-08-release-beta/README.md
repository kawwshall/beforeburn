# Sprint 8 — Release and Beta

## Sprint outcome

A staging environment is deployed, critical user journeys are tested end-to-end, a small private beta runs with consented users, and release decisions are based on evidence rather than assumptions.

## Labs

| Lab | Scope | Definition of done | Independent exercise |
| ---: | --- | --- | --- |
| 42 | Staging deployment: API environment, migrations, mobile configuration | Staging API health check and auth work without development credentials | Write rollback steps for one failed migration |
| 43 | End-to-end critical flow tests | Sign in, connect, sync, check-in, suggestion, recovery, nap, disconnect, and deletion are covered | Identify the highest-risk missing flow |
| 44 | Private beta setup and product analytics | 10–20 invited users can test safely; event data is privacy-aware | Draft an interview question that avoids leading users |
| 45 | Beta review and release decision | Metrics, feedback, crashes, trust concerns, and known issues are reviewed | Decide ship, fix, or defer with evidence |

## Beta measures

Measure:

- onboarding completion
- calendar connection rate
- sync failures
- suggestion acceptance
- recovery starts/completions
- nap starts/cancellations
- crashes and permission confusion
- qualitative trust comments

Do not introduce streaks or leaderboards as success measures.

## Release gate

Do not call the app ready merely because all planned screens exist. Release only when critical flows work, privacy promises are true, accessibility has been tested, and beta feedback shows users understand what beforeburn is doing with their calendar and data.

