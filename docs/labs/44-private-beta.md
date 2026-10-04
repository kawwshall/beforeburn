# Lab 44 — Run a small private beta

## Goal

Let a small, invited group use staging or a beta build and learn where the product helps or confuses people. A beta is a research activity; explain what is collected and make participation voluntary.

## Before you start

Complete Labs 42–43. Have a stable staging build, support contact, consent copy, and tested account deletion/disconnect path.

## 1. Prepare the beta

Write a one-page invite that explains purpose, expected time, known limitations, how to report problems, how to stop participating, and what data is collected. Invite a small group such as 5–10 people first. Do not invite people who may feel pressured by the team.

## 2. Instrument privacy-aware events

Define a small event dictionary such as `onboarding_completed`, `calendar_connected`, `check_in_saved`, and `recovery_completed`. Send only event name, timestamp, app version, and coarse non-identifying properties. Do not send calendar titles, notes, email, OAuth tokens, or precise personal schedules.

Add a consent choice if analytics are not essential to service operation. Keep analytics failures from blocking the app.

Create `apps/mobile/lib/analytics.ts` as a narrow wrapper. This version is safe to run before choosing an analytics vendor:

```ts
type AllowedEvent =
  | 'onboarding_completed'
  | 'calendar_connected'
  | 'check_in_saved'
  | 'recovery_completed';

type AnalyticsClient = { track: (event: AllowedEvent, properties: Record<string, string>) => Promise<void> };
let client: AnalyticsClient | null = null;

export function configureAnalytics(nextClient: AnalyticsClient) {
  client = nextClient;
}

export async function track(event: AllowedEvent) {
  if (!client) return;
  try {
    await client.track(event, {
      appVersion: APP_VERSION,
      platform: Platform.OS,
    });
  } catch {
    // Analytics must never block the user's action.
  }
}
```

The narrow union limits accidental collection. Import or define `APP_VERSION` from the app config and `Platform` from `react-native`. Do not add event title, free-text note, email, exact schedule, or token as event properties. After choosing a provider, adapt it to `AnalyticsClient` and call `configureAnalytics` only after the consent decision.

## 3. Conduct neutral interviews

Ask about what the participant tried, what surprised them, where they hesitated, and what they did next. Avoid leading prompts like “Did you love the helpful suggestion?” Ask for a recent concrete example rather than opinions alone.

## 4. Triage feedback

Record feedback without unnecessary personal details. Categorize as bug, usability, trust/privacy, accessibility, or product fit. Note frequency and severity; one strong privacy concern may outrank several cosmetic requests.

## Exercise

Write five interview questions, then revise any that imply the “correct” answer. Create a sample beta issue with a reproduction path and no private calendar content.

## Common mistakes

- Analytics captures free text: permit only reviewed event names and coarse metadata.
- Questions lead participants: ask what happened in a recent use, not whether they liked a feature.
- Beta has no exit path: tell participants how to stop and remove their test data.

## Commit

```bash
git add docs/beta docs/labs/44-private-beta.md
git commit -m "docs: prepare private beta"
git push
```
