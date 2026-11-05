# ADR-0003: Every method throws; one error hierarchy

**Status:** Accepted

## Decision

Every method returns a `Promise` (or a `PagePromise`) and rejects on failure; none returns a
`(result, error)` pair. Errors the SDK makes extend `QeetIDError`:

- `ApiError` — the API answered with an error. Subclasses by status: `BadRequestError` (400),
  `AuthenticationError` (401) and its `SessionRevokedError` (`auth.session_revoked`),
  `PermissionDeniedError` (403), `NotFoundError` (404), `ConflictError` (409), `ValidationError`
  (422), `RateLimitError` (429), `InternalServerError` (5xx) and its `ServiceUnavailableError` (503),
  and `OAuthError` for the token endpoints' RFC 6749 answers.
- `NetworkError` and its `TimeoutError` — no response.
- `WebhookVerificationError`, `TokenVerificationError` — local verification failed.

Each carries a stable `code`; `ApiError` adds `status`, `requestId`, `detail`, `fields`, `metadata`,
`retryable`, `retryAfterSeconds` and `headers`. Argument mistakes are `TypeError` or `RangeError`. A
cancelled call rejects with the signal's reason.

## Why

- `try`/`catch` and `instanceof` are how JavaScript handles failure; tuples fight `async`/`await`.
- Classes per status let callers handle the common cases without reading numbers; `code` covers the
  rest without parsing messages.
- Errors are branded with a `Symbol.for` key so `instanceof` works across the CommonJS and ES module
  copies of the package (ADR-0006).
