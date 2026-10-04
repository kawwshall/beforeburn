# Lab 32 — Build a reliable nap timer

Use an absolute `ends_at` timestamp, not a decrementing counter, so the timer survives backgrounding. Add a 26-minute default, cancel, wake behavior, and optional four-minute settle period. Use local notifications only with explicit permission and calm denial handling. Test clock/background simulation. Exercise: add a duration picker with bounds. Commit: `feat: add nap timer`.
