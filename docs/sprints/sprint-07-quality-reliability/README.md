# Sprint 7 — Quality and Reliability

## Sprint outcome

beforeburn is reliable across the supported phone sizes and web preview, fails safely, protects private data in logs, and has automated checks on every GitHub change.

## Labs

| Lab | Backend scope | Frontend scope | Definition of done | Independent exercise |
| ---: | --- | --- | --- | --- |
| 37 | Isolated test database, fixtures, migration tests | None | Tests never depend on personal Supabase dev data | Add fixture for two separate users |
| 38 | Structured errors, request IDs, safe logging, Sentry | Error presentation patterns | Errors are useful without leaking event titles/tokens | Turn a raw error into user-safe copy |
| 39 | API contract checks and rate limits for auth/sync | Offline, retry, loading, empty states | Network failures are recoverable and explained | Design a retry policy |
| 40 | None | Accessibility: dynamic text, labels, focus order, Reduce Motion, audio interruptions | Key flows work with screen reader and large text | Audit one screen manually |
| 41 | CI: format, lint, type-check, test, migration validation | Cross-platform smoke checks | GitHub Actions blocks broken changes | Add a failing test and observe CI locally |

## Quality matrix

Test every major flow on:

```text
small Android · current Android · small iPhone · current iPhone · web preview
```

Check time zones, dynamic type, VoiceOver/TalkBack, notification permission denial, audio interruptions, and offline behavior.

