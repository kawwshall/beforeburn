# App Development Labs

These are not instructions for building only beforeburn. They are reusable lessons for turning any app idea into a reliable product.

## The learning loop

Every lab follows the same loop:

```text
Problem → concept → small build → inspect → test → explain → change one thing → commit
```

Do not treat a green test as the end. The learner should be able to explain what was built, predict what a small change will do, and make one safe change independently.

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
| 8+ | API routes, authentication, calendar data | Models, validation, ownership, external integrations |

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

