# Boundaries — qeet-id-node

**Level:** L2 · **Last verified:** 2026-11-05

## Owns

Typed TypeScript bindings for the Qeet ID API calls an API key may make · HTTP execution with
timeouts, cancellation and safe retries · cursor pagination · the error hierarchy · webhook delivery
verification · access-token verification · the OAuth grants · the ES module and CommonJS builds.

## Does not own

| Not owned | Owner |
| --- | --- |
| **The API contract** | `qeet-id-server` — `api/openapi/*.yaml`, handlers, route policy |
| Authorization, tenancy, token issuance | `qeet-id-server` |
| A person's own account (sessions, factors, passkeys, email change) | the hosted pages and `qeet-id-react` |
| The Go story | `qeet-id-go` |
| Documentation site | `qeet-id-docs` |
| Organization / product standards | `qeet-context` (L0) / `qeet-id-context` (L1) |

**The SDK never adds behaviour the API lacks.** A missing endpoint is server work.

## Consumes

`api.id.qeet.in` over HTTPS: `Authorization: ApiKey <key>` for management calls; OAuth client
credentials in the form body for the token, introspection, revocation, device and backchannel
endpoints; the JWKS and discovery documents. Nothing else — no database, no filesystem, no runtime
package.

## Provides

An npm package whose **exports in `src/index.ts`** are its contract. Once published, every exported
name is a semver promise.

## Security boundaries

| Boundary | Enforcement |
| --- | --- |
| API key → wire | `src/core/http.ts` — private field; never logged, never in an error; https only |
| Token → claims | `src/tokens/verifier.ts` — ES256, known kid, issuer and audience required |
| Webhook body → event | `src/webhooks/verify.ts` — HMAC over timestamp and body, constant-time, replay window |
| Retry → side effects | `src/core/retry.ts` and `src/core/http.ts` — writes retried only with an idempotency key |
| Identifier → path | `src/core/resource.ts` — percent-encoded; empty and dot segments refused |

**This SDK is not a trust boundary.** It runs in the caller's process with the caller's credentials.

## Requires coordination

| Change | Why |
| --- | --- |
| **Any name in `src/index.ts`** | It is the package's public contract |
| Auth scheme | Must match the server |
| Retry policy | A wrong change duplicates server-side writes |
| Webhook signature or header | Must match `internal/developer/webhooks` |
| Error class shape | Consumers `instanceof` and switch on it |
| Node.js version floor | Affects who can install |
| A runtime dependency | Changes what every consumer installs |

## Hard limits

1. **Never add a runtime dependency.**
2. **Never retry a write without an idempotency key**, an OAuth grant, a directory sign-in, or
   `auth.session_revoked`.
3. **Never return a tuple** — every method throws (ADR-0003).
4. **Never camelCase a wire field** (ADR-0004).
5. **Never log or embed a credential**, including in a thrown error.
6. **Never skip signature, timestamp, issuer, audience or kid checks**, even in tests.
7. **Never wrap a route an API key can't call.**
8. **Never change another repository** from a task scoped to this one.
