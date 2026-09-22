# Lab 4 — Create the empty Supabase database

## Objective

Create a private Supabase project for beforeburn. It provides an empty hosted PostgreSQL database now and will provide authentication later.

## Prerequisites

- Labs 1–3 completed.
- A Supabase account.
- A password manager or other secure place to store a database password.

## Vocabulary

- **PostgreSQL:** the database software that stores structured application data.
- **Supabase project:** one private hosted environment containing a PostgreSQL database and related services.
- **Database password:** the secret used by trusted backend code to connect to the database.
- **Connection string:** the secret address and credentials used by backend code to reach a database.

## Important safety rules

- Do not put the database password in source code, Git, screenshots, or chat messages.
- Do not paste a full connection string into GitHub or this lab document.
- Do not use the connection string in the mobile app. Only the backend may use it.
- Choose a new, unique database password and store it in a password manager.

## Steps

### 1. Open Supabase

1. Visit <https://supabase.com/dashboard>.
2. Sign in or create an account.
3. Select **New project**.

### 2. Configure the project

Use these development settings:

| Field | Value |
| --- | --- |
| Organization | Your personal organization (or the organization that owns beforeburn) |
| Project name | `beforeburn-dev` |
| Database password | A new, strong, unique password saved in a password manager |
| Region | A region nearest to your expected users; choose an Asia Pacific / India-near region when available |
| Plan / compute size | The free or smallest development option |

### Security options

Use these settings on the **Security** section of the project creation form:

| Option | Setting | Why |
| --- | --- | --- |
| Enable Data API | Leave enabled | Supabase services can use it later; it does not grant access by itself. |
| Automatically expose new tables | Disable / uncheck | New tables must not become reachable through the Data API by accident. |
| Enable automatic RLS | Enable / check | New public tables start protected by Row Level Security until deliberate access policies are added. |

This is a "secure by default" setup: a future table is not publicly exposed and, even if exposed later, access is denied until a specific policy permits it.

Select **Create new project**. Provisioning can take a few minutes.

### 3. Verify the project

Wait until the project dashboard is ready. In the left navigation, open **Database**. You should see an empty PostgreSQL database.

Do not create tables manually in the dashboard. The project will create tables through versioned migration files in a later lab, so the database can be recreated reliably.

### 4. Record non-secret project information

In the project dashboard, note these values in your private project notes or password manager:

- Supabase project name: `beforeburn-dev`
- Project reference ID
- Chosen region
- Database password location (for example, the item name in your password manager; do not write the password itself)

### 5. Do not copy the connection string yet

The **Connect** dialog contains the database connection string. We will copy it into a local `.env` file in the next database-connection lab. It is intentionally not needed in this lab.

## Verify

- The Supabase dashboard displays `beforeburn-dev`.
- The project status is ready/healthy.
- You can open the Database section.
- No database password or connection string exists in this Git repository.

## What you learned

The database is currently an empty, private place for application data. We will not build tables by clicking in the dashboard. Instead, database migration files in the project will describe and reproduce every structural change.

## Concept beyond beforeburn

Supabase is a managed service: it operates PostgreSQL infrastructure while the app team owns the data design, access rules, credentials, and deletion choices. A managed service saves operational work; it does not remove responsibility for privacy or schema quality.

For a marketplace app, the same project might store users, listings, orders, and payments. For a learning app, it might store courses, lessons, attempts, and progress. The cloud project is the empty building; your schema decides its rooms and locks.

## Independent exercise

For an app idea of your own, write a three-row table in your notes:

```text
Data the app needs | Is it sensitive? | Who should access it?
```

This is the first privacy review, before writing a single table.

## Reference

Supabase documents that connection strings are copied from the project’s **Connect** dialog and must have the database password supplied securely: <https://supabase.com/docs/guides/database/connecting-to-postgres>
