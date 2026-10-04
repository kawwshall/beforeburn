# Lab 43 — Test the complete user journeys

## Goal

Verify critical user journeys across mobile, API, database, and external services. Unit tests cover small rules; end-to-end tests catch broken wiring between components.

## Before you start

Complete Labs 37, 41, and 42. Staging should contain only synthetic accounts/data and a known release candidate.

## 1. Select the critical paths

Create a test matrix for:

1. create account/sign in/sign out;
2. save preferences;
3. connect calendar, select source, and sync;
4. view Day/Week/Month;
5. check in energy and view workload explanation;
6. accept a recovery and add it once to calendar;
7. run and cancel a nap timer;
8. disconnect, export, and delete account.

For each, record test data, expected result, and cleanup behavior.

## 2. Use test accounts and provider fakes

Use a dedicated staging/test Auth project and synthetic Google calendar. Mock provider HTTP in deterministic tests. Never use a real user's personal calendar. Use idempotent setup/cleanup so rerunning the suite is safe.

## 3. Add API journey tests

Use FastAPI TestClient/HTTPX and the isolated DB fixture from Lab 37. Exercise routes with realistic sequences and auth tokens. Assert data ownership and resulting DB state, not merely status code.

An API journey test should read like a user story:

```python
def test_user_can_save_and_read_own_preference(client_for_user, test_session):
    response = client_for_user.patch(
        "/me/preferences", json={"time_zone": "Asia/Kolkata"}
    )
    assert response.status_code == 200
    assert response.json()["time_zone"] == "Asia/Kolkata"
```

Use a fixture that creates and authenticates a dedicated test user. Add a second-user assertion so the journey also verifies ownership.

## 4. Add mobile flow checks

Use the UI test framework already selected for the Expo app. Test accessible role/name interactions rather than fragile coordinate taps. Capture key error and empty states. Keep a small smoke suite stable; test all permutations at unit level.

## 5. Run and report

Run CI, then staging smoke tests. Write known gaps in `docs/known-issues.md`. A skipped external-provider test should be clearly reported, never counted as passing.

## Exercise

Choose the most harmful missing flow and justify priority by user impact, likelihood, and difficulty of detection.

## Common mistakes

- A skipped provider test is reported as passed: mark it skipped and explain why.
- Tests depend on tap coordinates: query controls by accessible role/name.
- Assertions only check HTTP 200: verify resulting owner-scoped data and visible product state.

## Commit

```bash
git add services/api/tests apps/mobile docs/known-issues.md docs/labs/43-end-to-end-critical-flows.md
git commit -m "test: cover critical user flows"
git push
```
