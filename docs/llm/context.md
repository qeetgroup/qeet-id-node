# Repository Context — qeet-id-node

**Level:** L2 · **Status:** active · **Evidence state:** verified · **Last verified:** 2026-08-28
**Verification scope:** exports, transport behaviour, constants, CI jobs and test setup read from
source. Publication status checked against the npm registry.

## Identity

`@qeet-id/node` v0.1.0 — the server-side Node/TypeScript SDK for Qeet ID. Node ≥18.17
(`.nvmrc` pins 24), pnpm 10.32.1, **zero runtime dependencies**. Built by `tsup` into dual ESM/CJS
with `dts: true`, target `node18`.

**Status: `development`. Not published — npm returns 404** for `@qeet-id/node`, and the repository
carries no release tag. See `qeet-id-context/DRIFT-REGISTER.md` QID-009.

## Context inheritance

```text
qeet-context (L0)  →  qeet-id-context (L1)  →  qeet-id-server (the contract)
                                            →  qeet-id-node (L2 — this document)
```

## Responsibilities

Typed bindings for the Qeet ID REST API; HTTP transport with retry; cursor pagination; a four-class
error taxonomy; JWKS/ES256 token verification; webhook signature verification.

## Non-responsibilities

**No behaviour of its own.** Authorization, tenant scoping, token issuance and validation semantics
all belong to `qeet-id-server`. It also does not own the OpenAPI contract, the browser story
(`qeet-id-react`), or documentation (`qeet-id-docs`).

## Architecture

```text
caller
  ↓  new QeetID({ apiKey })
QeetID              flat fields: client.users, client.apiKeys, ...   (ADR-0002)
  ↓
src/transport/      buildUrl → auth header → retry → parse → THROW typed error
  ↓
api.id.qeet.in
```

Four binding ADRs: **category folders** (0001), **flat client fields** (0002), **throw, never a
tuple** (0003), **wire fields stay snake_case** (0004).

Resources are grouped on disk into `identity` / `authentication` / `authorization` /
`administration`, but exposed flat on the client — the folder structure is for humans, the flat
surface is the contract.

## Transport

**Evidence:** `src/transport/http.ts`, `src/transport/retry.ts`

| Property | Value |
|---|---|
| Base URL default | `https://api.id.qeet.in` — declared in `src/transport/http.ts`, **not** a constants module |
| Auth header | `authorization: ApiKey <qk_...>` — **lowercase header key** |
| OAuth form endpoints | `Basic <base64>`, never retried |
| Timeout | 10 000 ms |
| Retries | 2 |
| Retry policy | **429 always; 5xx only when idempotent (GET/DELETE)** |
| Backoff | `250ms * 2^attempt + jitter`, honours `Retry-After` |
| Escape hatch | `config.fetch` — replaces the fetch implementation (Go has no equivalent) |

**Constants are scattered**, unlike the Go SDK which centralises them: `DEFAULT_BASE_URL` in
`transport/http.ts`, JWKS TTLs private inside `utils/jwt.ts`, webhook headers in `utils/webhook.ts`.
There is no `src/constants/` directory in this repository — it does not exist.

## Errors — four classes

| Class | Meaning |
|---|---|
| `ApiError` | An HTTP error response; carries `status`, `code`, `message`, `requestId`, plus `is*()` methods |
| `NetworkError extends ApiError` | Transport failure — `status: 0`, `code: "network_error"` |
| `ValidationError` | Client-side argument failure; carries `field` |
| `AuthError` | JWKS or webhook verification failure; `code`, no status |

**Every method throws** (ADR-0003). The Go SDK returns `(T, error)` with a single type and no
network-error class — see [boundaries.md](boundaries.md#cross-sdk-differences--read-before-harmonising-anything).

## Pagination

`src/transport/pagination.ts` — a `paginate()` async generator taking `fetchPage` first and
`startCursor` second. Errors are thrown, not yielded. (Go's `Paginate` takes `ctx` and
`startCursor`, and yields errors.)

## Cryptography

`src/utils/jwt.ts` — `JWKSVerifier`, ES256 via `webcrypto.subtle`; cache TTL 5 min, refresh cooldown
1 min, default clock skew 30 s. Concurrent refreshes are de-duplicated by a
`refreshing: Promise<void> | null` — the Go SDK does not do this.

> `JWKSVerifier` is exported from `src/utils/index.ts` but **not** from `src/index.ts` — so it is
> not reachable from the package root. Asymmetric with Go, where it is `internal`.

`src/utils/webhook.ts` — HMAC-SHA256. Header constants are **lowercase**
(`x-qeet-signature`, `x-qeet-event`) where Go uses canonical casing. `constructEventFromRequest`
is deliberately absent (Node frameworks disagree on request shape and may have pre-parsed the body).
The event payload is **parsed eagerly**; Go defers it as `json.RawMessage`.

## Testing

11 files under `test/`, vitest, `environment: "node"`, `include: ["test/**/*.test.ts"]`, v8 coverage.
~205 `it()` blocks, concentrated in four per-category resource files.
`test/helpers/mock-transport.ts` provides `recordingClient` and `scriptedClient`, both stubbing
`fetch` — there is **no mock HTTP server**.

## CI/CD

| Workflow | Runs |
|---|---|
| `ci.yml` | Node 18.17/20/22/24 — install, `typecheck`, `build`, `test:coverage`. **No lint** |
| `lint.yml` | `pnpm lint` + `prettier --check` |
| `security.yml` | `pnpm audit --prod=false --audit-level=high` + gitleaks |
| `codeql.yml` | JS/TS, no autobuild step |
| `release.yml` | tag `v*` — install, typecheck, lint, test, build, `pnpm publish --access public` |

Note the asymmetry: **`ci.yml` omits lint here but includes it in `qeet-id-react`.**

## Security-critical areas

| Area | Path | Risk | Review |
|---|---|---|---|
| JWKS / ES256 | `src/utils/jwt.ts` | **Critical** | Security review |
| Webhook HMAC | `src/utils/webhook.ts` | **Critical** | Security review |
| Auth header injection | `src/transport/http.ts` | High | Security review |
| Retry idempotency | `src/transport/retry.ts` | High | Review — a wrong change duplicates writes |

`SECURITY.md`: disclose privately to **security@qeet.in**; include `VERSION` and the Node version.

## Known constraints

- **Zero runtime dependencies is a hard rule.**
- Node ≥18.17 — the floor is enforced by `engines`.
- There is no `src/constants/` — defaults live beside the code that uses them.
- `JWKSVerifier` is not reachable from the package root.
- Not published, so contract changes are currently free. That ends at the first release.

## Documentation authority

Source > tests > `CONTRIBUTING.md` > README. The **API contract** is owned by `qeet-id-server`.
