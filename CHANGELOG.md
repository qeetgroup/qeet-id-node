# Changelog

All notable changes to the Qeet ID Node.js SDK are documented here. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
