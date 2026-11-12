# Architecture Map — qeet-id-node

**Level:** L2 · **Last verified:** 2026-11-05
**Verification scope:** every path below was confirmed to exist.

| Need | Path |
| --- | --- |
| Repository identity | [`qeet-repo.yml`](../../qeet-repo.yml) |
| Agent instructions | [`AGENTS.md`](../../AGENTS.md) |
| **Public exports — the package's contract** | `src/index.ts` |
| The client `QeetID` and its options | `src/client.ts` |
| Version constant | `src/version.ts` (a test keeps it equal to `package.json`) |
| Discovery, `createTokenVerifierFromDiscovery` | `src/discovery.ts` |

## Core

| Concern | Path |
| --- | --- |
| **Request execution: auth header, headers, body, timeouts, retries, logging** | `src/core/http.ts` |
| Retry policy and backoff | `src/core/retry.ts` |
| **Error classes and response → error mapping** | `src/core/errors.ts` |
| Pagination (`CursorPage`, `PagePromise`, `ListResult`) | `src/core/pagination.ts` |
| Resource base class and the `path` tag | `src/core/resource.ts` |
| Per-call options, `AppInfo`, `Logger` | `src/core/options.ts` |
| Defaults, base-URL rules, User-Agent | `src/core/config.ts` |

## Security-critical

| Concern | Path |
| --- | --- |
| **Webhook verification** | `src/webhooks/verify.ts` |
| Webhook event catalogue and types | `src/webhooks/events.ts` |
| **Access-token verification (JWKS, ES256)** | `src/tokens/verifier.ts` |
| OAuth grants, introspection, `TokenGuard` | `src/resources/federation/oauth.ts` |

## Resources — one folder per OpenAPI document

```text
src/resources/identity/     management.yaml   tenants · domains · users · groups · invitations · branding
src/resources/access/       auth.yaml         roles · permissions · relationships · decisions · auth-policy
                                              security-policy · ip-rules · threat-detection
src/resources/federation/   federation.yaml   oauth · applications · service-principals · saml · ldap · scim
                                              social-providers · admin-portal-links
src/resources/developer/    developer.yaml    api-keys · agents · verifiable-credentials · auth-hooks
                                              webhooks · secrets · token-vault
src/resources/operations/   operations.yaml   audit-logs · analytics · billing · gdpr · email-templates
                                              retention · log-sinks · rate-limits
```

## Build, test, CI

| | |
| --- | --- |
| Scripts | `package.json` |
| Build config | `tsdown.config.ts` — ESM + CJS, one file per module, declarations, target node22 |
| Compiler config | `tsconfig.json` — `nodenext`, strict, `isolatedDeclarations` |
| Tests | `test/` — vitest; `test/resources/requests.test.ts` lists every method's request |
| **Mock fetch** | `test/helpers/mock-fetch.ts` |
| Webhook fixtures (from the server's signing code) | `test/fixtures/webhook-deliveries.json` |
| Examples | `examples/` (Node.js built-ins only, type-checked) |
| CI (Verify) and release | `.github/workflows/{ci,release}.yml` |

## Decisions

| ADR | Decision |
| --- | --- |
| `docs/design-decisions/ADR-0001-api-area-folders.md` | One folder per API area |
| `docs/design-decisions/ADR-0002-client-namespaces.md` | Resources as namespaces on one client |
| `docs/design-decisions/ADR-0003-throw-not-tuple.md` | Every method throws; one error hierarchy |
| `docs/design-decisions/ADR-0004-snake-case-wire-fields.md` | Wire fields stay snake_case |
| `docs/design-decisions/ADR-0005-retries-and-idempotency.md` | Retry only what can't happen twice |
| `docs/design-decisions/ADR-0006-dual-package.md` | ES module and CommonJS builds |

Also `docs/architecture/ARCHITECTURE.md`, `docs/engineering-practices.md`, `docs/FUTURE.md`.

## Upstream

The API contract lives in **`qeet-id-server`**: `api/openapi/*.yaml`, the handlers under `internal/`,
and the route policy in `internal/bootstrap/permissions.go`. Not vendored here.
