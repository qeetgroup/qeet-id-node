# Contributing

## Setup

```bash
git clone https://github.com/qeetgroup/qeet-id-node
cd qeet-id-node
bun install
bun run verify   # typecheck + Biome + tests + build + publint + attw
```

Requires Node.js 22.12 or later and bun (`packageManager` in `package.json`).

## Conventions

- **The contract is the server's.** Every route comes from `qeet-id-server`'s OpenAPI documents, and
  must be one an API key may call (check `internal/bootstrap/permissions.go`). Where a document is
  ambiguous, the server's handler decides.
- **One folder per API area** under `src/resources/` (ADR-0001); one class per namespace on `QeetID`
  (ADR-0002).
- **Names:** PascalCase types, camelCase methods, acronyms as words (`ApiKeys`, `SamlConnection`),
  `<Resource><Action>Params` for inputs, no repeated nouns (`users.create`).
- **Wire objects keep the wire's snake_case** (ADR-0004); SDK options are camelCase.
- **Every method throws** (ADR-0003). Use the `path` tag for paths; let the core make errors.
- **Retries:** mark a POST `retrySafe` only if repeating it changes nothing; mark `idempotent` only the
  routes the server lists as idempotent (ADR-0005).
- **Zero runtime dependencies.** Raise it before adding one.
- **No credentials** in errors, logs, tests' output or examples.

## Tests

```bash
bun run test           # vitest run
bun run test:coverage
```

Every method has a row in `test/resources/requests.test.ts` (method, path, body). Behaviour gets its
own test. Use `test/helpers/mock-fetch.ts`. Webhook fixtures are captured from the server's own
signing code; never edit them by hand.

## Reporting bugs

Open an issue with the call, what you expected, what happened, and the `requestId` of the error.
