# Workflows — qeet-id-node

**Level:** L2 · **Last verified:** 2026-08-28
**Verification scope:** every command checked against `package.json` and `.github/workflows/`.

## Set up

```bash
pnpm install
pnpm check      # typecheck + lint + test
```

No services required — tests stub `fetch`. There is no `.env`.

## Add a method to an existing resource

```text
1  verify the endpoint      read the handler in qeet-id-server — NOT just the OpenAPI doc
2  open src/<category>/<resource>.ts
3  match the neighbour      same option shape, same error handling
4  THROW on failure         never return a tuple (ADR-0003)
5  wire fields snake_case   do NOT camelCase them (ADR-0004)
6  test                     test/helpers/mock-transport.ts — recordingClient / scriptedClient
7  README table row
8  pnpm check
```

## Add a whole resource

```text
1  pick the category        identity | authentication | authorization | administration
2  src/<category>/<resource>.ts  — export class XService
3  re-export from src/<category>/index.ts
4  add a FLAT field on QeetID in src/client/client.ts   (ADR-0002)
5  confirm it is reachable from src/index.ts
6  test/unit — a companion test is expected here (unlike the Go SDK, this repo honours that)
7  README table row
8  pnpm check
```

**Both index files matter.** A resource exported from its category barrel but unreachable from
`src/index.ts` is invisible to consumers.

## Add pagination to a list method

```text
1  use paginate() from src/transport/pagination.ts
2  signature order: fetchPage FIRST, startCursor second   (Go's is the other way round)
3  throw on error — do not yield it
4  test a single page and a multi-page walk
```

## Change transport behaviour

**Review required.**

```text
1  src/transport/{http,fetch,retry,errors}.ts
2  RETRY IDEMPOTENCY IS A SAFETY RULE: 429 always; 5xx only for GET/DELETE
3  a new default belongs beside the code that uses it (no constants module exists here)
4  pnpm check
```

**Never make a non-idempotent method retryable.**

## Change cryptography

**Security review required.**

```text
1  src/utils/jwt.ts (JWKS, ES256, clock skew) or src/utils/webhook.ts (HMAC)
2  cite the RFC — do not improvise
3  constant-time comparison for signatures
4  NEGATIVE tests: bad signature, unknown kid, expired token, skew boundary
5  pnpm check
```

Never weaken verification to make a test pass; never add a skip flag.

## Change the error taxonomy

**Coordination required — consumers `instanceof` these.**

```text
1  src/errors/*.ts
2  keep the four classes distinct: ApiError | NetworkError | ValidationError | AuthError
3  NetworkError MUST keep status 0 / code "network_error"
4  update docs/design-decisions if the model itself changes
5  pnpm check
```

## Release

```text
1  bump package.json version AND src/version.ts   (they are kept in sync BY HAND)
2  CHANGELOG.md
3  pnpm check && pnpm build
4  tag vX.Y.Z and push the tag
```

`release.yml` then runs install/typecheck/lint/test/build and `pnpm publish --access public`.

> **The two version numbers are not linked.** Forgetting `src/version.ts` ships a package whose
> `VERSION` export lies. There are no changesets in this repo.

> `@qeet-id/node` is not on npm today. A first publish is a product decision — see
> `qeet-id-context/DRIFT-REGISTER.md` QID-009.

## Finish any task

```bash
pnpm check
git diff
```

`pnpm check` is `typecheck && lint && test`. Note CI's `ci.yml` does **not** run lint — `lint.yml`
does — so `pnpm check` locally is stricter than a single CI job.

### Escalate rather than proceed

A runtime dependency · a change to `src/index.ts` exports · the auth scheme · weakening verification ·
making a non-idempotent method retryable · anything requiring another repository.
