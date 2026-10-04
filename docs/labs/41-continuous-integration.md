# Lab 41 — Run quality checks automatically on GitHub

## Goal

Configure CI to run backend tests and mobile type checks for every pull request. CI gives the team the same reproducible check on every change.

## Before you start

Complete Labs 37–40. Confirm commands pass locally and test configuration does not require production secrets.

## 1. Confirm local commands

From `services/api`, run formatter/linter/type checker if configured plus `python -m pytest`. From `apps/mobile`, run `npx tsc --noEmit`. Make sure each command exits nonzero when intentionally given a failing test/type error.

## 2. Create workflow

Create `.github/workflows/ci.yml`:

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]
jobs:
  api:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: services/api
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: pip install -r requirements.txt
      - run: python -m pytest
  mobile:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: apps/mobile
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: apps/mobile/package-lock.json
      - run: npm ci
      - run: npx tsc --noEmit
```

Action versions should be reviewed and pinned according to the repository's security policy. CI must use test configuration/mocks and must not receive production secrets.

## 3. Run it through a branch

Create a feature branch, add workflow, commit, push, and open a pull request. Observe both jobs. Add a temporary failing test in a separate commit, confirm CI fails, then remove the intentional failure and confirm green.

## 4. Protect the default branch

In GitHub repository settings, require CI checks before merge and require pull requests. This prevents accidental direct changes from bypassing tests.

## Exercise

Add a migration validation job that upgrades a disposable PostgreSQL service to head. Document how the test database is isolated.

## Common mistakes

- Workflow runs from repository root accidentally: set working directories for API/mobile jobs.
- `npm ci` fails: commit the lockfile and keep it in sync with `package.json`.
- CI needs a production secret: mock the external integration or use isolated test credentials.

## Commit

```bash
git add .github/workflows/ci.yml docs/labs/41-continuous-integration.md
git commit -m "ci: validate API and mobile changes"
git push
```
