# AGENTS.md — qeet-id-node

**The model-neutral instruction file for coding agents.** [CLAUDE.md](CLAUDE.md),
[GEMINI.md](GEMINI.md) and [.github/copilot-instructions.md](.github/copilot-instructions.md) point
here and add nothing architectural.

## What this repository is

The **server-side Node.js/TypeScript SDK for Qeet ID**, `@qeet-id/node`. Node.js 22.12 or later, bun
and Biome, **zero runtime dependencies**, built by tsdown into ES module and CommonJS builds with
declarations. Not yet published.

It is a **client of a contract it does not own.** The contract is `qeet-id-server`'s five OpenAPI
documents (`api/openapi/{auth,management,federation,developer,operations}.yaml`), with the server's
handlers and route policy (`internal/bootstrap/permissions.go`) as the tiebreaker. The SDK wraps them
and never adds behaviour the API lacks.

## Read before changing code

| File | For |
| --- | --- |
| [qeet-repo.yml](qeet-repo.yml) | Machine-readable identity |
| [docs/llm/architecture-map.md](docs/llm/architecture-map.md) | "Where is X?" |
| [docs/llm/context.md](docs/llm/context.md) | How this SDK works |
| [docs/llm/boundaries.md](docs/llm/boundaries.md) | What it owns, and what it must not touch |
| [docs/llm/workflows.md](docs/llm/workflows.md) | Adding a resource or a method; releasing |
| [docs/engineering-practices.md](docs/engineering-practices.md) | The practices followed, with sources |

Decisions: `docs/design-decisions/` (ADR-0001 to ADR-0006), all binding.

## Rules

1. **Zero runtime dependencies.** `fetch`, Web Crypto and `node:crypto` only. devDependencies are fine.
2. **One folder per API area** — `src/resources/{identity,access,federation,developer,operations}/`,
   matching the server's OpenAPI documents (ADR-0001). Resources are namespaces on `QeetID`
   (`qeetId.users`), with a few nested ones where the API nests (ADR-0002).
3. **Every method throws.** Never a `(result, error)` tuple (ADR-0003). Errors the SDK makes extend
   `QeetIDError`; argument mistakes are `TypeError`/`RangeError`.
4. **Wire objects keep the wire's names** (`display_name`, ADR-0004). SDK options are camelCase.
5. **Never wrap a route an API key can't call.** Check the route in the OpenAPI document **and** in
   the server's route policy: user-only routes (a person's own account) don't belong here.
6. **Retries must never do anything twice** (ADR-0005). Only `GET`, `DELETE`, POSTs marked
   `retrySafe` (checks and previews) and requests with an `Idempotency-Key` are retried. Never make
   `PUT`, `PATCH`, another POST, an OAuth grant or directory sign-in retryable. Never retry
   `auth.session_revoked`.
7. **Never weaken verification:** `src/webhooks/verify.ts` (HMAC, timestamp, constant-time compare),
   `src/tokens/verifier.ts` (ES256, issuer, audience), `src/core/http.ts` (API key handling).
8. **No credentials anywhere they could leak:** not in errors, logs, `inspect` output or tests'
   snapshots. Secrets live in private `#` fields.
9. **New types are exported** through `src/index.ts` (`export type * from` each resource file).
10. **Tests:** `test/helpers/mock-fetch.ts` (`mockClient`, `mockFetch`). Add the method's row to
    `test/resources/requests.test.ts`. Webhook fixtures come from the server's own signing code.

## Commands

```bash
bun install
bun run verify          # typecheck + Biome + tests + build + publint + attw — the gate
bun run build           # tsdown
bun run test            # vitest run
bun run typecheck       # tsc --noEmit (TypeScript 7)
bun run check           # Biome lint and format check
bun run check:package   # publint --strict && attw --pack .
```

Also `bun run dev`, `bun run test:watch`, `bun run test:coverage`, `bun run lint`, `bun run lint:fix`,
`bun run format`.

## What CI enforces

`ci.yml` on Node.js 22, 24 and 26: install, typecheck, build, tests with coverage, package checks.
`lint.yml`: `bun run check`. `security.yml`: `bun audit --audit-level=high` and gitleaks. `codeql.yml`.
`release.yml`: on push to `main`, publishes to npm with provenance and tags the version.

## Before you finish

```bash
bun run verify
git diff
```

## Escalate rather than proceed

A runtime dependency · renaming or removing an export · the auth scheme · weakening verification ·
making a non-idempotent call retryable · anything requiring another repository · the package name or
first published version.
