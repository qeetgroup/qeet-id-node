# Repository Context — qeet-id-node

**Level:** L2 · **Status:** active · **Evidence state:** verified · **Last verified:** 2026-11-05
**Verification scope:** exports, transport behaviour, constants, CI jobs and tests read from source;
every resource path checked against `qeet-id-server`'s OpenAPI documents and route policy.

## Identity

`@qeet-id/node` — the server-side Node.js/TypeScript SDK for Qeet ID. Node.js 22.12 or later, bun and
Biome, TypeScript 7, **zero runtime dependencies**. Built by tsdown into ES module (`.mjs`, `.d.mts`)
and CommonJS (`.cjs`, `.d.cts`) output, one file per source module.

**Status: development. Not yet published to npm.**

## Context inheritance

```text
qeet-context (L0)  →  qeet-id-context (L1)  →  qeet-id-server (the contract)
                                            →  qeet-id-node (L2 — this document)
```

## Responsibilities

Typed bindings for the API calls an API key may make; HTTP execution with timeouts, cancellation and
safe retries; cursor pagination; a typed error hierarchy; webhook delivery verification; access-token
verification; the OAuth grants and introspection.

## Non-responsibilities

**No behaviour of its own.** Authorization, tenancy, token issuance and validation semantics belong to
`qeet-id-server`. It does not own the OpenAPI contract, the browser story (`qeet-id-react`) or the
documentation site (`qeet-id-docs`). A person's own account (sessions, factors, passkeys, email
changes) is user-only on the server and not wrapped here.

## Architecture

```text
caller
  ↓  new QeetID({ apiKey })
QeetID                 namespaces: qeetId.users, qeetId.webhooks.deliveries, …      (ADR-0002)
  ↓
src/resources/<area>/  one class per namespace, paths built with the `path` tag      (ADR-0001)
  ↓
src/core/http.ts       headers → body → fetch with timeout → typed error → retry if safe
  ↓
api.id.qeet.in
```

Standalone, needing no client: `constructWebhookEvent` (`src/webhooks/`), `TokenVerifier`
(`src/tokens/`), `discover` and `createTokenVerifierFromDiscovery` (`src/discovery.ts`).

## Transport

**Evidence:** `src/core/http.ts`, `src/core/retry.ts`, `src/core/config.ts`

| Property | Value |
| --- | --- |
| Base URL | `https://api.id.qeet.in`; https required except for localhost |
| Auth | `Authorization: ApiKey <key>`; not sent to the OAuth, directory sign-in, agent token and credential verification endpoints |
| OAuth client auth | `client_secret_post` (the server also accepts form-encoded HTTP Basic) |
| Timeout | 30 000 ms per attempt |
| Retries | 2, for GET, DELETE, `retrySafe` POSTs and idempotency-keyed requests; after no response, timeout, 408, 429, 500, 502, 503, 504, 409 `idempotency.in_progress`; never `auth.session_revoked` |
| Backoff | 500 ms doubling to 8 s, equal jitter; `Retry-After` honoured up to 60 s |
| Idempotency-Key | generated per call on the nine idempotent routes; caller may pass one |
| User-Agent | `[appInfo ]qeet-id-node/<version> node/<version> (<platform>; <arch>)` |
| Logging | optional `logger`; method, path, attempt, status, duration, request id only |
| Escape hatch | `fetch` option |

## Errors

`QeetIDError` → `ApiError` (status classes, `SessionRevokedError`, `OAuthError`), `NetworkError` →
`TimeoutError`, `WebhookVerificationError`, `TokenVerificationError`. `ApiError` reads the envelope
`{"error": {code, message, detail, fields, metadata, retryable, request_id}}` and `X-Request-Id`;
`OAuthError` reads RFC 6749 `{error, error_description}`. Errors are branded so `instanceof` works
across the CommonJS and ES module copies.

## Pagination

Paged lists (`items`, `next_cursor`) return `PagePromise` → `CursorPage`; whole lists return
`{ data, truncated }`.

## Cryptography

`src/webhooks/verify.ts` — HMAC-SHA256 over `timestamp + "." + body`, every signature value against
every secret, `timingSafeEqual`, 300 s tolerance. `src/tokens/verifier.ts` — ES256 via Web Crypto;
issuer and audience required; JWKS cache 5 min, unknown-kid refresh cooldown 30 s, stale keys kept if
a refresh fails; 30 s clock tolerance.

## Testing

`test/` with vitest: core (HTTP, retries, errors, pagination), webhooks (fixtures captured from the
server's dispatcher), tokens (real ES256 keys), OAuth, and a table of every method's request.
`test/helpers/mock-fetch.ts` stubs `fetch`; there is no mock server.

## Known constraints

- Zero runtime dependencies is a hard rule.
- Not published, so contract changes are still free. That ends at the first release.
- Some server areas are not wrapped yet; see `docs/FUTURE.md`.

## Documentation authority

Source > tests > README > this file. The **API contract** is owned by `qeet-id-server`.
