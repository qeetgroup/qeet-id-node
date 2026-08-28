# Architecture Map — qeet-id-node

**Level:** L2 · **Last verified:** 2026-08-28
**Verification scope:** every path below was confirmed to exist.

| Need | Path |
|---|---|
| Repository identity | [`qeet-repo.yml`](../../qeet-repo.yml) |
| Agent instructions | [`AGENTS.md`](../../AGENTS.md) |
| **Public barrel — the export contract** | `src/index.ts` |
| Client class `QeetID` | `src/client/client.ts` |
| Config type | `src/client/config.ts` |
| Per-request options | `src/client/options.ts` |
| Discovery helpers | `src/client/discovery.ts` |
| Version constant | `src/version.ts` |

## Transport

| Concern | Path |
|---|---|
| **`Transport` class, `DEFAULT_BASE_URL`, auth header** | `src/transport/http.ts` |
| URL building, raw fetch | `src/transport/fetch.ts` |
| Error body parsing | `src/transport/errors.ts` |
| Retry + backoff | `src/transport/retry.ts` |
| **Cursor pagination (async generator)** | `src/transport/pagination.ts` |

## Errors

| Class | Path |
|---|---|
| `ApiError`, `NetworkError` | `src/errors/api-error.ts` |
| `ValidationError` | `src/errors/validation-error.ts` |
| `AuthError` | `src/errors/auth-error.ts` |

## Security-critical

| Concern | Path |
|---|---|
| **JWKS cache + ES256 verification** | `src/utils/jwt.ts` |
| **Webhook HMAC verification** | `src/utils/webhook.ts` |
| base64url helpers | `src/utils/crypto.ts` |
| Argument validation | `src/utils/validation.ts` |

## Resource categories

```text
src/identity/         users · organizations · domains · service-principals · agents
src/authentication/   sessions · oauth · oidc · saml · saml-providers · scim · ldap
                      social · mfa · credentials · auth-hooks · auth-policy · policy
                      ip-rules · bot-detection · risk-settings
src/authorization/    roles · permissions · groups · relation-tuples · authzen
src/administration/   admin-links · analytics · api-keys · audit-logs · billing · branding
                      email-templates · gdpr · invitations · log-sinks · rate-limits
                      retention · token-vault · vault · webhooks
```

Shared types: `src/types/common.ts` — `Logger`, `ListParams`, `Page<T>`, `Envelope<T>`,
`resolveEnvelope`.

## Decisions

| ADR | Decision |
|---|---|
| `docs/design-decisions/ADR-0001-category-folders.md` | Category folders, not one flat directory |
| `docs/design-decisions/ADR-0002-flat-client-fields.md` | Flat `QeetID` fields, not nested groups |
| `docs/design-decisions/ADR-0003-throw-not-tuple.md` | Every method throws |
| `docs/design-decisions/ADR-0004-snake-case-wire-fields.md` | Wire fields stay snake_case |

Also `docs/architecture/ARCHITECTURE.md`, `docs/FUTURE.md`.

## Build, test, CI

| | |
|---|---|
| Scripts | `package.json` |
| Build config | `tsup.config.ts` — dual ESM/CJS, dts, target node18 |
| Tests | `test/` — 11 files, vitest, `environment: "node"` |
| **Mock transport** | `test/helpers/mock-transport.ts` |
| CI | `.github/workflows/{ci,lint,security,codeql,release}.yml` |

## Upstream

The API contract lives in **`qeet-id-server`**, under its OpenAPI documents. Not vendored here.
