# Lab 2 — Create a FastAPI health-check backend

## Objective

Create a small Python backend with a `GET /health` endpoint, verify it in a browser, test it automatically, and push the result to GitHub.

## Prerequisites

- Lab 1 completed.
- Python 3.9 or newer installed. A current maintained version will be installed before database work.
- The project folder open in VS Code.

## Vocabulary

- **Backend / API:** a program that receives requests from an app and returns data.
- **Endpoint:** one URL exposed by an API, such as `/health`.
- **JSON:** a common text format for data exchanged by apps and APIs.
- **Virtual environment:** an isolated folder of Python packages used only by one project.
- **Test:** code that checks whether another piece of code behaves correctly.

## Expected result

Opening `http://127.0.0.1:8000/health` in a browser returns:

```json
{"status":"ok"}
```

## Steps

### 1. Check Python

Open **Terminal → New Terminal** in VS Code and run:

```bash
python3 --version
```

Continue if it prints Python 3.9 or newer.

### 2. Create the backend folders

From the project root, run:

```bash
mkdir -p services/api/app services/api/tests
cd services/api
```

The API now has a folder for application code (`app`) and automated tests (`tests`).

### 3. Create and activate the virtual environment

Run:

```bash
python3 -m venv .venv
source .venv/bin/activate
```

The terminal should now begin with `(.venv)`. This means Python packages installed next belong only to this backend.

### 4. List the required Python packages

In VS Code Explorer, create `services/api/requirements.txt`. Paste and save:

```text
fastapi[standard]>=0.115,<1.0
pytest>=8,<9
httpx>=0.27,<1.0
```

In the activated terminal, install them:

```bash
pip install -r requirements.txt
```

### 5. Create the application package

Inside `services/api/app`, create an empty file named:

```text
__init__.py
```

The two underscores on each side are required. This file tells Python that `app` is a package that can be imported by tests.

### 6. Create the API

Inside `services/api/app`, create `main.py`. Paste and save:

```python
from fastapi import FastAPI

app = FastAPI(
    title="beforeburn API",
    version="0.1.0",
)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
```

`@app.get("/health")` says: when someone sends a GET request to `/health`, run `health_check` and return its JSON data.

### 7. Create the automated test

Inside `services/api/tests`, create `test_health.py`. Paste and save:

```python
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_check_returns_ok() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

### 8. Run the test

From `services/api`, with `(.venv)` still active, run:

```bash
python -m pytest
```

Expected final line:

```text
1 passed
```

### 9. Run the API locally

Run:

```bash
fastapi dev app/main.py
```

Leave this terminal running. In a browser, open:

- <http://127.0.0.1:8000/health>
- <http://127.0.0.1:8000/docs>

The first address should show the expected JSON. The second address is FastAPI’s automatically created documentation page. Stop the server with `Ctrl + C` when finished.

### 10. Commit and push

Return to the repository root:

```bash
cd ../..
```

Check that `.venv/` is not listed:

```bash
git status
```

Then commit and push:

```bash
git add services/api
git commit -m "feat(api): add FastAPI health endpoint"
git push
```

## Verify

- `python -m pytest` reports `1 passed`.
- `/health` responds with `{ "status": "ok" }`.
- The commit appears on GitHub.

## What you learned

You created a backend that receives an HTTP request and returns JSON. The health check is small, but it proves the basic path that future mobile screens will use: app → API → response.

