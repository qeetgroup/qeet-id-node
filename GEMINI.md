# GEMINI.md — qeet-id-node

**Read [AGENTS.md](AGENTS.md) first.** It is the model-neutral instruction file and the source of
truth for this repository. This file is a pointer and adds no architecture.

```text
GEMINI.md  →  AGENTS.md  →  docs/llm/*
```

## Canonical context

| File | For |
| --- | --- |
| [qeet-repo.yml](qeet-repo.yml) | Machine-readable repository identity |
| [AGENTS.md](AGENTS.md) | **Rules, commands, what CI enforces** |
| [docs/llm/context.md](docs/llm/context.md) | How this repository actually works |
| [docs/llm/boundaries.md](docs/llm/boundaries.md) | What it owns, and what it must not touch |
| [docs/llm/workflows.md](docs/llm/workflows.md) | Step-by-step for common changes |
| [docs/llm/architecture-map.md](docs/llm/architecture-map.md) | "Where is X?" — fastest path to a file |

Parent context: **L0** `qeetgroup/qeet-context` · **L1** `qeetgroup/qeet-id-context`.

## What this repository is

The server-side **Node.js/TypeScript SDK for Qeet ID** — `@qeet-id/node`. Node.js 22.12+, bun, Biome,
**zero runtime dependencies**, ES module and CommonJS builds via tsdown. It wraps a contract owned by
`qeet-id-server`.

## Non-negotiables

1. **Zero runtime dependencies.**
2. **Every method throws** (ADR-0003); SDK errors extend `QeetIDError`.
3. **Wire fields stay `snake_case`** (ADR-0004).
4. **Only routes an API key may call** — check the OpenAPI document and the server's route policy.
5. **Retries never repeat a write** (ADR-0005).
6. **Never weaken** webhook or token verification.

## Commands

`bun install` · `bun run verify` · `bun run build` · `bun run test` · `bun run typecheck` · `bun run check` · `bun run check:package`

That list is complete — **do not invent commands.**

## Before finishing

```bash
bun run verify
git diff
```
