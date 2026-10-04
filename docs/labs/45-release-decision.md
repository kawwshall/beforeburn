# Lab 45 — Decide whether the app is ready to release

## Goal

Make a release decision based on evidence and user trust, not simply because the build succeeded.

## Before you start

Complete Labs 42–44. Collect the staging smoke results, beta feedback, known issues, crash/error data, and open privacy/accessibility findings.

## 1. Gather evidence

Review beta feedback, crash-free sessions, sign-in completion, calendar sync success, check-in completion, recovery flow completion, accessibility findings, privacy/security issues, support response time, and known defects. Use small sample sizes honestly; do not claim statistical certainty from a handful of testers.

## 2. Set release gates

Before reviewing results, write minimum conditions such as:

- no unresolved critical data leak or account-ownership defect;
- account deletion and disconnect behavior match product copy;
- core journeys pass on supported devices;
- crash and error rates are understood;
- release notes and support path are ready;
- rollback or disable plan exists for risky integrations.

## 3. Write the decision memo

Create `docs/release/decision.md`:

```markdown
# Release decision

Date:
Decision: Ship / Fix first / Defer
Evidence reviewed:
Known issues accepted:
Required fixes and owners:
Rollback/disable plan:
Next review date:
```

For each accepted issue, name the impact and why it is acceptable. “We ran out of time” is not a risk assessment.

Use this example decision record as the minimum evidence format:

```markdown
| Gate | Evidence | Result | Owner/action |
| --- | --- | --- | --- |
| Account ownership | API tests for two users | Pass | None |
| Calendar disconnect | Staging smoke test | Pass | None |
| Large text | iOS test at largest size | Fail | Fix clipped Save button |
| Crash rate | Beta dashboard, 8 testers | Inconclusive | Monitor during staged rollout |
```

“Inconclusive” is a valid result. It tells the team the sample was too small to support a strong claim.

## 4. Choose and communicate

If shipping, stage rollout gradually, monitor errors, and keep the rollback path available. If fixing or deferring, turn each blocker into a tracked issue with owner and acceptance criteria. Tell beta participants what happens to their test data.

## Independent exercise

Create a hypothetical release with one accessibility blocker and a moderate crash issue. Decide ship/fix/defer and explain the evidence and tradeoff in one page.

## Common mistakes

- A successful build is treated as release evidence: review user-facing flows and risk gates.
- Small beta sample is described as statistically conclusive: report uncertainty honestly.
- Known issue has no owner or next step: assign an action or explicitly accept its impact.

## Commit

```bash
git add docs/release docs/labs/45-release-decision.md
git commit -m "docs: record release decision process"
git push
```
