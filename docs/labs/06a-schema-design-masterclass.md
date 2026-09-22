# Masterclass — Designing databases, schemas, and data flows

## Objective

Learn a repeatable way to turn an app idea into a small, reliable database design. Use the same process for beforeburn and future apps.

This lesson comes before creating the first real beforeburn table.

## The central idea

A database is not a pile of information. It is a set of **facts**, connected by explicit rules.

For example, beforeburn needs to know:

```text
A person chooses a time zone.
A person can connect one or more calendars.
A calendar contains events.
A person can record one check-in per local day.
A person can schedule recovery blocks.
```

Those sentences are the start of the database design.

## The vocabulary you need

| Term | Plain-English meaning | Example |
| --- | --- | --- |
| Database | The organized home for application facts | beforeburn’s PostgreSQL database |
| Table | One kind of thing we store | `events` |
| Row | One instance of that thing | one physics-study event |
| Column | One detail stored for every row | `starts_at` |
| Schema | The blueprint of tables, columns, and rules | all beforeburn database structure |
| Primary key | The unique identity of one row | `event.id` |
| Foreign key | A link to a row in another table | `events.calendar_id` |
| Constraint | A rule that blocks invalid data | `energy` must be from 1 to 5 |
| Index | A shortcut that makes common searches faster | events by calendar and start time |
| Migration | A saved, versioned schema change | add `reduced_motion` to preferences |

## Part 1 — Start with user facts, not tables

Do not begin by asking, “What tables should I make?” Start by writing the facts the app must remember.

For a simple library app, write:

```text
A member can borrow many books.
A book can be borrowed many times over its life.
A loan has a checkout date and a due date.
A member cannot have two active loans for the same copy.
```

Underline the nouns:

```text
member, book, copy, loan, checkout date, due date
```

The things with their own identity often become tables. The descriptions usually become columns.

```text
members
books
book_copies
loans
```

### A quick test

Ask: “Could I have two of these that need different details or histories?”

- Two events? Yes. Events need a table.
- Two calendars? Yes. Calendars need a table.
- Two time zones for one preference row? No. Time zone is a column in `user_preferences`.

## Part 2 — Draw relationships before writing code

Use simple arrows. You do not need a diagram tool yet.

```text
user 1 ──── many calendars
calendar 1 ──── many events
user 1 ──── many check-ins
user 1 ──── many scheduled recoveries
```

This is called cardinality:

| Relationship | Meaning | Usual implementation |
| --- | --- | --- |
| One-to-one | One user has one preference row | make `user_id` the primary key of `user_preferences` |
| One-to-many | One calendar has many events | put `calendar_id` on `events` |
| Many-to-many | A recipe uses many ingredients; an ingredient appears in many recipes | create a join table such as `recipe_ingredients` |

### Why foreign keys matter

Without a foreign key, an event could claim it belongs to calendar `999` even if that calendar does not exist. A foreign key prevents this kind of broken link.

## Part 2.5 — The rules that protect relationships

### Primary keys

Every table needs a reliable way to identify one row.

```text
events.id
```

is a common primary key. PostgreSQL guarantees it is unique and not empty. A primary key may also be meaningful instead of generated: `user_preferences.user_id` is the primary key because each user gets exactly one preference row.

### Foreign keys

A foreign key is a rule that connects tables:

```text
events.calendar_id → calendars.id
```

It means an event cannot point to a calendar that does not exist.

### `ON DELETE`: decide what happens to child data

When a parent row is deleted, PostgreSQL needs instructions for linked rows. This is written as `ON DELETE` on a foreign key.

| Option | What happens | Good example |
| --- | --- | --- |
| `CASCADE` | Delete linked child rows too | Delete a user’s preferences when the user account is deleted |
| `RESTRICT` / default behavior | Block deletion while children exist | Do not delete a calendar while its events still need a decision |
| `SET NULL` | Keep the child row but remove the link | Keep an audit record after an optional actor account is removed |

Use `CASCADE` only when the child data truly belongs to the parent and should never survive without it. It is powerful because it can delete many rows at once.

### Other useful constraints

| Rule | Database tool | Example |
| --- | --- | --- |
| No duplicate value | `UNIQUE` constraint | one external event ID per calendar |
| No duplicate pair | composite `UNIQUE` constraint | one check-in per user and local date |
| Value must be in a range | `CHECK` constraint | energy must be between 1 and 5 |
| Value is required | `NOT NULL` | every event needs a start time |

Constraints are better than trusting only the app screen. A user can have an old app version, a retry can happen twice, or another future script can write data. The database is the final guardrail.

## Part 3 — Give every table one job

Each table should describe one kind of thing or one relationship.

Good separation:

```text
calendars:    which calendars a user selected
events:       individual events imported from a calendar
check_ins:    daily energy answers
```

Avoid a "god table" like this:

```text
user_data: user name, calendar names, every event, energy rating,
           recovery history, notification settings, and anything else
```

That design becomes hard to search, update, and trust.

### Normalization, in simple terms

**Normalization** means store each fact once, in the table where it belongs, rather than copying it repeatedly.

For example, do not copy the calendar name into every event row:

```text
Bad:  events(calendar_name, title, starts_at)
Good: calendars(id, name)
      events(calendar_id, title, starts_at)
```

The good version prevents inconsistent names like `School`, `school`, and `School Calendar` for the same calendar. You can retrieve the name later through the relationship.

### A useful question

For each column, ask: “Does this describe the table’s main thing?”

`events.starts_at` describes an event: good.

`events.user_notification_preference` describes a user: it belongs in `user_preferences`, not `events`.

## Part 4 — Pick types and rules deliberately

Use the smallest type that accurately represents the fact.

| Fact | Good type | Why |
| --- | --- | --- |
| Energy rating | small integer plus a check constraint | values must be 1–5 |
| Event start | time-zone-aware date/time | calendar events occur at a specific instant |
| User time zone | short text | values such as `Asia/Kolkata` |
| A yes/no preference | Boolean | avoids unclear strings like `yes`, `Y`, or `maybe` |
| External calendar event ID | text | provider IDs are not necessarily numeric |
| Money | decimal, never floating point | avoids rounding errors |

### Required, optional, and defaults

For every column, decide three things:

1. **Can this fact be unknown?** If yes, allow `NULL`.
2. **Does every new row need a value?** If yes, use `nullable=False`.
3. **Is there a safe common starting value?** If yes, add a database default.

Example:

```text
sleep_start: optional, because a user may skip this onboarding question
time_zone: required, because dates cannot be interpreted reliably without it
reduced_motion: required with default false, because an absent answer should mean normal motion
```

## Part 5 — Design for changes, not guesses

Early schemas should be simple and correct. Do not add columns “just in case.”

Bad early design:

```text
events: event_1_title, event_2_title, event_3_title
```

Good design:

```text
events: one row per event
```

When product needs change, create a migration:

```text
Migration 001: create user_preferences
Migration 002: add morning_plan_notifications
Migration 003: create calendars
```

Never edit an already-applied migration. Once it has reached another database, write a new migration for the next change.

## Part 6 — Privacy and security are schema decisions

Before storing a field, ask:

1. Does the app genuinely need it?
2. Is it sensitive?
3. Who can read it?
4. How long should it be kept?
5. How will it be deleted?

For beforeburn:

| Data | Choice |
| --- | --- |
| Calendar event title | Sensitive; do not log it and limit access to its owner |
| OAuth refresh token | Sensitive secret; encrypt it and never return it to the mobile app |
| Energy check-in | Private user data; delete when the user requests deletion |
| Reduced-motion preference | Needed for accessibility; stored as a normal preference |

The safest field is the field you never collect.

## Part 7 — Index only for real questions

An index speeds up a repeated database question but makes writes slightly more expensive. Add one when you know how the app will look up data.

For beforeburn, this future question is common:

```text
Show selected events for this calendar between Monday and Sunday.
```

That suggests a future index on:

```text
events(calendar_id, starts_at)
```

Do not add indexes merely because a column exists. Start with primary keys, foreign keys, and known high-frequency queries.

## Part 8 — ETL: moving external data safely

**ETL** means Extract, Transform, Load. It is a useful pattern whenever an app imports data from another system.

Beforeburn’s future calendar sync is an ETL pipeline:

```text
Google Calendar
   │
   ├── Extract: request calendar and event data
   │
   ├── Transform: validate fields, convert dates to a consistent form,
   │              label the source, and discard unneeded fields
   │
   └── Load: insert new events or update matching existing events
                in beforeburn’s database
```

### Rules for a reliable ETL pipeline

- Keep the external provider ID so the same event can be matched again.
- Make repeated sync safe: syncing twice must not create duplicates. This is called **idempotency**.
- Store the source (`google`, `apple`, or `beforeburn`) so users cannot accidentally edit imported events as if they were local ones.
- Validate and transform time zones before saving dates.
- Log counts and errors, never private event titles or tokens.
- Record a cursor or last-sync time only after a successful import.

We will build this later, after users and basic calendar connection work.

## A reusable schema-design checklist

Before writing a migration, answer:

```text
1. What user problem requires this data?
2. What facts must persist after the app closes?
3. What is one row in this table?
4. What uniquely identifies that row?
5. Which table owns this fact?
6. What relationships must remain valid?
7. Which values are required, optional, or defaulted?
8. What invalid data must the database reject?
9. Which real app question will need an index?
10. What privacy, deletion, and access rules apply?
11. How will a fresh database recreate this change? (Migration.)
```

## Guided beforeburn example

Start with this product statement:

```text
A signed-in user chooses a time zone, may enter a sleep window,
and may reduce animated visuals.
```

Now design it:

| Design question | Decision |
| --- | --- |
| What is one row? | One user’s preferences |
| Table name | `user_preferences` |
| Identity | `user_id`, supplied by Supabase Auth |
| Relationship | One auth user has one preference row |
| Required fields | `user_id`, `time_zone`, `reduced_motion` |
| Optional fields | `sleep_start`, `sleep_end` |
| Defaults | `UTC`, `false`, and creation timestamps |
| Privacy | Only the owner may view or change these preferences |

That is exactly the thinking behind Lab 7.

## Exercises

### Exercise 1 — Design a habit tracker

Write a schema sketch for an app where people track habits daily.

Answer:

1. What are the tables?
2. What is one row in each table?
3. Which table has a foreign key to the user?
4. How would you prevent two completions for the same habit on the same day?

Suggested answer to check yourself:

```text
habits: one user-defined habit
habit_completions: one completion of one habit on one local date
habit_completions.user_id -> auth.users.id
habit_completions.habit_id -> habits.id
unique(habit_id, local_date) prevents duplicates
```

### Exercise 2 — Improve an unclear table

This table is flawed:

```text
students(id, name, course_1, course_2, course_3, grade_1, grade_2, grade_3)
```

Redesign it using separate tables. Hint: a student can take many courses, and a course has many students.

### Exercise 3 — Plan an ETL import

Choose any public API—for weather, books, films, or sports. Write one sentence for each stage:

```text
Extract:
Transform:
Load:
Idempotency key:
Privacy risk:
```

## What you should remember

Start with facts and relationships. Give every table one job. Let the database enforce important truths. Keep private data minimal. Add schema changes through migrations. Treat external imports as careful, repeatable ETL pipelines.
