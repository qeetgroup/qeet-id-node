# Qeet ID Node.js SDK

The official server-side SDK for Qeet ID, the passkeys-first identity platform.
Manage an organisation's users, groups, roles and connections, check permissions, verify webhooks
and access tokens, and run OAuth flows, from Node.js.

- Typed: every request, response, error code and event.
- Safe by default: retries only what can't happen twice, never logs a credential, verifies webhooks
  and tokens strictly.
- No runtime dependencies. ES module and CommonJS builds.

> Use it on servers only. It authenticates with a secret API key that must never reach a browser.

## Contents

[Install](#install) · [Quick start](#quick-start) · [Configuration](#configuration) ·
[Resources](#resources) · [Errors](#errors) · [Retries and timeouts](#retries-and-timeouts) ·
[Idempotency](#idempotency) · [Pagination](#pagination) · [Webhooks](#webhooks) ·
[Access tokens](#access-tokens) · [OAuth](#oauth) · [Directory sign-in](#directory-sign-in) ·
[Logging](#logging) · [TypeScript and modules](#typescript-and-modules) · [Versioning](#versioning)

## Install

```sh
npm install @qeet-id/node
# or: bun add @qeet-id/node · pnpm add @qeet-id/node · yarn add @qeet-id/node
```

Requires Node.js 22.12 or later (Node.js 22, 24 and 26 are tested).

## Quick start

Create an API key in the Qeet ID console and keep it in a secret store.

```ts
import { QeetID } from "@qeet-id/node";

const qeetId = new QeetID({ apiKey: process.env.QEET_ID_API_KEY });
const tenantId = process.env.QEET_ID_TENANT_ID!;

const user = await qeetId.users.create({
  tenant_id: tenantId,
  email: "meera@brightleaffoods.in",
  display_name: "Meera Iyer",
});

await qeetId.roles.assign(tenantId, user.id, financeRoleId);

const allowed = await qeetId.permissions.check({ user_id: user.id, tenant_id: tenantId, permission: "invoice.approve" });
```

Create one client per process and share it: it is safe for concurrent use.

## Configuration

```ts
const qeetId = new QeetID({
  apiKey: process.env.QEET_ID_API_KEY, // sent as "Authorization: ApiKey <key>"
  baseUrl: "https://api.id.qeet.in",   // the default; https only, except for localhost
  timeoutMs: 30_000,                   // per attempt, response body included
  maxRetries: 2,                       // 0 turns retries off
  appInfo: { name: "brightleaf-onboarding", version: "1.4.0" }, // added to the User-Agent
  headers: { "x-correlation-id": "…" },                        // sent on every request
  logger: console,                     // optional; see Logging
  fetch: myFetch,                      // optional; for a proxy, custom TLS or tests
});
```

| Option | Default | |
| --- | --- | --- |
| `apiKey` | none | Needed by every management call. The OAuth token endpoints, directory sign-in and credential verification authenticate otherwise and work without it. |
| `baseUrl` | `https://api.id.qeet.in` | Must be `https`; plain `http` is allowed only for `localhost` and `*.localhost`. |
| `timeoutMs` | `30000` | Each attempt's limit. |
| `maxRetries` | `2` | Retries after a transient failure, for retry-safe requests only. |
| `headers` | `{}` | Can't replace `Authorization`, `Accept`, `Content-Type`, `User-Agent` or `Idempotency-Key`. |
| `appInfo` | none | `{ name, version?, url? }`, prepended to the User-Agent. |
| `logger` | none | Any object with `debug`, `info`, `warn`, `error`. |
| `fetch` | global `fetch` | |

Every method takes an options object last, overriding the client for that call:

```ts
await qeetId.users.get(userId, { timeoutMs: 5_000, maxRetries: 0, signal: AbortSignal.timeout(8_000) });
```

## Resources

Methods are grouped by namespace. Identifiers come first, then the request body, then options.
Request and response objects keep the API's field names (`display_name`, `created_at`).

| Area | Namespaces |
| --- | --- |
| Identity | `tenants` (the organisation) · `domains` · `users` · `groups` · `invitations` · `branding` |
| Access | `roles` · `permissions` · `relationships` (ReBAC tuples) · `decisions` (OpenID AuthZEN) · `authPolicies` · `securityPolicies` · `ipRules` · `threatDetection` (bots, risk, anomalies) |
| Federation | `oauth` · `applications` (OAuth/OpenID clients and RFC 8707 resources) · `servicePrincipals` · `samlConnections` · `samlServiceProviders` · `ldapConnections` · `scim` · `socialProviders` · `adminPortalLinks` |
| Developer | `apiKeys` · `agents` · `verifiableCredentials` · `authHooks` · `webhooks` · `secrets` · `tokenVault` |
| Operations | `auditLogs` · `analytics` · `billing` · `gdpr` · `emailTemplates` · `retention` · `logSinks` · `rateLimits` |

```ts
const page = await qeetId.auditLogs.list(tenantId, { action: "user.deleted", from: "2026-11-01T00:00:00Z" });
await qeetId.webhooks.update(tenantId, webhookId, { events: ["user.created", "user.deleted"] });
const { secret } = await qeetId.webhooks.rotateSecret(tenantId, webhookId);
const { data: secrets, truncated } = await qeetId.secrets.list(tenantId);
```

The SDK covers the calls an API key may make. A person's own account (their sessions, factors,
passkeys, email changes) is managed by that person through the hosted pages, not from a server.

## Errors

Every failure is thrown. Errors the SDK makes are `QeetIDError`s:

```text
QeetIDError
├── ApiError                     the API answered with an error
│   ├── BadRequestError          400
│   ├── AuthenticationError      401
│   │   └── SessionRevokedError  401 auth.session_revoked
│   ├── PermissionDeniedError    403
│   ├── NotFoundError            404
│   ├── ConflictError            409
│   ├── ValidationError          422 (see fields)
│   ├── RateLimitError           429 (see retryAfterSeconds)
│   ├── InternalServerError      5xx
│   │   └── ServiceUnavailableError 503 (see retryAfterSeconds)
│   └── OAuthError               an OAuth token endpoint's RFC 6749 error
├── NetworkError                 no response
│   └── TimeoutError             no response in time
├── WebhookVerificationError
└── TokenVerificationError
```

An `ApiError` has `status`, `code` (a stable string such as `user.domain_managed_elsewhere`: branch on
it, never on `message`), `message` (safe to show a person), `requestId` (quote it to support),
`detail`, `fields` (per-field problems on a 422), `metadata`, `retryable` (the server's hint),
`retryAfterSeconds` and `headers`.

```ts
import { ConflictError, NotFoundError, RateLimitError, ValidationError } from "@qeet-id/node";

try {
  await qeetId.users.create({ tenant_id: tenantId, email });
} catch (error) {
  if (error instanceof ValidationError) {
    for (const field of error.fields) console.log(field.field, field.code, field.message);
  } else if (error instanceof ConflictError && error.code === "user.domain_managed_elsewhere") {
    // another organisation manages that email domain
  } else if (error instanceof RateLimitError) {
    console.log(`retry in ${error.retryAfterSeconds} s, request ${error.requestId}`);
  } else {
    throw error;
  }
}
```

A wrong argument in your code (an empty id, a malformed idempotency key) is a `TypeError` or
`RangeError`, not a `QeetIDError`. A cancelled call rejects with the signal's reason (an
`AbortError` by default).

`instanceof` works even when both the CommonJS and the ES module build of this package are loaded in
one process.

## Retries and timeouts

A request is retried, up to `maxRetries` times, only when repeating it can't do anything twice:

- **Which requests:** `GET` and `DELETE`; POSTs that change nothing (permission and relationship
  checks, AuthZEN evaluations, previews, introspection); and requests carrying an `Idempotency-Key`.
  `PUT`, `PATCH` and other POSTs are never retried, and neither are OAuth grants or directory
  sign-ins.
- **Which failures:** no response, a timeout, `408`, `429`, `500`, `502`, `503`, `504`, and `409
  idempotency.in_progress`.
- **Never:** `401 auth.session_revoked`. The session has ended; only a new sign-in helps, whatever
  the server's `retryable` hint says.
- **How long:** the server's `Retry-After` when it sends one (up to 60 seconds; a longer one is thrown
  as is), otherwise exponential backoff from 0.5 s to 8 s with jitter.

Each attempt has its own `timeoutMs`. Use an `AbortSignal` to bound the whole call, retries included:

```ts
await qeetId.users.get(userId, { signal: AbortSignal.timeout(10_000) });
```

## Idempotency

The API makes nine calls idempotent: `users.create`, `groups.create`, `invitations.create`,
`servicePrincipals.create`, `apiKeys.create`, `agents.create`, `webhooks.create`, `billing.checkout`
and `billing.payInvoice`. The SDK sends each with an `Idempotency-Key`, generating one per call, so its
own retries never create twice. Pass your own key to make retries across calls, deployments or
processes safe too:

```ts
await qeetId.users.create(
  { tenant_id: tenantId, email: "meera@brightleaffoods.in" },
  { idempotencyKey: `onboarding-${employee.id}` }, // 1 to 255 printable ASCII characters
);
```

The API keeps an answer for 24 hours. The same key with a different body is refused (`422
idempotency.key_reused`); a key whose first request is still running gets `409
idempotency.in_progress` (retried automatically); a key whose first request was interrupted gets
`409 idempotency.outcome_unknown`: check whether it took effect before trying again with a new key.

## Pagination

Lists the API pages (users, audit log, consent grants, SCIM users and groups, anomalies, decisions,
webhook deliveries, relationship objects) return a `PagePromise`. Await it for one page, or iterate it
for every item; later pages are fetched as you go:

```ts
for await (const user of qeetId.users.list({ status: "active", limit: 100 })) {
  console.log(user.email);
}

const page = await qeetId.users.list({ limit: 50 });
page.data;          // this page's users
page.nextCursor;    // pass as `cursor` later, or:
if (page.hasNextPage()) await page.getNextPage();
for await (const p of page.iterPages()) console.log(p.data.length);
```

Other lists come whole, as `{ data, truncated }`. `truncated` is `true` when the API capped the list
and more items exist than `data` holds.

## Webhooks

Each delivery is a signed POST whose body is an event:

```json
{ "id": "…", "type": "user.created", "tenant_id": "…", "occurred_at": "2026-11-05T09:30:00Z", "data": { … } }
```

`X-Qeet-Signature` is `sha256=` and the hex HMAC-SHA256, keyed by the subscription's secret, of
`X-Qeet-Timestamp`, `.` and the raw body. `constructWebhookEvent` checks it in constant time, refuses
a delivery signed more than five minutes from now (`toleranceSeconds` changes that) and returns the
typed event. Always pass the **raw** body: a parsed and re-serialised one won't match.

**Express**

```ts
import express from "express";
import { constructWebhookEvent, WebhookVerificationError } from "@qeet-id/node";

app.post("/webhooks/qeet-id", express.raw({ type: "application/json" }), async (req, res) => {
  let event;
  try {
    event = constructWebhookEvent(req.body, req.headers, process.env.QEET_ID_WEBHOOK_SECRET!);
  } catch (error) {
    if (error instanceof WebhookVerificationError) return res.status(400).send(error.code);
    throw error;
  }
  if (await alreadyHandled(event.id)) return res.sendStatus(204); // deliveries can repeat
  if (event.type === "user.deleted") await removeLocalData(event.data);
  res.sendStatus(204);
});
```

**Next.js route handler, or any Fetch API server**

```ts
export async function POST(request: Request) {
  const body = await request.text();
  const event = constructWebhookEvent(body, request.headers, process.env.QEET_ID_WEBHOOK_SECRET!);
  // …
  return new Response(null, { status: 204 });
}
```

- **Rotating the secret:** `webhooks.rotateSecret()` returns a new secret; for 24 hours deliveries are
  signed with both. Pass both meanwhile: `constructWebhookEvent(body, headers, [newSecret, oldSecret])`.
- **Duplicates:** an event's `id` is the same in every delivery of it, retries included.
- **Unknown events:** `event.type` may be newer than this SDK; ignore what you don't handle.
  `WEBHOOK_EVENT_TYPES` lists the events this version knows.
- **Testing your handler:** `signWebhookPayload(body, secret)` signs a body the way Qeet ID does.
- Don't trust `X-Qeet-Event`: it isn't signed. Read `event.type`.

`WebhookVerificationError.code` says why a delivery was refused: `missing_secret`,
`missing_signature`, `missing_timestamp`, `invalid_timestamp`, `timestamp_outside_tolerance`,
`invalid_signature_header`, `signature_mismatch` or `invalid_payload`.

## Access tokens

To accept Qeet ID access tokens in your own API, verify them locally against the issuer's signing keys:

```ts
import { createTokenVerifierFromDiscovery, TokenVerificationError } from "@qeet-id/node";

const verifier = await createTokenVerifierFromDiscovery({ audience: "https://api.brightleaffoods.in" });

const claims = await verifier.verify(bearerToken); // throws TokenVerificationError
claims.sub; claims.tenant_id; claims.scope;
```

Or configure it directly: `new TokenVerifier({ issuer, audience, jwksUrl })`. Both `issuer` and
`audience` are required: the audience is your service's RFC 8707 resource identifier (registered with
`applications.resources.create`), or the platform audience. The verifier accepts ES256 only, needs a
known `kid`, checks the signature, `iss`, `aud`, `exp`, `nbf` and `iat` (with 30 seconds of clock
tolerance, `clockToleranceSeconds`), caches the keys for five minutes and refetches them for an unknown
`kid` at most every 30 seconds.

A token verified offline stays valid until it expires, even if its session was revoked. Where
revocation must take effect at once, introspect instead:

```ts
const guard = qeetId.oauth.createTokenGuard({
  audience: "https://mcp.brightleaffoods.in",
  client_id: process.env.MCP_CLIENT_ID!,
  client_secret: process.env.MCP_CLIENT_SECRET!,
});
const claims = await guard.verify(bearerToken, ["files:read"]); // AuthenticationError or PermissionDeniedError
```

## OAuth

```ts
// Machine-to-machine: a service principal's token (POST /v1/oauth/token).
const token = await qeetId.oauth.clientCredentialsGrant({ client_id, client_secret });
token.access_token; token.expires_in; token.expires_at;

// The other grants (POST /v1/oauth/token-code).
await qeetId.oauth.authorizationCodeGrant({ client_id, client_secret, code, redirect_uri, code_verifier });
await qeetId.oauth.refreshTokenGrant({ client_id, client_secret, refresh_token });
await qeetId.oauth.tokenExchangeGrant({ client_id, client_secret, subject_token, actor_token, scope });
await qeetId.oauth.deviceCodeGrant({ client_id, device_code });
await qeetId.oauth.cibaGrant({ client_id, client_secret, auth_req_id });

await qeetId.oauth.introspect(token, { client_id, client_secret });
await qeetId.oauth.revoke(refreshToken, { client_id, client_secret });
```

The token endpoints answer errors in the RFC 6749 shape, thrown as `OAuthError` with `code` set to the
RFC `error`: `invalid_request`, `invalid_client` (status 401), `invalid_grant`, `unauthorized_client`,
`unsupported_grant_type`, `invalid_scope`, `invalid_target`, and for polling `authorization_pending`,
`slow_down`, `access_denied` and `expired_token`. Grants are never retried. Client credentials are sent
in the form body and never logged.

## Directory sign-in

`ldapConnections.authenticate` signs a person in with their directory password. The result is either
tokens or a second-factor challenge:

```ts
const result = await qeetId.ldapConnections.authenticate(connectionId, { username, password });
if (result.type === "mfa_challenge") {
  return askForSecondFactor(result.challenge.mfa_token, result.challenge.factors);
}
startSession(result.tokens);
```

## Logging

Pass a `logger` (`console`, or any object with `debug`, `info`, `warn` and `error`) to see each
request, response and retry. Messages carry the method, path, attempt, status, duration and request
id; never the API key, client secrets, query strings, headers or bodies.

## TypeScript and modules

The package ships ES module and CommonJS builds with matching type declarations; `import` and
`require` both work. Types are exported for every request, response and error code:

```ts
import type { User, UserListParams, WebhookEvent, OAuthErrorCode } from "@qeet-id/node";
```

## Versioning

The SDK follows [Semantic Versioning](https://semver.org). Changes are listed in
[CHANGELOG.md](CHANGELOG.md). `VERSION` exports the version, which is also sent in the User-Agent.

## Security

Report vulnerabilities privately to security@qeet.in; see [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
