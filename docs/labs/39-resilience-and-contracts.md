# Lab 39 — Handle slow, offline, and rate-limited requests

## Goal

Make the app recover from real networks: requests can time out, lose connectivity, receive 401/429, or reach a temporarily unavailable server.

## Before you start

Complete Labs 15 and 38. The mobile request helper and safe error response format should already exist.

## 1. Document API contracts

For each route, record method, path, auth requirement, request JSON, success response, expected status codes, and whether retry is safe. Keep this in `docs/api-contracts.md`. Mark mutations idempotent only when the server actually enforces it.

## 2. Add client timeouts and error categories

Update `apiFetch` to use `AbortController` with a reasonable timeout. Convert failures into categories: `network`, `timeout`, `unauthorized`, `rate_limited`, and `server`. Avoid retrying 401 automatically; refresh/sign-in flow must handle it. Respect `Retry-After` for 429.

Example timeout wrapper for `apps/mobile/lib/api.ts`:

```ts
export async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 10_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
```

Catch `AbortError` at the API helper boundary and convert it to a typed timeout error. The timer cleanup prevents a completed request leaving a timer behind.

## 3. Add safe retry rules

Retry a read request a small bounded number of times with backoff. For writes, retry only if an idempotency key or idempotent PUT semantics make it safe. Never loop endlessly or retry a user action without showing state.

## 4. Add API rate limits

Apply limits to sign-in-related, OAuth-start, and sync routes using a maintained server-side limiter appropriate to deployment. Key by authenticated user when possible, not only IP. Return 429 and safe retry timing. Do not rate-limit harmless static catalogue reads as aggressively.

## 5. Build offline states

Show a persistent offline indicator when the device has no connectivity. Keep read-only cached data labeled with its last-updated time. Queueing writes is outside this lab; do not imply an offline change was saved.

## Verify and exercise

Simulate timeout, airplane mode, 401, 429 with `Retry-After`, and 500. Confirm GET retry is bounded and a duplicate POST cannot create two recovery blocks. Exercise: write a retry policy table for one new endpoint.

## Common mistakes

- Retrying every write: a timeout does not prove the server did nothing.
- Infinite retries: cap attempts and expose Retry to the person.
- Retrying 401: re-authenticate or refresh session instead of repeating the same invalid request.

## Commit

```bash
git add services/api/app services/api/tests apps/mobile docs/api-contracts.md docs/labs/39-resilience-and-contracts.md
git commit -m "feat: improve network resilience"
git push
```
