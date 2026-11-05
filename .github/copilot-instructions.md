# GitHub Copilot — qeet-id-node

**Canonical instructions: [`AGENTS.md`](../AGENTS.md).** This file is a summary; it adds no
architecture.

## Repository

The server-side **Node.js/TypeScript SDK for Qeet ID** — `@qeet-id/node`. Node.js 22.12+, bun, Biome,
**zero runtime dependencies**, ES module and CommonJS builds via tsdown. It wraps a contract owned by
`qeet-id-server`.

## Structure

`src/client.ts` (the `QeetID` client) · `src/core/` (HTTP, errors, retries, pagination) ·
`src/resources/{identity,access,federation,developer,operations}/` (one folder per OpenAPI document) ·
`src/webhooks/` (delivery verification) · `src/tokens/` (access-token verification) ·
`src/index.ts` (every export).

## Rules

1. **Zero runtime dependencies.**
2. **Every method throws**; SDK errors extend `QeetIDError`.
3. **Wire fields stay `snake_case`**; options are camelCase.
4. **Only routes an API key may call.**
5. **Retries never repeat a write:** GET, DELETE, `retrySafe` POSTs and idempotency-keyed requests only.
6. **Never weaken** webhook or token verification.

## Commands

`bun install` · `bun run verify` · `bun run build` · `bun run test` · `bun run typecheck` · `bun run check`

## Do not

- suggest adding a runtime dependency
- return a `(result, error)` tuple — throw instead
- camelCase a wire field
- make PUT, PATCH, a non-idempotent POST, an OAuth grant or directory sign-in retryable
- log, embed or echo an API key or client secret — including inside a thrown error
- invent scripts — read `package.json`
