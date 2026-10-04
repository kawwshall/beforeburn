# Sprint 4 — Energy Intelligence

## Sprint outcome

Users can record a low-friction daily energy check-in and receive a transparent workload explanation based on their own schedule and preferences.

## Labs

| Lab | Backend scope | Frontend scope | Definition of done | Independent exercise |
| ---: | --- | --- | --- | --- |
| 24 | `check_ins` schema; one per user/local date | Daily 1–5 energy check-in | Create/update/delete respects ownership | Add optional sleep-hours field |
| 25 | Pure workload-rule functions and boundary tests | No UI yet; inspect API response in docs | Rule output includes level, reason, suggestion | Write a rule for consecutive busy periods |
| 26 | Day/week workload endpoints | Busy-day explanation card in Day/Week view | Reason is specific and not medical advice | Reword explanation for clarity |
| 27 | Latest-check-in query and optimistic mutation behavior | Full check-in lifecycle: prompt, save, edit, offline/error UI | User can understand and change their check-in | Add a “skip today” path |

## Guardrail

This feature supports planning and recovery. It does not diagnose burnout, sleep disorders, or medical conditions. Rules must be explainable; do not add machine learning in this MVP.

