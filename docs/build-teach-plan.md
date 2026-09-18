# beforeburn — Build and Teach Plan

Status: planning  
Platforms: iOS, Android, web preview  
Method: one concept, one product result, one Git commit per lab

## 1. Product boundary

Build first:

- Account and profile
- Google Calendar connection
- Read-only calendar sync
- Day, week, and month views
- Daily energy check-in
- Explainable workload suggestions
- User-approved recovery blocks
- Cosmic Drift
- Conscious Forest
- Chanting Sky
- 26-minute power nap timer
- Notifications, accessibility, privacy, and deletion

Do not build first:

- Medical diagnosis
- AI-generated advice
- Social features
- Streaks or leaderboards
- Wearable integrations
- Large meditation catalogue
- Automatic calendar changes without confirmation

## 2. Technical architecture

### Mobile

- React Native
- Expo
- TypeScript
- Expo Router
- TanStack Query for server state
- Zustand only if shared client state becomes necessary
- React Hook Form + Zod for forms
- Expo AV/audio APIs for recovery audio
- Reanimated only for the immersive visuals

Expo supports Android, iOS, and web from one codebase. Web is a preview/admin surface; mobile is the primary product.

### Backend

- Python 3
- FastAPI
- Pydantic
- SQLAlchemy
- Alembic migrations
- PostgreSQL
- Pytest
- Ruff
- mypy

FastAPI provides typed request validation, OpenAPI, and interactive API documentation. This makes it suitable for teaching.

### Services

- Supabase: hosted PostgreSQL, authentication, object storage
- Google Calendar API: first calendar integration
- Apple Calendar: device calendar access in the mobile app after Google sync works
- Sentry: error reporting before beta
- GitHub Actions: tests and checks

### Data flow

```text
Expo app
   |
   | HTTPS + access token
   v
FastAPI
   |---- PostgreSQL
   |---- Google Calendar API
   |---- Object storage: audio and visual assets
```

### Repository

```text
beforeburn/
  apps/
    mobile/
  services/
    api/
  packages/
    contracts/
  docs/
    product/
    lessons/
    decisions/
  wireframes/
  ux-case-study/
```

Keep the API and mobile app separate. Share API schemas through generated OpenAPI types, not duplicated handwritten models.

## 3. Teaching format

Every lab:

1. Product question — 5 minutes
2. New concept — 15 minutes
3. Small isolated demo — 10 minutes
4. Guided beforeburn build — 35 minutes
5. Independent change — 15 minutes
6. Test and explain — 10 minutes
7. Git commit and notes — 5 minutes

Required lesson files:

```text
docs/lessons/NN-topic/
  README.md
  starter/
  solution/
  checks.md
```

Every lesson README contains:

- Objective
- Prerequisites
- Vocabulary
- Build steps
- Expected result
- Independent challenge
- Test checklist
- Reflection questions

## 4. Phase 0 — Finish the prototype

### Lab 0.1 — Clickable flow

Concepts:

- Screen
- State
- Navigation
- Happy path

Build:

- Welcome to calendar connection
- Calendar connection to onboarding
- Onboarding to Plan
- Suggested break to recovery
- Recovery to completion
- Profile and settings

Done when:

- Every primary wireframe is reachable.
- Back and cancel actions work.
- No dead-end screen exists.

### Lab 0.2 — Prototype testing

Test with 5–7 students:

- Connect a school calendar.
- Find the busiest day.
- Add a recovery block.
- Start Cosmic Drift.
- Start and cancel the nap timer.
- Disconnect the calendar.

Record:

- Completion
- Time
- Misclicks
- Questions
- Exact user comments

### Lab 0.3 — MVP freeze

Create:

- User stories
- Acceptance criteria
- API list
- Data model
- Out-of-scope list

Gate:

Do not start production code until the primary flow is understandable in the prototype.

## 5. Phase 1 — Backend foundation

### Lab 1 — Python API

Teach:

- Client and server
- HTTP
- JSON
- Status codes
- Type hints

Build:

- FastAPI project
- `GET /health`
- Interactive API docs
- First pytest

Done when:

- The API runs locally.
- The health test passes.

### Lab 2 — Database and migrations

Teach:

- Tables
- Primary keys
- Foreign keys
- Schema migrations
- Development versus test databases

Build initial tables:

- users
- user_preferences
- calendar_connections
- calendars
- events
- check_ins
- recovery_experiences
- scheduled_recoveries

Done when:

- A new database can be created entirely from migrations.
- Tests use a separate database.

### Lab 3 — Authentication

Teach:

- Identity
- Authentication
- Authorization
- Access tokens
- Secret handling

Build:

- Supabase sign-in
- FastAPI token verification
- `GET /me`
- Ownership dependency

Do not build custom password storage.

Done when:

- An unauthenticated request returns 401.
- User A cannot access User B's data.

### Lab 4 — Profiles and preferences

Teach:

- Request validation
- CRUD
- Partial updates
- Error responses

Build:

- `GET /me/preferences`
- `PATCH /me/preferences`
- Sleep window
- Time zone
- Notification preferences
- Reduced-motion preference

## 6. Phase 2 — Calendar system

### Lab 5 — Google OAuth

Teach:

- OAuth authorization code flow
- Scopes
- Access and refresh tokens
- Token encryption

Build:

- `GET /calendar/google/authorize`
- `GET /calendar/google/callback`
- `DELETE /calendar/google`

Rules:

- Request the minimum scope.
- Explain access before redirecting.
- Never log tokens.
- Store encrypted refresh tokens.

### Lab 6 — Calendar selection and sync

Teach:

- External APIs
- Pagination
- Idempotency
- Upsert
- Sync cursor

Build:

- `GET /calendars`
- `PATCH /calendars/{id}`
- `POST /calendars/sync`
- `GET /events?start=&end=`

Done when:

- Repeating sync does not duplicate events.
- Disabled calendars disappear from beforeburn.
- Imported events remain read-only.

### Lab 7 — User-created events

Teach:

- Source of truth
- Validation
- Time zones
- Conflict handling

Build:

- `POST /events`
- `PATCH /events/{id}`
- `DELETE /events/{id}`

Only beforeburn-created events can be edited through these endpoints.

## 7. Phase 3 — Workload and recovery

### Lab 8 — Check-ins

Teach:

- Small data models
- Date uniqueness
- Optional data
- Privacy

Build:

- `POST /check-ins`
- `GET /check-ins/latest`
- `DELETE /check-ins`

Initial fields:

- Energy: 1–5
- Optional sleep hours
- Local date

### Lab 9 — Explainable workload rules

Teach:

- Pure functions
- Weighted rules
- Boundary tests
- Explanation generation

Inputs:

- Scheduled duration
- Event demand
- Consecutive busy periods
- Gaps between events
- Sleep window overlap
- Latest energy check-in

Output:

```json
{
  "level": "high",
  "reason": "Three demanding commitments have no recovery gap.",
  "suggestion": {
    "type": "recovery",
    "start": "2026-09-10T15:15:00+05:30",
    "minutes": 15
  }
}
```

Build:

- `GET /workload/day/{date}`
- `GET /workload/week`

Start with rules. Do not use machine learning.

### Lab 10 — Recovery catalogue

Teach:

- Static catalogue data
- Media metadata
- Versioned content

Build:

- `GET /recovery-experiences`
- Three immersive experiences
- One nap timer

The 26-minute nap is described as inspired by NASA/FAA fatigue research. The study provided a 40-minute rest opportunity; participating pilots slept about 26 minutes. Do not claim that NASA prescribes a universal 26-minute nap.

### Lab 11 — Schedule and complete recovery

Teach:

- State transitions
- Idempotency keys
- Calendar write confirmation

States:

```text
suggested -> accepted -> started -> completed
                    \-> cancelled
```

Build:

- `POST /scheduled-recoveries`
- `PATCH /scheduled-recoveries/{id}/start`
- `PATCH /scheduled-recoveries/{id}/complete`
- `PATCH /scheduled-recoveries/{id}/cancel`

For the nap timer:

- Fixed default: 26 minutes
- Optional 4-minute settle period shown separately
- Local alarm notification
- Soft audio wake-up
- Pause is not required; cancel is required
- Explain that the timer is not medical guidance

## 8. Phase 4 — Backend quality

### Lab 12 — Errors and observability

Teach:

- Structured errors
- Request IDs
- Logs
- Monitoring

Build:

- Consistent error schema
- Request correlation ID
- Sentry integration
- No private calendar text in logs

### Lab 13 — Security and privacy

Teach:

- Least privilege
- Encryption
- Rate limits
- Data retention
- Deletion

Build:

- Token encryption
- Rate limiting on authentication and sync
- Account export
- Calendar disconnect
- Check-in deletion
- Account deletion

### Lab 14 — API deployment

Teach:

- Environment configuration
- CI
- Deployment
- Rollback

Pipeline:

```text
format -> lint -> type-check -> test -> migrate -> deploy -> health check
```

Gate:

- Backend staging URL works.
- API contract is frozen for the first mobile vertical slice.
- OpenAPI types can be generated for the mobile app.

## 9. Phase 5 — Cross-platform mobile app

### Lab 15 — Expo foundation

Teach:

- React components
- Native views
- TypeScript props
- Platform differences

Build:

- Expo app
- Android, iOS, and web preview
- Design tokens
- Plan / Reset / You navigation

Use `design-system/tokens.css` and `design-system/index.html` as the visual reference. Port token values to a typed React Native theme; do not copy prototype CSS into native screens.

### Lab 16 — Authentication and onboarding

Build:

- Welcome
- Sign in/create account
- Calendar permission explanation
- Three onboarding questions

### Lab 17 — Calendar views

Build:

- Day view first
- Week view second
- Month view last
- Loading, empty, error, and offline states

### Lab 18 — Suggestions

Build:

- Workload reason
- Inline recovery suggestion
- Confirmation sheet
- Optimistic update with rollback

### Lab 19 — Immersive recovery

Build:

- Audio loading and playback
- Cosmic, forest, and chanting visuals
- Background/foreground behavior
- Reduce Motion alternative
- Screen-reader controls

### Lab 20 — Nap timer

Build:

- 26-minute countdown
- Optional settle period
- Local notification
- Soft wake sound
- Cancel flow
- Resume after app backgrounding or restart

Use an absolute end timestamp. Do not count seconds only in memory.

### Lab 21 — Profile and privacy

Build:

- Preferences
- Calendar connections
- Notifications
- Data export/deletion
- Sign out

### Lab 22 — Cross-platform quality

Test on:

- Small Android phone
- Current Android phone
- Small iPhone
- Current iPhone
- Tablet layout
- Web preview

Check:

- Time zones
- 12/24-hour clock
- Dynamic text size
- Screen reader
- Reduced motion
- Offline behavior
- Audio interruptions
- Notification permission denial

## 10. Phase 6 — Beta

### Lab 23 — End-to-end tests

Critical flows:

- Sign in
- Connect calendar
- Sync events
- View workload
- Add recovery
- Play recovery
- Complete/cancel nap
- Disconnect calendar
- Delete account

### Lab 24 — Private beta

Use 10–20 users for two weeks.

Measure:

- Onboarding completion
- Calendar connection rate
- Suggestion acceptance
- Recovery start and completion
- Nap start and cancellation
- Crashes
- Permission confusion
- Qualitative trust

Do not measure streaks.

## 11. How to change features safely

Every new idea enters `docs/product/backlog.md` with:

```text
Problem:
User:
Evidence:
Proposed change:
Expected benefit:
New data required:
Privacy/safety impact:
Platforms affected:
Prototype required: yes/no
MVP / later / reject:
```

Change process:

1. Capture the idea.
2. Identify the user problem.
3. Check whether current research supports it.
4. Prototype it before backend work when interaction changes.
5. Write or revise acceptance criteria.
6. Record the architecture decision.
7. Change database and API through migrations/versioned contracts.
8. Add tests.
9. Update the lesson that teaches the feature.
10. Release behind a feature flag when risk is meaningful.

Do not rewrite completed lessons immediately. Add a revision note, then update the lesson after the product decision is stable.

## 12. Project controls

### Backlog columns

```text
Idea -> Research -> Prototype -> Ready -> Building -> Testing -> Done
```

### Definition of ready

- User problem stated
- Acceptance criteria written
- Wireframe/prototype approved when needed
- Privacy and accessibility considered
- Dependencies identified
- Lesson objective written

### Definition of done

- Acceptance criteria pass
- Tests pass
- Android and iOS checked
- Empty, loading, error, and offline states exist
- Accessibility checked
- Documentation updated
- Lesson exercise and solution updated
- Git commit reviewed

### Decision log

Create one short file per meaningful decision:

```text
docs/decisions/0001-expo.md
docs/decisions/0002-fastapi.md
docs/decisions/0003-workload-rules.md
```

Each records:

- Context
- Decision
- Alternatives
- Consequences
- Date

## 13. First implementation order

Build vertical slices, not every backend endpoint before any mobile screen:

1. Prototype sign-off
2. Repository and CI
3. FastAPI health endpoint
4. Database and authentication
5. Mobile sign-in connected to `/me`
6. Google Calendar connection and sync
7. Day view using real events
8. Check-in and workload rule
9. Inline recovery suggestion
10. One complete recovery experience
11. Nap timer
12. Remaining recovery experiences
13. Week/month views
14. Profile, privacy, and deletion
15. Beta hardening

This keeps the backend-first intent while producing testable end-to-end results early.

## 14. References

- Expo universal app tutorial: https://docs.expo.dev/tutorial/introduction/
- FastAPI first steps and OpenAPI docs: https://fastapi.tiangolo.com/tutorial/first-steps/
- SQLAlchemy PostgreSQL documentation: https://docs.sqlalchemy.org/en/20/dialects/postgresql.html
- NASA/FAA nap research: https://ntrs.nasa.gov/api/citations/20020012539/downloads/20020012539.pdf
