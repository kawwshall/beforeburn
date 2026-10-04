# Sprint 1 — Foundation

## Sprint outcome

The team can run a tested API, connect it safely to PostgreSQL, authenticate a user with Supabase, and read/update only that user’s preferences.

## Labs

| Lab | Outcome | Core concepts | Definition of done | Independent exercise |
| ---: | --- | --- | --- | --- |
| 1 | GitHub-backed project | Git, commits, branches, `.gitignore` | Design work is committed and pushed | Create a feature branch and return to `main` |
| 2 | Tested FastAPI health endpoint | HTTP, JSON, routes, Pytest | `/health` returns 200 and test passes | Add a tested `/about` endpoint |
| 3 | Current Python environment | runtime, dependencies, virtual environments | Python 3.12 environment recreates from requirements | Compare global and virtual Python |
| 4 | Hosted Supabase project | managed services, privacy, environments | Empty private Postgres project is active | List sensitive data for another app idea |
| 5 | Secure database connection | `.env`, secrets, connection strings | Local connection script succeeds; no secrets in Git | Add a non-secret environment label |
| 6 | Migration system | schema history, upgrade/downgrade | Alembic baseline is at `head` | Describe a safe avatar-column migration |
| 6A | Schema masterclass | entities, keys, constraints, relationships, ETL | Learner completes schema exercises | Design a habit-tracker schema |
| 7 | Preference model and schema | ORM models, autogenerate, foreign keys | `user_preferences` migration is applied | Add a notification preference via migration |
| 8 | Database session route | engine, session, dependency injection, fakes | Real and mocked DB health checks pass | Add a tested version health route |
| 9 | Protected `/me` route | AuthN, tokens, 401, Supabase Auth | Missing token fails; valid mocked token succeeds | Add email-domain route without trusting query input |
| 10 | Preferences API | PATCH, Pydantic, ownership, services | `/me/preferences` is protected and tested | Add a new preference end-to-end |

## Sprint acceptance checks

- A request without a Bearer token cannot access private routes.
- A user ID is derived from a verified token, never from client-controlled URL/body input.
- Migrations rebuild the current schema from an empty database.
- `.env` and database credentials never appear in Git history.

