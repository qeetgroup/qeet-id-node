# Boundaries — qeet-id-node

**Level:** L2 · **Last verified:** 2026-08-28
**Verification scope:** ownership from the L1 map in `qeet-id-context/REPOSITORIES.md`; cross-SDK
differences verified by reading all three SDKs.

## Owns

Typed TS bindings for the Qeet ID REST API · HTTP transport with retry · cursor pagination · a
four-class error taxonomy · JWKS/ES256 verification · webhook HMAC verification · the dual ESM/CJS
build.

## Does not own

| Not owned | Owner |
|---|---|
| **The API contract** | `qeet-id-server` — see its OpenAPI documents |
| Authorization, tenancy, token issuance | `qeet-id-server` |
| The browser/React story | `qeet-id-react` |
| The Go story | `qeet-id-go` |
| Documentation | `qeet-id-docs` |
| Organization / product standards | `qeet-context` (L0) / `qeet-id-context` (L1) |

**The SDK never adds behaviour the API lacks.** A missing endpoint is backend work, not a
client-side simulation.

## Consumes

`api.id.qeet.in` over HTTPS with `authorization: ApiKey <qk_...>`; the JWKS document. Nothing else —
no database, no filesystem, no runtime package.

## Provides

An npm package with a **public export barrel** (`src/index.ts`). Once published, every exported name
is a semver contract with consumers Qeet cannot survey.

## Security boundaries

| Boundary | Enforcement |
|---|---|
| API key → wire | `src/transport/http.ts` — never logged, never in a thrown error |
| Token → claims | `src/utils/jwt.ts` — ES256, unknown `kid` rejected |
| Webhook body → event | `src/utils/webhook.ts` — HMAC, constant-time compare |
| Retry → side effects | `src/transport/retry.ts` — non-idempotent methods never retried |

**This SDK is not a trust boundary.** It runs in the caller's process with the caller's API key.

## Cross-SDK differences — read before "harmonising" anything

The three SDKs differ, some deliberately and some accidentally. **Do not change one to match another
without a decision.**

| Concern | Node | Go | React |
|---|---|---|---|
| Error model | **throws**, 4 classes | `(T, error)`, 1 type | throws `AuthenticationError` |
| Network failure | `NetworkError` (`status: 0`) | wrapped `fmt.Errorf` — **no type** | — |
| Predicates | `isUnauthorized()` methods | methods on a pointer | **getters** |
| Webhook header const | **lowercase** `x-qeet-signature` | canonical `X-Qeet-Signature` | n/a |
| `constructEventFromRequest` | **deliberately omitted** | present | n/a |
| Webhook payload | **parsed eagerly** | deferred `json.RawMessage` | n/a |
| Pagination | async generator | `iter.Seq2` | **none** |
| Claims fields | **all optional** — callers must assert | all non-pointer | n/a |
| Constants | **scattered** per module | centralised (`qeet-id-go` internal constants) | a `constants` module exists (`qeet-id-react`) |
| Config escape hatch | `fetch` | `HTTPClient` | neither |
| Wire casing | **snake_case kept** (ADR-0004) | as-is | **camelCase mapped** |
| Auth | `ApiKey` header | `ApiKey` header | **cookie + CSRF** |
| Version export | `VERSION` | `qeetid.Version` | **none** |
| Client type name | `QeetID` | `Client` | `QeetIDClient` |

Two are worth calling out as genuine contradictions rather than style:

- **Wire casing.** This SDK's ADR-0004 keeps `snake_case`; React's client explicitly maps to
  camelCase. Same organization, opposite decisions, both recorded.
- **Webhook header constants.** A consumer comparing `WEBHOOK_SIGNATURE_HEADER` across the Node and
  Go SDKs gets **unequal strings**. Both work at the wire level (HTTP headers are
  case-insensitive) — but the exported constants are not interchangeable.

Node also exports four services that are **not** on the root client —
`AuditAnomaliesService`, `SigningKeysService`, `OAuthGrantsService`, `OAuthDevicesService` — where Go
folds these into their parents.

## Safe to change without coordination

Internal refactoring behind an unchanged export · adding a test · a bug fix that preserves
signatures · doc comments · adding a **new** method or resource.

## Requires coordination

| Change | Why |
|---|---|
| **Any name in `src/index.ts`** | It is the package's public contract |
| Auth scheme | Matches the server and the Go SDK |
| Retry policy | A wrong change duplicates server-side writes |
| Webhook header or algorithm | Must match `qeet-id-server` and the Go SDK |
| Error class shape | Consumers `instanceof` and switch on it |
| Node version floor | Affects who can install |
| Adding a runtime dependency | Changes what every consumer installs |

Product-level fan-out: `qeet-id-context/CHANGE-MATRIX.md`.

## Hard limits

1. **Never add a runtime dependency.**
2. **Never make POST/PATCH/PUT retryable.**
3. **Never return a tuple** — every method throws (ADR-0003).
4. **Never camelCase a wire field** (ADR-0004).
5. **Never log or embed an API key**, including in a thrown error.
6. **Never skip signature or `kid` verification**, even in tests.
7. **Never wrap an endpoint you have not verified in the backend handler.**
8. **Never change another repository** from a task scoped to this one.
