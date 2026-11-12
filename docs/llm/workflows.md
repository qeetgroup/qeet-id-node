# Workflows — qeet-id-node

**Level:** L2 · **Last verified:** 2026-11-05
**Verification scope:** every command checked against `package.json` and `.github/workflows/`.

## Set up

```bash
bun install
bun run verify   # typecheck + Biome + tests + build + publint + attw
```

No services required — tests stub `fetch`.

## Add a method to an existing resource

```text
1  find the route        qeet-id-server api/openapi/<area>.yaml — and confirm an API key may call it:
                         internal/bootstrap/permissions.go must not list it as user-only
2  open src/resources/<area>/<resource>.ts
3  match the neighbours  an async method; identifiers first, params, then options; path`…` for the path
4  types                 <Resource><Action>Params for the body; response types from the schema, snake_case
5  retries               a write is retried only if the API makes it idempotent (idempotent: true)
                         or it changes nothing (retrySafe: true)
6  test                  a row in test/resources/requests.test.ts; behaviour in test/resources/*.test.ts
7  README and CHANGELOG
8  bun run verify
```

## Add a whole resource

```text
1  src/resources/<area>/<resource>.ts — export class <Resource> extends ApiResource
2  add a field on QeetID in src/client.ts, under its area
3  export its types: `export type * from` in src/index.ts
4  steps 6–8 above
```

## Paged lists

A route answering `{items, next_cursor}` uses `this._page(() => path\`…\`, params, options)` and
returns `PagePromise<T>`. A route answering `{items, truncated?}` uses `this._list(...)` and returns
`ListResult<T>`.

## Change transport, retries or errors

**Review required.** `src/core/{http,retry,errors}.ts`. Keep ADR-0005: never make a write retryable
without an idempotency key, never retry `auth.session_revoked`. Add a test in `test/core/`.

## Change cryptography

**Security review required.** `src/webhooks/verify.ts` or `src/tokens/verifier.ts`. Cite the RFC or
the server code; constant-time comparisons; negative tests (bad signature, wrong secret, stale
timestamp, unknown kid, wrong issuer or audience). Webhook fixtures are regenerated from the server's
own `deliver` and `sign` functions, never written by hand.

## Release

```text
1  CHANGELOG.md: move [Unreleased] under the version being released
2  bun run verify
3  raise the version in package.json (patch, minor or major) on develop, then open a pull request
   from develop into main; Verify runs on it
4  merge it: release.yml sees a version npm does not have, publishes to npm with
   provenance, then tags vX.Y.Z and opens a GitHub Release
```

A push to `main` whose version is already on npm releases nothing, so re-running is safe. A bad release
is not unpublished: point `latest` back at a good version with `npm dist-tag add <package>@<version> latest`, then release a fix.
`scripts/npm-versions.mjs` knows every version npm has ever accepted, including unpublished ones, so a
version number is never reused.

`VERSION` is written in from package.json at build time, so it always matches the published package.

## Finish any task

```bash
bun run verify
git diff
```
