# Sprint 6 — Settings and Privacy

## Sprint outcome

Users control their notifications, calendar connections, recovery settings, and personal data. They can export or delete data without support intervention.

## Labs

| Lab | Backend scope | Frontend scope | Definition of done | Independent exercise |
| ---: | --- | --- | --- | --- |
| 33 | Notification-preference schema/API; device permission status | Full notifications settings screen | Denial is handled calmly; no repeated nagging | Design an appropriate reminder frequency |
| 34 | Calendar connection status and disconnect cleanup | Calendar Connections settings UI | Disconnect removes stored token and sync access | Add a reconnect state |
| 35 | Data export job/endpoint; check-in deletion | Privacy and data screen | Export contains only owner data; delete confirmation is clear | List data that must never appear in export logs |
| 36 | Account deletion transaction and auth-user deletion coordination | Final deletion flow and sign-out | Account data disappears according to retention rules | Write user-facing deletion confirmation copy |

## Privacy checklist

Before shipping each setting, answer:

```text
What data is affected?
Who can access it?
How is ownership verified?
Can the user reverse this action?
What is deleted immediately versus later?
What is never logged?
```

## Sprint acceptance checks

- Calendar refresh tokens are encrypted and never returned by an API.
- Data export has no data from another user.
- Account deletion also handles related rows and external connections.
- Every destructive action has explicit confirmation and understandable consequences.

