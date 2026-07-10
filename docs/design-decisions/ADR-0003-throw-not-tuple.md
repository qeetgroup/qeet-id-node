# ADR-0003: Every method throws; no `(result, error)` tuple

**Status:** Accepted

## Context

The Go SDK's entire public API returns `(T, error)` — idiomatic Go, and the
only realistic option there. Porting to TypeScript, that convention could
be mimicked (`const [user, err] = await client.users.create(...)`) or
replaced with the JS-idiomatic rejecting-`Promise`/`throw` convention.

## Decision

Every method returns a plain `Promise<T>`. On failure it rejects — i.e. an
`await` call throws — with `ApiError` (a non-2xx HTTP response),
`ValidationError` (a missing required argument, caught before any request
is sent), or `AuthError` (a local JWT/webhook-signature verification
failure with no HTTP round-trip involved).

## Why

- **Tuples fight `async`/`await`, not just style.** Go's `(T, error)` works
  because Go has no exceptions and multi-value returns are free. Mimicking
  it in TS means every call site needs `const [x, err] = await ...; if
(err) throw err;` — reintroducing the exact `try`/`catch` mechanism
  anyway, just one level removed and with an extra tuple-destructure at
  every call site.
- **Matches this SDK's own ecosystem precedent.** Stripe-node, WorkOS-node,
  and the Node standard library's `fetch`-based APIs all throw/reject on
  failure. A `(result, error)` return shape would be the outlier here, not
  the norm.
- **`ApiError`/`ValidationError`/`AuthError` still carry everything Go's
  `*Error` does** (`status`, `code`, `message`, `requestId`,
  `retryAfterSeconds`, plus `is*()` predicates) — nothing is lost by
  switching the delivery mechanism from a return value to a thrown object.

## Consequence

Resource-file code reads noticeably flatter than the Go source it's ported
from — every `if err != nil { return nil, err }` in the Go source simply
disappears; the underlying `Transport` methods already throw, so a resource
method can `return this.t.post(...)` directly without an intermediate
`await`/error-check at all. See `src/identity/users.ts` for the pattern.
