# Lab 1 — Set up the project and GitHub

## Objective

Open an existing project in VS Code, protect private/generated files with `.gitignore`, then save the project in a new private GitHub repository.

## Prerequisites

- VS Code installed.
- A GitHub account.
- Git installed (`git --version` should print a version).
- An existing local project folder.

## Vocabulary

- **Git:** a tool that saves a history of project changes.
- **GitHub:** an online service that stores Git repositories.
- **Repository:** a project folder tracked by Git.
- **Commit:** a named snapshot of changes.
- **Push:** upload local commits to GitHub.
- **`.gitignore`:** a list of files Git must not upload.

## Steps

### 1. Open the project folder

1. Open VS Code.
2. Select **File → Open Folder…**.
3. Select the project folder.
4. Open **Terminal → New Terminal**.

The terminal prompt should end with the project folder name. Confirm Git is available:

```bash
git --version
```

### 2. Create `.gitignore`

In VS Code Explorer, create a file named `.gitignore` in the project root. Paste and save:

```gitignore
# Operating-system files
.DS_Store

# Environment secrets
.env
.env.*
!.env.example

# JavaScript / Expo
node_modules/
.expo/
dist/
web-build/

# Python
.venv/
__pycache__/
.pytest_cache/
.mypy_cache/
.ruff_cache/
*.pyc

# Editor files
.vscode/
```

This prevents secrets and locally installed tools from being committed.

### 3. Create `README.md`

In the project root, create `README.md`. Paste and save:

```md
# beforeburn

A cross-platform app that helps people plan their energy, spot overloaded days, and make room for recovery.

## Project areas

- `design-system/` — visual tokens and design reference
- `ux-case-study/` — product and UX thinking
- `wireframes/` — approved wireframes
- `prototype/` — interactive prototype
- `docs/` — build plan and product documentation

## Planned production structure

- `apps/mobile/` — Expo / React Native app
- `services/api/` — FastAPI backend
- `packages/contracts/` — shared generated API types
```

### 4. Create the first commit

In the VS Code terminal, run:

```bash
git add .
git status
```

Check the displayed files. Do not continue if you see `.env`, `.venv`, `node_modules`, or other private/generated files. Fix `.gitignore` first if needed.

Then create the commit:

```bash
git commit -m "chore: add approved product design and build plan"
```

### 5. Create an empty GitHub repository

1. Visit <https://github.com/new>.
2. Choose an owner.
3. Enter the repository name: `beforeburn`.
4. Select **Private**.
5. Leave **Add a README**, **Add .gitignore**, and **Choose a license** unchecked. The local project already has these files.
6. Select **Create repository**.
7. Copy the repository’s HTTPS URL.

### 6. Connect and push the project

Replace the example URL with the copied GitHub URL:

```bash
git remote add origin https://github.com/YOUR-USERNAME/beforeburn.git
git branch -M main
git push -u origin main
```

Complete any GitHub sign-in request.

## Verify

Refresh the GitHub repository page. The project files and the initial commit should be visible.

## What you learned

Git stores project history locally. GitHub stores a remote copy. `.gitignore` keeps sensitive and machine-specific files out of that history.

