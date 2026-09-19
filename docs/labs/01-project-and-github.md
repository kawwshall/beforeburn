# Lab 1 — Project and GitHub setup

## Goal

Save the approved beforeburn design work in a GitHub repository so every future change has a history and backup.

## Completed work

- Opened the `burnout-tracker-nysa` folder in VS Code.
- Added `.gitignore` to keep secrets, installed packages, virtual environments, and machine files out of GitHub.
- Added `README.md` with the project purpose and planned structure.
- Created a private `beforeburn` repository on GitHub.
- Made the first local Git commit.
- Connected the local repository to GitHub and pushed the `main` branch.

## Why it matters

Git saves snapshots of the project. GitHub stores those snapshots remotely. This lets us safely experiment, understand what changed, and recover earlier work if needed.

## Key commands used

```bash
git add .
git status
git commit -m "chore: add approved product design and build plan"
git remote add origin <your-github-repository-url>
git branch -M main
git push -u origin main
```

## Result

The GitHub repository contains the design system, UX case study, wireframes, prototype, build plan, and project setup files.

