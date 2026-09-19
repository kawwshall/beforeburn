# Lab 2 — FastAPI health check

## Goal

Create the smallest working beforeburn backend and verify it works automatically.

## Completed work

- Created the backend folder at `services/api/`.
- Created an isolated Python environment in `services/api/.venv/`.
- Installed FastAPI, Pytest, and HTTPX from `requirements.txt`.
- Created `app/main.py`, which defines the backend application.
- Added `GET /health`, which returns `{ "status": "ok" }`.
- Created an automated test in `tests/test_health.py`.
- Added `app/__init__.py` so Python recognizes `app` as a package.
- Ran the test successfully with `python -m pytest`.
- Started the local server and checked `/health` and `/docs` in a browser.
- Committed and pushed the work to GitHub.

## What the backend does now

```text
Browser or future mobile app -> GET /health -> beforeburn backend -> {"status":"ok"}
```

`/health` is a health check: it answers the question, “Is the backend running?” Future endpoints will handle users, calendar events, workload, and recovery plans.

## Important files

```text
services/api/
  app/
    __init__.py       Makes app importable by Python
    main.py           Starts FastAPI and contains /health
  tests/
    test_health.py    Automated check for /health
  requirements.txt    Python packages needed by this backend
```

## Key commands used

```bash
cd services/api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m pytest
fastapi dev app/main.py
```

## Result

The local backend starts successfully. Visiting `http://127.0.0.1:8000/health` returns:

```json
{"status":"ok"}
```

The automated test passed.

## Note for the next lab

This initial environment uses Python 3.9.6, which is no longer maintained. Before adding the database, we will install a current Python version and recreate the local virtual environment.

