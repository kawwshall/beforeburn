# App Development Labs

These are not instructions for building only beforeburn. They are reusable lessons for turning any app idea into a reliable product.

## The learning loop

Every lab follows the same loop:

```text
Problem → concept → small build → inspect → test → explain → change one thing → commit
```

Do not treat a green test as the end. The learner should be able to explain what was built, predict what a small change will do, and make one safe change independently.

## How to work through the labs

The labs form one ordered build. A later lab may rely on files created earlier, so first confirm its prerequisites and the preceding lab's verification passed. In VS Code, create any missing parent folders when you create a nested file. Run commands from the directory named in the lesson; use a second terminal when a lesson needs API and mobile running at the same time. Replace clearly marked placeholders with your own values, and never paste secrets into source files or commit them.

Each lesson must include the product goal, a plain-language concept explanation, complete copy-ready contents for new core files and exact copy-ready inserts/replacements for existing files, every command in execution order, an explanation of important code, verification, likely failures, a small independent exercise, and a commit step. A learner must not be asked to invent a model, route, service, API contract, or screen needed for the required app. Exercises may ask them to make a bounded variation after the working baseline exists. The phase folders under `docs/sprints/` are navigation aids; this directory contains the course.

## Code completeness rule

Treat prose such as “create a service that does X” as incomplete unless the lesson also supplies the exact service code and imports. For every backend feature, include model/schema, migration instructions, service, route registration, tests, and mobile API/UI states as applicable. For every mobile feature, include imports, component/screen code, loading/error/empty/success states, and the API call. When code depends on a prior lab, name the exact file and exported function it uses. Do not label a lesson finished based on a short brief, pseudocode, or an architectural outline.

## Running example

beforeburn is the running product: it helps people plan energy around busy schedules. Each concept is also connected to a second, simpler example, so it transfers to other ideas such as a habit tracker, book club, delivery app, study planner, or marketplace.

## Curriculum map

| Lab | Build result | General idea that transfers to any app |
| --- | --- | --- |
| 1 | GitHub-backed project | Version control, project boundaries, safe collaboration |
| 2 | A tested `/health` API | Client/server requests, JSON, HTTP status, automated tests |
| 3 | A current isolated Python environment | Runtimes, dependencies, reproducible development |
| 4 | Empty hosted PostgreSQL project | Managed services, cloud environments, data ownership |
| 5 | Secure local database connection | Secrets, environment variables, backend trust boundaries |
| 6 | Versioned migration system | Database history, deployable schema changes |
| 6A | Schema-design masterclass | Entities, relationships, constraints, indexes, ETL |
| 7 | User-preferences schema | Turning a product statement into a table and migration |
| 8–10 | API routes, authentication, and preferences | Models, validation, ownership, and service boundaries |
| 11–13 | Expo foundation, design tokens, and navigation | Mobile app structure and accessible navigation |
| 14–16 | Authentication, onboarding, and account preferences | Sessions, authenticated requests, durable user settings |
| 17–45 | Calendar, energy, recovery, privacy, quality, and release | The remaining end-to-end product curriculum |

## A lesson should always answer

1. **What problem are we solving?**
2. **What concept is new?**
3. **What does each important line of code or command do?**
4. **How do we prove it works?**
5. **What small change can the learner make without copying?**
6. **What would break if we removed a rule or changed an assumption?**

## Before starting a new lab

Use this short planning note:

```text
User problem:
Smallest useful outcome:
Data needed:
Security/privacy concern:
What can fail?
How will we test it?
Independent learner exercise:
```

## What “professional” means here

Professional does not mean using the most tools. It means making choices that another developer can understand, reproduce, test, review, and safely change later.
