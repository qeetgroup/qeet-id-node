# GEMINI.md — qeet-id-node

**Read [AGENTS.md](AGENTS.md) first.** It is the model-neutral instruction file and the source of
truth for this repository. This file is a pointer and adds no architecture.

```text
GEMINI.md  →  AGENTS.md  →  docs/llm/*
```

## Canonical context

| File | For |
|---|---|
| [qeet-repo.yml](qeet-repo.yml) | Machine-readable repository identity |
| [AGENTS.md](AGENTS.md) | **Rules, commands, what CI enforces** |
| [docs/llm/context.md](docs/llm/context.md) | How this repository actually works |
| [docs/llm/boundaries.md](docs/llm/boundaries.md) | What it owns, and what it must not touch |
| [docs/llm/workflows.md](docs/llm/workflows.md) | Step-by-step for common changes |
| [docs/llm/architecture-map.md](docs/llm/architecture-map.md) | "Where is X?" — fastest path to a file |

Parent context: **L0** `qeetgroup/qeet-context` · **L1** `qeetgroup/qeet-id-context`.

## What this repository is

The server-side **Node/TypeScript SDK for Qeet ID** — `@qeet-id/node`. Node ≥18.17, pnpm, **zero runtime dependencies**, dual ESM/CJS via tsup. It wraps a contract owned by `qeet-id-server`.

## Non-negotiables

1. **Zero runtime dependencies.** devDependencies are fine; a runtime dependency is a decision.
2. **Every method throws** — never a `(result, error)` tuple (ADR-0003). Four classes: `ApiError`, `NetworkError`, `ValidationError`, `AuthError`.
3. **Wire fields stay `snake_case`** (ADR-0004). Do not camelCase them — note the React SDK deliberately does the opposite.
4. **Never invent an endpoint.** Verify against the real handler in `qeet-id-server`.
5. **Retry idempotency is a safety rule:** 429 always; 5xx only on GET/DELETE. Never make POST/PATCH/PUT retryable.
6. **Never weaken** `src/utils/jwt.ts` (JWKS/ES256) or `src/utils/webhook.ts` (HMAC).

## Commands

`pnpm install` · `pnpm check` · `pnpm build` · `pnpm test` · `pnpm typecheck` · `pnpm lint`

That list is complete — **do not invent commands.**

## Before finishing

```bash
pnpm check
git diff
```
