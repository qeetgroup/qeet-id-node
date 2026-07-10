# Architecture

## One package, organized by category folder

`@qeet-id/node` is one npm package with resource files grouped into four
category folders under `src/` — `identity/`, `authentication/`,
`authorization/`, `administration/` — each following the same shape:

```ts
export class UsersService {
  constructor(private readonly t: Transport) {}

  create(input: CreateUserInput, opts?: RequestOpts): Promise<User> {
    return this.t.post<User>("/v1/users", input, opts);
  }
}
```

This differs from the Go SDK's single flat directory (`qeet-id-go` has no
subpackages — Go's import-cycle risk made per-resource folders a real
cost there; see [ADR-0001](../design-decisions/ADR-0001-category-folders.md)
for why TypeScript doesn't have that problem and folders are a net win here).
Every `XService` is still a direct field on `QeetID` (`src/client/client.ts`)
— the folders are a source-organization convenience only, grouped by comment
banners in `client.ts`, not a nested namespace in the public API.
`client.users`, `client.sessions`, `client.webhooks` are all one property
access away, exactly like the Go SDK's `client.Users`/`client.Sessions`/
`client.Webhooks`. See [ADR-0002](../design-decisions/ADR-0002-flat-client-fields.md).

## Why folders here, unlike the Go SDK

The Go SDK's ADR-0001 rejected package-per-resource specifically because Go
packages that both get imported by a root aggregator _and_ need to reference
shared root-level types (`Error`, `Config`) hit a real import-cycle wall,
forcing an `internal/` re-export-alias workaround. TypeScript/ES modules
don't have that constraint — any module can import any other without a
compiler-enforced cycle restriction, and `tsc`/bundlers handle circular type
imports between sibling files without issue. So `src/identity/users.ts`
importing `Transport` from `src/transport/http.ts`, while `src/client/client.ts`
imports `UsersService` from `src/identity/users.ts`, is not a cycle risk the
way it would be for two Go packages. Folders here buy real organization
(38+ files at one directory level is worse for navigation than the same 38
files split four ways) without the cost that made flat-files the right call
in Go.

## `src/transport/` and `src/utils/` layering

Even though every resource file lives in a category folder, the
_implementation_ of shared machinery is centralized and independently
testable:

| Module                        | Owns                                                                                                                          |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `src/transport/http.ts`       | The `Transport` class: auth header, retry/backoff, JSON (de)serialization, form-encoded requests (`doForm`, for OAuth grants) |
| `src/transport/fetch.ts`      | The raw `fetch` execution wrapper (one attempt, no retry)                                                                     |
| `src/transport/retry.ts`      | Backoff calculation, `Retry-After` parsing, retry-eligibility                                                                 |
| `src/transport/errors.ts`     | Maps a non-2xx response body to `ApiError`                                                                                    |
| `src/transport/pagination.ts` | The generic `paginate<T>` async-generator every `all()` method calls                                                          |
| `src/utils/jwt.ts`            | JWKS caching + ES256 signature verification (via `node:crypto`'s `webcrypto.subtle`) — the crypto behind `sessions.verify()`  |
| `src/utils/webhook.ts`        | HMAC-SHA256 webhook signature verification (`verifyWebhookSignature`/`constructEvent`)                                        |
| `src/utils/validation.ts`     | Fail-fast required-field checks                                                                                               |
| `src/errors/`                 | `ApiError`, `ValidationError`, `AuthError` — the three thrown-error types every method surfaces                               |
| `src/types/common.ts`         | `Envelope<T>`/`resolveEnvelope`, `ListParams`, `Page<T>`, `Logger`                                                            |

Resource files import these freely; nothing in `src/transport/` or
`src/utils/` imports a resource file back.

## No `Error` type alias needed

The Go SDK needs `type Error = transport.Error` specifically to dodge an
import cycle between its `internal/transport` package and the root package.
TypeScript has no such constraint, so `ApiError` is just defined once in
`src/errors/api-error.ts` and imported directly wherever it's needed —
no alias indirection.

## Every method throws instead of returning `(result, error)`

The Go SDK's `(T, error)` return convention doesn't translate — JavaScript
doesn't have multi-value returns, and using them here would fight `async`/
`await` at every call site. Every method returns a `Promise<T>` that
rejects with `ApiError` (non-2xx response), `ValidationError` (a missing
required argument, caught before any request is sent), or `AuthError`
(local JWT/webhook-signature verification failure — no HTTP round-trip
involved). `try`/`catch` (or a rejected-promise handler) replaces Go's
`if err != nil`.

## Authorization checks live on `permissions`

`permissions.check()`/`checkAll()`/`explain()` are the RBAC hot-path calls —
made on nearly every authenticated request. They're methods on
`PermissionsService`, not a bespoke root-level `client.can()` — matching the
Go SDK's same reasoning: a permission check is a `permissions` operation,
and putting it there means there's exactly one place to look for every
permission-related capability instead of a special case at the top level.

## `sessions` doesn't use the API-key transport

`SessionsService` (JWKS verification) never sends an API key — it hits a
public JWKS endpoint. It's constructed separately in `QeetID`'s constructor,
wrapping `JWKSVerifier` (from `src/utils/jwt.ts`) directly with the client's
base URL and fetch implementation, rather than going through `Transport`.

## OAuth's two request shapes

`OAuthService` legitimately needs two different request shapes, exactly
like the Go SDK:

- RFC-standard grant/introspection endpoints (`tokenExchange`, `introspect`,
  `revoke`, device flow, CIBA) authenticate via OIDC client credentials
  (HTTP Basic, optional) over form-encoded bodies — `Transport.doForm`.
- Its `signingKeys`/`grants`/`devices` sub-resources are ordinary
  ApiKey-authed JSON admin endpoints — the normal `Transport.get`/`post` path.

Both live on the same `Transport` instance, so `OAuthService` doesn't need
two different HTTP clients — just two different methods on one.
