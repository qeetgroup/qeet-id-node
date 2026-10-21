# AGENTS.md — qeet-id-node

**The model-neutral instruction file for coding agents.** [CLAUDE.md](CLAUDE.md),
[GEMINI.md](GEMINI.md) and [.github/copilot-instructions.md](.github/copilot-instructions.md) point
here and add nothing architectural.

## What this repository is

The **official server-side Node/TypeScript SDK for Qeet ID** — `@qeet-id/node` v0.1.0. Node ≥22,
bun and Biome, **zero runtime dependencies**, built by `tsup` into dual ESM/CJS with type declarations.

It is a **client of a contract it does not own.** The contract lives in `qeet-id-server`. This SDK
wraps it and never adds behaviour the API lacks.

## Context hierarchy

```text
qeet-context (L0)  →  qeet-id-context (L1)  →  qeet-id-server (the contract)
                                            →  qeet-id-node (L2 — this repository)
```

## Read before changing code

| File                                                         | For                                    |
| ------------------------------------------------------------ | -------------------------------------- |
| [qeet-repo.yml](qeet-repo.yml)                               | Machine-readable identity              |
| [docs/llm/architecture-map.md](docs/llm/architecture-map.md) | "Where is X?"                          |
| [docs/llm/context.md](docs/llm/context.md)                   | How this SDK works                     |
| [docs/llm/boundaries.md](docs/llm/boundaries.md)             | Ownership; **cross-SDK differences**   |
| [docs/llm/workflows.md](docs/llm/workflows.md)               | Adding a resource, a method, a release |

Repository ADRs: `docs/design-decisions/` — four, all binding.

## Rules

### 1. Zero runtime dependencies

`CONTRIBUTING.md` mandates it. devDependencies are fine; a runtime dependency changes what every
consumer installs and needs a decision.

### 2. Category folders, flat client fields — ADR-0001, ADR-0002

Resources live under `src/{identity,authentication,authorization,administration}/`, but the client
exposes them **flat**: `client.users`, `client.apiKeys`. Do not introduce nested namespaces.

### 3. Every method throws — ADR-0003

Never return a `(result, error)` tuple. Four error classes: `ApiError`, `NetworkError` (extends
`ApiError`, `status: 0`), `ValidationError`, `AuthError`.

### 4. Wire fields stay `snake_case` — ADR-0004

Interface fields mirror the wire shape exactly. **Do not camelCase them.** Note the React SDK does
the opposite by its own ADR — that divergence is deliberate and recorded.

### 5. Never invent an endpoint

Verify against the real handler in `qeet-id-server`, not just the OpenAPI document.

### 6. Never weaken security machinery

`src/utils/jwt.ts` (JWKS/ES256), `src/utils/webhook.ts` (HMAC), `src/transport/` (auth header).
**Retry idempotency is a safety rule:** 429 always; 5xx only on GET/DELETE. Never make
POST/PATCH/PUT retryable.

### 7. New exports go in both index files

A resource must be re-exported from its category `index.ts` **and** reachable from `src/index.ts`.

### 8. Tests

`test/helpers/mock-transport.ts` gives `recordingClient` / `scriptedClient`, both stubbing `fetch`.
Use them; there is no mock server.

## Commands

```bash
bun install
bun run verify      # typecheck + biome check + test + build — THE gate, run this before pushing
bun run build          # tsup, dual ESM/CJS
bun run test           # vitest run
bun run typecheck
bun run lint        # biome lint
bun run format      # biome format --write
```

Also `bun run dev` (tsup --watch), `bun run test:watch`, `bun run test:coverage`, `bun run lint:fix`, and `bun run check` (Biome lint + format check).

## What CI enforces

`ci.yml` on Node 22/24/26 (bun installs, Node runs the tests): install, `typecheck`, `build`, `test:coverage`.
**`ci.yml` does not run lint** — `lint.yml` runs `bun run check` (Biome: lint and formatting).
`security.yml`: `bun audit --audit-level=high` + gitleaks. `codeql.yml`: JS/TS, no autobuild.
`release.yml`: on push to `main` — install, typecheck, check, test, build, `npm publish --access public --provenance`.

## Before you finish

```bash
bun run verify
git diff
```

## Distribution status — know this

**`@qeet-id/node` is not on npm — the registry returns 404**, and the repository has no release tag,
while the organization advertises "drop-in SDKs". See `qeet-id-context/DRIFT-REGISTER.md` QID-009.

## Escalate rather than proceed

A runtime dependency · an exported-name change · the auth scheme · weakening verification · making a
non-idempotent method retryable · anything requiring another repository.
