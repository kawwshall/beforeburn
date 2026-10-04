# Lab 24 — Add daily energy check-ins

Create a `check_ins` table with user FK, local `check_in_date`, score constrained to 1–5, optional note, and unique `(user_id, check_in_date)`. Create protected create/read/update/delete routes that derive user identity from the token. Build a 1–5 accessible rating control and a same-day edit flow.

Test duplicate creation, invalid score, and cross-user access. A check-in is self-reported product data, not medical diagnosis. Exercise: add optional sleep hours with a sensible range constraint. Commit: `feat: add daily energy check-ins`.
