# Engineering practices

The practices this SDK follows, and where each comes from. Researched on 5 November 2026. When a
practice changes, change it here first and record why.

## API shape

| Practice | How this SDK applies it | Source |
| --- | --- | --- |
| One client, resources as namespaces | `new QeetID(options)`; `qeetId.users`, `qeetId.webhooks`, … ; a few nested namespaces where the API nests (`qeetId.webhooks.deliveries`, `qeetId.oauth.grants`) | Stripe, WorkOS and Auth0 Node SDKs; [Azure: service clients](https://azure.github.io/azure-sdk/typescript_design.html) |
| Verbs from a short, fixed list; no noun repeated | `create`, `get`, `list`, `update`, `delete`, plus domain verbs (`revoke`, `rotateSecret`, `verify`); `users.create`, not `users.createUser` | [Azure: naming](https://azure.github.io/azure-sdk/typescript_design.html) ("DO NOT include the Noun when the operation is operating on the resource itself") |
| PascalCase types, camelCase members, acronyms as words | `ApiKeys`, `SamlConnections`, `LdapConnection`, `listShadowAi`; the brand `QeetID` keeps its own spelling | [Google TypeScript style guide](https://google.github.io/styleguide/tsguide.html) ("Treat abbreviations like acronyms in names as whole words") |
| Named exports only | No default export | [Google TypeScript style guide](https://google.github.io/styleguide/tsguide.html); [Azure: implementation](https://azure.github.io/azure-sdk/typescript_implementation.html) |
| Options bags; wire objects keep the wire's names | `<Resource><Action>Params` mirror the JSON (snake_case, see ADR-0004); SDK options are camelCase (`timeoutMs`, `idempotencyKey`) | Stripe Node SDK; [Azure: options bags](https://azure.github.io/azure-sdk/typescript_design.html) |
| Cancellation on every async call | `signal: AbortSignal` in every method's options | [Azure: AbortSignal](https://azure.github.io/azure-sdk/typescript_design.html) |
| Paged lists are async-iterable | `list()` returns a `PagePromise`: await it for a page, `for await` it for every item | [Azure: `PagedAsyncIterableIterator`](https://azure.github.io/azure-sdk/typescript_design.html); [Stripe auto-pagination](https://github.com/stripe/stripe-node#auto-pagination) |

## Errors

| Practice | How | Source |
| --- | --- | --- |
| One base class, one subclass per actionable status | `QeetIDError` → `ApiError` → `NotFoundError`, `RateLimitError`, …; `NetworkError`, `TimeoutError` | Stripe and Auth0 Node SDKs (`ManagementError` subclasses); [Azure: general guidelines](https://azure.github.io/azure-sdk/general_design.html) ("enough information … to take appropriate corrective action") |
| Errors carry status, code, message and request id | from the API's envelope `{"error": {"code", "message", "detail", "fields", "metadata", "retryable", "request_id"}}` and `X-Request-Id` | the server's `httpx.WriteError`; [Stripe request ids](https://github.com/stripe/stripe-node) |
| OAuth token errors in their own shape | `OAuthError` for RFC 6749 §5.2 `{error, error_description}` | [RFC 6749 §5.2](https://www.rfc-editor.org/rfc/rfc6749#section-5.2), [RFC 8628 §3.5](https://www.rfc-editor.org/rfc/rfc8628#section-3.5) |
| Argument mistakes are `TypeError`/`RangeError` | not part of the `QeetIDError` tree | [Azure: implementation](https://azure.github.io/azure-sdk/typescript_implementation.html) ("use ECMAScript built-in error types for validation failures") |
| `instanceof` survives the dual package hazard | errors are branded with `Symbol.for` and recognised across the CommonJS and ES module copies | [Node.js: packages](https://nodejs.org/api/packages.html) |

## Reliability

| Practice | How | Source |
| --- | --- | --- |
| Retry only what is safe to repeat | GET and DELETE, read-only POSTs, and requests carrying an `Idempotency-Key`; never PUT or PATCH | [RFC 9110 §9.2.2](https://www.rfc-editor.org/rfc/rfc9110#section-9.2.2); [Stripe: low-level error handling](https://docs.stripe.com/error-low-level) |
| Retry only transient failures | no response, timeout, 408, 429, 500, 502, 503, 504, and 409 `idempotency.in_progress`; never 401 `auth.session_revoked` | [Stripe: low-level error handling](https://docs.stripe.com/error-low-level); [Azure Core: retry policy](https://azure.github.io/azure-sdk/general_azurecore.html) ("DO NOT retry … 400-level … unless a retry-after header is also returned"); [Auth0 Node SDK](https://github.com/auth0/node-auth0) (408, 429, 5xx) |
| Exponential backoff with jitter; honour `Retry-After` | 0.5 s doubling to 8 s, equal jitter; `Retry-After` up to 60 s is waited out, a longer one is thrown | [AWS: Exponential backoff and jitter](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/); [RFC 9110 §10.2.3](https://www.rfc-editor.org/rfc/rfc9110#section-10.2.3) |
| Idempotency keys make creates retryable | generated per call on the nine routes the API makes idempotent, kept across that call's retries | [Stripe: idempotency](https://docs.stripe.com/error-low-level#idempotency) (stripe-node generates keys for POST retries) |
| Timeouts per attempt | 30 s default, configurable per client and per call | Stripe (80 s), WorkOS (60 s), Auth0 (60 s) defaults |

## Security

| Practice | How | Source |
| --- | --- | --- |
| Credentials never in logs, errors or `inspect` output | the API key and client secrets live in private (`#`) fields; the logger receives method, path, status, timing and request id only | [Azure: logging](https://azure.github.io/azure-sdk/general_implementation.html) (redact what isn't allow-listed) |
| No plaintext transport | `baseUrl` must be https except for localhost | — |
| Webhooks: HMAC over timestamp and body, constant-time compare, replay window | 5-minute default tolerance, every secret tried during a rotation | [Standard Webhooks](https://www.standardwebhooks.com/); the server's `internal/developer/webhooks` |
| JWT: pinned algorithm, required issuer and audience, bounded clock skew, kid-driven key refresh with a cooldown | ES256 only, `iss` and `aud` required, 30 s leeway | [RFC 8725 (JWT BCP)](https://www.rfc-editor.org/rfc/rfc8725); [RFC 9068](https://www.rfc-editor.org/rfc/rfc9068); [`jose`](https://github.com/panva/jose) `jwtVerify` semantics, done with Web Crypto to keep zero runtime dependencies |
| Client authentication by `client_secret_post` | the server doesn't form-decode Basic credentials, so the form body is the unambiguous choice | [RFC 6749 §2.3.1](https://www.rfc-editor.org/rfc/rfc6749#section-2.3.1) |

## Packaging

| Practice | How | Source |
| --- | --- | --- |
| Supported runtimes follow the Node.js schedule | `engines.node >=22.12.0`; CI on 22, 24 and 26. On 5 November 2026, 26 is Active LTS, 24 and 22 are Maintenance LTS (22 ends 30 April 2027) | [Node.js release schedule](https://github.com/nodejs/Release/blob/main/schedule.json); [previous releases](https://nodejs.org/en/about/previous-releases) |
| Dual ES module and CommonJS, conditional `exports`, `types` first | `import` → `.mjs` + `.d.mts`, `require` → `.cjs` + `.d.cts`; CommonJS kept because Jest and `module: commonjs` TypeScript projects still `require` | [Node.js: packages](https://nodejs.org/api/packages.html); [TypeScript: choosing compiler options](https://www.typescriptlang.org/docs/handbook/modules/guides/choosing-compiler-options.html); [require(esm)](https://joyeecheung.github.io/blog/2025/12/30/require-esm-in-node-js-from-experiment-to-stability/) |
| Unflattened output, `sideEffects: false` | one file per module, so bundlers drop what isn't imported | [Azure: implementation](https://azure.github.io/azure-sdk/typescript_implementation.html) ("DO NOT flatten the ESM build", "set sideEffects to false") |
| Strict compiler settings for a library | `strict`, `verbatimModuleSyntax`, `module: nodenext`, `isolatedDeclarations` | [TypeScript: choosing compiler options](https://www.typescriptlang.org/docs/handbook/modules/guides/choosing-compiler-options.html) |
| Package checks before publishing | `publint --strict` and `attw --pack .` (all resolution modes green) in `bun run verify` | [publint rules](https://publint.dev/rules); [Are the types wrong?](https://github.com/arethetypeswrong/arethetypeswrong.github.io) |
| Build tool | tsdown; tsup's README says it is no longer maintained and points to tsdown | [tsup](https://github.com/egoist/tsup); [tsdown](https://tsdown.dev/guide/) |
| Zero runtime dependencies | `fetch`, Web Crypto and `node:crypto` only | [Azure: implementation](https://azure.github.io/azure-sdk/typescript_implementation.html) ("Client libraries shouldn't have dependencies by default") |
| Provenance | `publishConfig.provenance: true`; the release workflow publishes from GitHub Actions with `id-token: write` | [npm: generating provenance statements](https://docs.npmjs.com/generating-provenance-statements) |
| Versions and history | Semantic Versioning; a Keep a Changelog `CHANGELOG.md` | [semver.org](https://semver.org/spec/v2.0.0.html); [keepachangelog.com](https://keepachangelog.com/en/1.1.0/) |
