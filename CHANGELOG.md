# Changelog

All notable changes to the Qeet ID Node.js SDK are documented here. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

A rework of the whole SDK against the API as it is today. The package has never been published, so
these breaking changes ship without a major version.

### Added

- **Typed errors.** `QeetIDError` is the base of every error the SDK throws. `ApiError` carries
  `status`, `code`, `message`, `requestId`, `detail`, `fields`, `metadata`, `retryable`,
  `retryAfterSeconds` and `headers`, with a subclass per status: `BadRequestError`,
  `AuthenticationError`, `SessionRevokedError` (401 `auth.session_revoked`), `PermissionDeniedError`,
  `NotFoundError`, `ConflictError`, `ValidationError` (422), `RateLimitError`, `InternalServerError`
  and `ServiceUnavailableError`. `OAuthError` for the token endpoints' RFC 6749 errors.
  `NetworkError` and `TimeoutError` when no response came. `instanceof` works across the CommonJS
  and ES module copies of the package.
- **Retries that can't do anything twice.** Exponential backoff with jitter, honouring `Retry-After`
  up to 60 s, for retry-safe requests only: `GET`, `DELETE`, read-only POSTs and requests carrying an
  `Idempotency-Key`; after no response, a timeout, 408, 429, 500, 502, 503, 504 or `409
  idempotency.in_progress`. A 401 `auth.session_revoked` is never retried.
- **Idempotency keys** on the nine calls the API makes idempotent (`users.create`, `groups.create`,
  `invitations.create`, `servicePrincipals.create`, `apiKeys.create`, `agents.create`,
  `webhooks.create`, `billing.checkout`, `billing.payInvoice`): generated per call, or the caller's
  own through `idempotencyKey`.
- **Per-call options** on every method: `signal`, `timeoutMs`, `maxRetries`, `headers`.
- **Pagination:** paged lists return a `PagePromise` that is awaitable (one `CursorPage`) and
  async-iterable (every item). Whole lists return `{ data, truncated }`; `truncated` reports a list the
  API capped.
- **Webhook verification** of the timestamped signature: `constructWebhookEvent`,
  `verifyWebhookSignature`, `signWebhookPayload`, `WEBHOOK_HEADERS`, `WEBHOOK_EVENT_TYPES` and the
  `WebhookEvent` type. Several secrets during a rotation; a five-minute replay window by default.
- **Access-token verification:** `TokenVerifier` and `createTokenVerifierFromDiscovery`, with a
  required issuer and audience.
- **OAuth:** `clientCredentialsGrant` (with `expires_in` and `expires_at`), `authorizationCodeGrant`,
  `refreshTokenGrant`, `tokenExchangeGrant`, `deviceCodeGrant`, `cibaGrant`, `deviceAuthorization`,
  `backchannelAuthentication`, and `grants.revokeMany`.
- **Calls the API gained:** user sessions, security posture and access; role update, delete,
  permission sets and holders; group update; invitation resend; domain SSO and provisioning switches;
  webhook update, enable, secret rotation, event catalogue, failed-delivery retry and delivery
  attempts; API key, agent and service-principal secret rotation; `agents.resumeAll`;
  service-principal enable; application auth failures and RFC 8707 resources; SAML import, metadata,
  certificates, group mappings and service-provider assignments; LDAP group mappings; SCIM tokens and
  groups; social provider update and delete; AuthZEN batch evaluations and the decision log;
  auth-policy usage; audit anomalies and verification status; analytics ranges; billing profile,
  payment method, invoice payment and entitlements; email template test sends; log-sink tests.
- `appInfo` and `logger` client options; `VERSION`, `DEFAULT_BASE_URL`, `DEFAULT_TIMEOUT_MS` and
  `DEFAULT_MAX_RETRIES` exports.

### Changed

- **Resources renamed and regrouped** after the API's five areas, without a `Service` suffix and with
  acronyms as words: `organizations` → `tenants`, `oidc` → `applications`, `saml` → `samlConnections`,
  `samlProviders` → `samlServiceProviders`, `ldap` → `ldapConnections`, `social` → `socialProviders`,
  `credentials` → `verifiableCredentials`, `vault` → `secrets`, `adminLinks` → `adminPortalLinks`,
  `authPolicy` → `authPolicies`, `policy` → `securityPolicies`, and `botDetection`, `riskSettings` and
  `auditLogs.anomalies` (the sign-in anomalies) → `threatDetection`. Input types are named
  `<Resource><Action>Params`.
- **Request and response types follow the API documents**, field by field (users, tenants, domains,
  groups, roles, applications, SAML, LDAP, SCIM, social providers, agents, webhooks, secrets, audit,
  billing, GDPR, email templates, rate limits and more).
- **`invitations.create`** returns `{ invite }` with its `delivery`; the invitation's token is no
  longer returned.
- **`ldapConnections.authenticate`** returns `{ type: "tokens", tokens }` or
  `{ type: "mfa_challenge", challenge }`, is never retried, and sends no API key.
- **OAuth token exchange** posts to `/v1/oauth/token-code`; `/v1/oauth/token` serves
  `client_credentials` only. OAuth calls take snake_case parameters and send client credentials in
  the form body.
- **`client.sessions.verify()`** is replaced by `TokenVerifier`, which returns the token's claims as
  they are on the wire and requires an issuer and an audience.
- **`constructEvent(payload, signature, event, secret)`** is replaced by
  `constructWebhookEvent(payload, headers, secret, options)`.
- **`TokenGuard`** is created with `oauth.createTokenGuard({ audience, client_id, client_secret })`;
  a token without an audience is always refused (`allowAnyAudience` is gone).
- Default timeout 10 s → 30 s per attempt. `userAgent` option → `appInfo`.
- The base URL must use https, except for localhost.
- Arguments are checked with `TypeError`/`RangeError`; `ValidationError` now means a 422 from the API.
- Requires Node.js 22.12 or later. Built with tsdown into one file per module, ES module and CommonJS;
  checked with publint and Are the Types Wrong. TypeScript 7, Vitest 5.1, Biome 2.6.

### Removed

- Calls an API key can't make: listing and creating tenants, a user's own email and phone
  verification, the token vault's own-account calls (`listGrants`, `disconnect`), billing plans, the
  OAuth end-user decisions (`deviceContext`, `deviceDecision`, `backchannelPending`,
  `backchannelDecision`) and signing-key rotation, which the API no longer has.
- `mfa` (use `users.resetMfa`), `AuthError`, `NetworkError`'s `status: 0`, `resolveEnvelope`,
  `Envelope`, `discover(issuer, fetch)`'s old signature and `createFromDiscovery`.

### Fixed

- Lists read the API's `items`; paged ones follow `next_cursor`.
- `permissions.check` asks without `explain`; the result reads `allowed`.
- Identifiers that are empty or `.`/`..` are refused instead of addressing another endpoint.
- A cancelled call stops waiting between retries.

### Security

- The API key and client secrets are kept in private fields: they don't appear when a client is
  printed or serialised, nor in errors or logs.
- Webhook signatures are timestamped and checked for replay; token verification pins ES256 and
  requires an issuer and an audience.
- `tokenVault.getAccessToken()` stays deprecated and warns once per process: it hands out a raw
  third-party token.

## [0.1.0] — 2026-07-10

Initial release.

### Added

**Client**

- `new QeetID(config)` — one client, every resource a property directly on
  the instance (comment-banner grouped in `client.ts`: Identity /
  Authentication / Authorization / Administration — no nesting).
- `QeetIDConfig`: `apiKey`, `baseUrl`, `timeoutMs`, `maxRetries`, `headers`,
  `userAgent`, `fetch`, `logger`.
- Zero third-party runtime dependencies — only the Node.js runtime
  (`fetch`, `node:crypto`).

**Identity** — `users` (CRUD, bulk create/import, recycle-bin, MFA reset,
email/phone verification, auto-pagination), `organizations`,
`servicePrincipals`, `agents` (ephemeral tokens + full
suspend/resume/decommission/kill-all/sponsor-transfer lifecycle), `domains`.

**Authentication** — `sessions` (local ES256 JWT verification against
cached JWKS via `node:crypto`'s `webcrypto`), `oauth` (RFC 8693 token
exchange, RFC 7662 introspection, RFC 7009 revocation, an MCP token guard,
RFC 8628 device flow, CIBA, signing-key rotation, grant/device-session admin
views), `oidc` (tenant-scoped client CRUD + shadow-AI discovery/review),
`saml` (Qeet ID as SP), `samlProviders` (Qeet ID as IdP — the mirror image
of `saml`, a distinct resource despite the shared URL prefix), `scim`
(tenant-admin provisioning config), `ldap` (connections, bind test, public
authenticate passthrough), `social` (provider config, linked identities),
`mfa` (admin-initiated factor reset — the backend has no admin endpoint to
list a user's factors), `credentials` (W3C Verifiable Credentials),
`authHooks` (a multi-record collection: list/create/update-by-id/delete-by-id,
not a singleton), `authPolicy`, `policy` (an older, broader combined
security-policy record alongside `authPolicy`/`ipRules`), `ipRules` (rules, a
dry-run `check`, and enforcement on/off), `botDetection` and `riskSettings`
(new resources not yet present in the sibling Go SDK — tenant-scoped
threat-detection settings, ported directly from the backend's
`access/threat-detection` domain).

**Authorization** — `roles` (tenant-scoped create/list, user assignment,
permission grants — there is no per-role get/update/delete in the backend),
`permissions` (the platform's permission catalog, a user's effective
permissions, plus `check`/`checkAll`/`explain` — RBAC with grant-path
explanation), `groups` (membership + role bindings), `relationships`
(Zanzibar-style ReBAC: tuple CRUD, recursive `check` with `explain`, `graph`
identity-graph expansion), `decisions` (AuthZEN unified evaluation fronting
both RBAC and ReBAC).

**Administration** — `branding`, `invitations` (accepting an invite is
deliberately not wrapped — like login/signup, it's an end-user auth action),
`emailTemplates` (a fixed catalog of resolved templates — list, get,
override, reset-to-default, preview-render), `apiKeys` (create, revoke,
list — no per-key get or rotate in the backend), `vault` (encrypted secrets
store), `tokenVault` (a new resource: connected third-party OAuth accounts
held on behalf of your users, ported directly from the backend — the
browser-redirect connect/callback endpoints are deliberately not wrapped),
`webhooks` (management CRUD — most operations are scoped by the caller's own
API key, not a tenant path segment, and there is no update), `auditLogs`
(hash-chain read + whole-chain `verify` + free-text search + an `anomalies`
sub-resource backed by independently-verified backend routes, not the
sibling Go SDK's not-yet-fixed ones), `analytics` (dashboard overview),
`gdpr` (erasure + export requests), `billing`, `retention`, `rateLimits`,
`logSinks` (SIEM forwarding), `adminLinks` (delegated admin-portal links).

**Cross-cutting**

- Auto-pagination: every listable resource has an `all(...)` method
  returning an `AsyncGenerator<T>` — `for await` walks every page lazily.
- Automatic retry with exponential backoff + jitter on `429`/`5xx`
  (idempotent requests only for `5xx`).
- Every method returns a `Promise` and throws `ApiError` (HTTP failures),
  `ValidationError` (missing required arguments), or `AuthError` (local
  JWT/webhook-signature verification failures) — no result/error tuples.
- Webhook signature verification: `verifyWebhookSignature`/`constructEvent`
  (HMAC-SHA256, constant-time comparison via `node:crypto`).
- Zero-config OIDC discovery (`discover`, `createFromDiscovery`) from
  `/.well-known/openid-configuration`.
- Optional per-request `logger` observability hook — no logging dependency
  baked into the core.

### Notes

This is a from-scratch TypeScript port of the sibling
[`qeet-id-go`](https://github.com/qeetgroup/qeet-id-go) SDK, using its
already-audited-correct implementation as the source of truth for every
endpoint path and wire shape, adapted to Node/TypeScript idioms (thrown
`Promise` rejections instead of `(result, error)` tuples, async generators
instead of `iter.Seq2`, category folders instead of one flat directory —
each adaptation is documented in [docs/design-decisions/](docs/design-decisions/)).
Two resources (`tokenVault`, plus `auditLogs.anomalies`'s real routes) and
two new tenant-settings resources (`botDetection`, `riskSettings`) were
verified directly against the live Qeet ID backend's Go handler source,
ahead of the sibling Go SDK, which does not yet have them. See
[docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md) for
the folder layout and [docs/design-decisions/](docs/design-decisions/) for
every Node-specific API-shape trade-off.

[0.1.0]: https://github.com/qeetgroup/qeet-id-node/releases/tag/v0.1.0
