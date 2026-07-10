# Contributing

## Setup

```bash
git clone https://github.com/qeetgroup/qeet-id-node
cd qeet-id-node
pnpm install
pnpm check   # typecheck + lint + test
```

Requires Node.js 18.17+ (global `fetch`/`webcrypto`) — see `.nvmrc` for the
version this repo is developed against.

## Conventions

- **One package, organized by category folder.** Every resource is a file
  under `src/<category>/` (`src/identity/users.ts`, `src/authentication/oauth.ts`,
  ...) — see [docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md)
  for why this beats one flat directory at this SDK's size. Every service is
  still exposed as a flat, one-hop field on the client (`client.users`, not
  `client.identity.users`) — the folders are a source-organization
  convenience, not part of the public API shape.
- **Zero third-party runtime dependencies.** Only the Node.js runtime
  (`fetch`, `node:crypto`'s `webcrypto`, `node:crypto`'s `createHmac`/
  `timingSafeEqual`) — this is a deliberate constraint, matching the Go
  SDK's stdlib-only precedent. Don't add a JWT/HTTP/validation library
  without raising it first.
- **Every method returns a rejecting `Promise`, never a `(result, error)`
  tuple.** Let `Transport` throw `ApiError`; don't catch-and-rewrap it in a
  resource file unless you're adding real information.
- **Wire-shape interface fields stay snake_case**, matching the JSON exactly
  (`created_at`, not `createdAt`) — see
  [docs/design-decisions/](docs/design-decisions/) before proposing a
  camelCase mapping layer; it was deliberately rejected because it risks
  corrupting dynamic/free-form map fields (`settings`, `context`, `raw`
  claims) that aren't a fixed schema.
- **Shared HTTP/crypto machinery lives in `src/transport/` and `src/utils/`**
  — never duplicate retry/backoff, JSON envelope-unwrapping, or JWKS logic
  in a resource file; add to those instead and import from there.
- **Match the backend, not the OpenAPI spec's generic placeholders.** Some
  backend routes have unenriched spec bodies (or the spec lags reality
  entirely) — verify the real Go handler/domain struct in the `qeet-id`
  backend repo before adding a typed response.

## Tests

Every resource file has a companion test under `test/unit/` asserting
method/path/body shape against a mocked `fetch`, using the shared helper in
`test/helpers/`. Run:

```bash
pnpm test          # vitest run
pnpm test:coverage
```

## Adding a new resource

1. Add the file under the right category folder, following an existing
   resource (e.g. `src/identity/domains.ts`) as a template: an
   `XService` class taking `Transport` in its constructor, methods on it,
   request/response interfaces.
2. Add the service instance to `QeetID` in `src/client/client.ts`, under the
   right comment banner (Identity / Authentication / Authorization /
   Administration), and re-export its types from the category's `index.ts`
   and the root `src/index.ts`.
3. Add a test with method/path/body-shape assertions.
4. Update the resource table in `README.md`.

## Reporting bugs

Open an issue with the exact method call, expected vs. actual behavior, and
(if applicable) the `requestId` from the thrown `ApiError`.
