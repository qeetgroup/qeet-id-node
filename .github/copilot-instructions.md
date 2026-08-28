# GitHub Copilot — qeet-id-node

**Canonical instructions: [`AGENTS.md`](../AGENTS.md).** This file is a summary; it adds no
architecture.

## Repository

The server-side **Node/TypeScript SDK for Qeet ID** — `@qeet-id/node`. Node ≥18.17, pnpm, **zero runtime dependencies**, dual ESM/CJS via tsup. It wraps a contract owned by `qeet-id-server`.

Context: **L0** `qeet-context` (organization) → **L1** `qeet-id-context` (product) → **L2** this
repository → source.

## Structure

Resources live in category folders `src/{identity,authentication,authorization,administration}/` but are exposed **flat** on the client (`client.users`, `client.apiKeys`). Shared machinery: `src/{transport,utils,errors,types}/`. A resource must be re-exported from its category `index.ts` **and** reachable from `src/index.ts`.

## Rules

1. **Zero runtime dependencies.** devDependencies are fine; a runtime dependency is a decision.
2. **Every method throws** — never a `(result, error)` tuple (ADR-0003). Four classes: `ApiError`, `NetworkError`, `ValidationError`, `AuthError`.
3. **Wire fields stay `snake_case`** (ADR-0004). Do not camelCase them — note the React SDK deliberately does the opposite.
4. **Never invent an endpoint.** Verify against the real handler in `qeet-id-server`.
5. **Retry idempotency is a safety rule:** 429 always; 5xx only on GET/DELETE. Never make POST/PATCH/PUT retryable.
6. **Never weaken** `src/utils/jwt.ts` (JWKS/ES256) or `src/utils/webhook.ts` (HMAC).

## Commands

`pnpm install` · `pnpm check` · `pnpm build` · `pnpm test` · `pnpm typecheck` · `pnpm lint`

## Do not

- suggest adding a runtime dependency
- return a `(result, error)` tuple — throw instead
- camelCase a wire-shape interface field
- make a non-idempotent HTTP method retryable
- log, embed, or echo an API key — including inside a thrown error
- invent scripts — read `package.json`
