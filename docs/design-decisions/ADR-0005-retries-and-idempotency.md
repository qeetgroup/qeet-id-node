# ADR-0005: Retry only what can't happen twice

**Status:** Accepted

## Context

Retrying a request whose first attempt may have reached the server can perform its action twice: two
users, two charges, two webhooks. The API offers an `Idempotency-Key` on nine create calls; with it, a
repeated request gets the first answer instead of acting again (24-hour retention, scoped to the
caller).

## Decision

A request is **retry-safe** when it is a `GET` or `DELETE`, a POST that changes nothing (checks,
evaluations, previews, introspection, revocation; marked `retrySafe`), or it carries an
`Idempotency-Key`. Only retry-safe requests are retried, and only after no response, a timeout, `408`,
`429`, `500`, `502`, `503`, `504`, or `409 idempotency.in_progress`.

- `PUT`, `PATCH` and other POSTs are never retried, nor are OAuth grants (single-use) and directory
  sign-ins (each attempt counts toward the lockout).
- `401 auth.session_revoked` is never retried, even though the server marks it `retryable` (meaning
  "sign in again").
- The SDK sends an `Idempotency-Key` on every call to the nine idempotent routes, generating one per
  call and keeping it across that call's retries; callers may pass their own.
- Backoff: `Retry-After` when sent and at most 60 s (otherwise the error is thrown), else 0.5 s
  doubling to 8 s with equal jitter. Default 2 retries.

## Why

Stripe's SDKs generate idempotency keys for the same reason, and RFC 9110 §9.2.2 defines which methods
are idempotent. The earlier rule ("429 always, 5xx on GET/DELETE") retried a rate-limited POST, which
a handler-level 429 doesn't make safe; this rule never retries a write that could repeat.
