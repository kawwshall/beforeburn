# Lab 42 — Deploy a separate staging environment

## Goal

Create a production-like environment where the team can verify API, database, OAuth, and mobile configuration without touching development or production data.

## Before you start

Complete Labs 4–5 and 41. Have a GitHub repository and separate staging database project. Review hosting and database costs before creating paid resources.

## 1. Draw the environments

Record separate values for local development, staging, and production: API URL, database, Supabase Auth project, OAuth redirect URI, and secret storage. Never reuse a production database for staging. Staging should have synthetic test accounts and calendar data.

## 2. Configure the API host

This course uses Render for the example deployment. In the Render Dashboard choose **New → Web Service**, connect `kawwshall/beforeburn`, select branch `main`, set Root Directory to `services/api`, runtime to Python, build command `pip install -r requirements.txt`, and start command `uvicorn app.main:app --host 0.0.0.0 --port $PORT`. Choose a plan after reviewing current pricing and free-tier limitations. Render requires a public web process to bind to `0.0.0.0` and the provided port. See [Render's FastAPI deployment guide](https://render.com/docs/deploy-fastapi) for current dashboard labels.

Add secrets in the Render environment settings, not Git. Set `DATABASE_URL`, `SUPABASE_URL`, and the server's Supabase key; add Google OAuth and encryption secrets when those features are ready. Never put the database URL, service-role key, Google client secret, or encryption key in mobile environment variables.

Keep runtime settings in the hosting dashboard. For migrations, use a one-off release command or controlled deployment job:

```bash
cd services/api
alembic upgrade head
```

Do not make every web worker independently migrate the database during startup; workers can race.

## 3. Provision and migrate the staging database

Create a separate staging PostgreSQL/Supabase project. Configure its URL as a deployment secret. Before enabling app traffic, run `alembic upgrade head` as a release step. Record the current revision. For rollback, prefer a forward corrective migration; only downgrade when the migration is known to be safe and no new data depends on it.

## 4. Configure mobile staging build

Set `EXPO_PUBLIC_API_URL` and publishable Supabase key to staging values through the build environment. These values are embedded in the app, so they are configuration rather than secrets. Keep Google client secret, database URL, and service-role key server-only. Add the staging callback URI to Google OAuth configuration.

## 5. Verify deployment

Run `/health`, database health check, sign-in, protected `/me`, preference read/write, and calendar consent/cancel. Confirm no development or production credentials are in the staging build. Test rollback instructions in a disposable staging release.

## Exercise

Write a rollback plan for a migration that added a nullable column and a new API response field. State the order of app and database rollback.

## Common mistakes

- Staging uses production credentials: compare every environment variable before deploying.
- Migration starts in each worker: run one controlled release command.
- Mobile calls localhost in a distributed build: use the deployed staging API URL.

## Commit

```bash
git add docs/deployment/staging.md docs/labs/42-staging-deployment.md
git commit -m "docs: document staging deployment"
git push
```
