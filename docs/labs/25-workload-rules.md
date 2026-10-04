# Lab 25 — Write explainable workload rules

Put pure functions in `app/services/workload.py`: input event durations and check-in score; output `level`, `reason`, and `suggestion`. Write boundary tests before routes: zero events, exactly threshold, overlapping events, and long consecutive blocks. Keep the language non-medical: “Your day is tightly scheduled” rather than a health claim. Exercise: add a rule for three meetings without a 30-minute gap. Commit: `feat: add explainable workload rules`.
