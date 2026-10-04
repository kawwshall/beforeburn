# Sprint 2 — Account and Preferences

## Sprint outcome

A new or returning user can complete the full mobile account journey: Welcome → account creation/sign-in → onboarding → saved preferences → profile editing. The journey uses real Supabase Auth and beforeburn’s protected API.

## Labs

| Lab | Backend scope | Frontend scope | Definition of done | Independent exercise |
| ---: | --- | --- | --- | --- |
| 11 | None; consume existing API | Expo Router application scaffold | App runs on web and a phone preview | Rename a starter tab safely |
| 12 | None | Typed theme and reusable `Screen` | Tokens match approved design system | Add and reuse a shadow token |
| 13 | None | Welcome, sign-in navigation, auth route group | Welcome journey works with back navigation | Explain `push` vs `replace` |
| 14 | Supabase mobile client configuration; session persistence | Real create-account and sign-in forms | Valid sign-in reaches authenticated state; errors are clear | Add password visibility control accessibly |
| 15 | Preference API connection and authenticated request client | Three-step onboarding: schedule context, sleep window, energy | Values save to `/me/preferences`; loading/error states exist | Add a new optional preference to the UI |
| 16 | Sign out and session restoration | Complete Profile/Preferences screen | Relaunch restores session; sign-out returns to Welcome | Add a confirmation before sign-out |

## Key teaching questions

1. What is local screen state versus server state?
2. Why does the mobile app receive a user token but never a database URL?
3. What should a user see if sign-in fails or the network is unavailable?

## Sprint acceptance checks

- Account creation and sign-in use Supabase Auth, not a custom password table.
- Onboarding survives app restart because preferences are stored through the API.
- All form fields have labels and errors are understandable with a screen reader.
- The UI matches the approved design tokens on web and a phone preview.

