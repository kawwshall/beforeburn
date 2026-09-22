# Lab 3 — Upgrade the backend Python environment

## Objective

Install Python 3.12 with Homebrew, recreate the backend’s private Python environment, and prove the existing API test still passes.

## Why this is necessary

The Mac developer tools provided Python 3.9.6. It works for the first health-check exercise but is no longer maintained. The project will use Python 3.12 before adding the database and authentication features.

## Prerequisites

- Labs 1 and 2 completed.
- Homebrew installed (`brew --version` prints a version).
- The project open in VS Code.

## Vocabulary

- **Homebrew:** a Mac package manager that installs developer tools.
- **Interpreter:** the program that runs Python code.
- **Recreate:** delete and rebuild a disposable virtual environment using a new Python interpreter.

## Steps

### 1. Install Python 3.12

In the VS Code terminal, run:

```bash
brew install python@3.12
```

When it finishes, confirm the new interpreter is available:

```bash
python3.12 --version
```

Expected result: a version beginning with `Python 3.12`.

### 2. Move to the API folder and leave the old environment

From the project root, run:

```bash
cd services/api
deactivate
pwd
```

`pwd` must print a path ending in:

```text
burnout-tracker-nysa/services/api
```

### 3. Remove the old, disposable virtual environment

The `.venv` folder contains installed packages only. It does not contain application code, tests, or user data. Confirm it is the environment folder:

```bash
ls .venv/bin/python
```

Then remove only that folder:

```bash
rm -rf .venv
```

### 4. Create a new Python 3.12 virtual environment

Run:

```bash
python3.12 -m venv .venv
source .venv/bin/activate
python --version
```

Expected result: the prompt begins with `(.venv)` and the last command reports Python 3.12.

### 5. Reinstall project packages

Run:

```bash
pip install -r requirements.txt
```

### 6. Configure VS Code to use this environment

1. Press `Cmd + Shift + P`.
2. Choose **Python: Select Interpreter**.
3. Select the interpreter whose path ends in:

```text
services/api/.venv/bin/python
```

This makes the editor use the project’s Python 3.12 environment for code hints, testing, and debugging.

### 7. Verify the API still works

Run the test:

```bash
python -m pytest
```

Expected result:

```text
1 passed
```

Optionally run the server again:

```bash
fastapi dev app/main.py
```

Open <http://127.0.0.1:8000/health> and verify the JSON response. Stop the server with `Ctrl + C`.

### 8. Commit the lesson document

The `.venv` folder is ignored by Git, so only the lesson document needs committing. From the project root:

```bash
cd ../..
git add docs/labs/03-upgrade-python-environment.md
git commit -m "docs: add Python environment lab"
git push
```

## Verify

- `python --version` reports Python 3.12 while `(.venv)` is active.
- `python -m pytest` reports `1 passed`.
- Git does not list `.venv/` as a new file.

## What you learned

The application code is separate from the Python version and installed packages. A virtual environment can be safely rebuilt whenever the interpreter changes, then repopulated from `requirements.txt`.

## Concept beyond beforeburn

Code does not run by itself. It needs a runtime (Python), dependencies (FastAPI and others), and configuration. A virtual environment makes that combination local to one project.

Think of `requirements.txt` as a recipe card. If Omar clones a habit-tracker project next month, he can create a new virtual environment and install the same ingredients without receiving your entire computer.

## Independent exercise

With `(.venv)` active, run:

```bash
which python
python -c "import fastapi; print(fastapi.__version__)"
```

Then run `deactivate` and repeat those commands. Explain which Python each command uses and why project dependencies should not rely on a random global installation.
