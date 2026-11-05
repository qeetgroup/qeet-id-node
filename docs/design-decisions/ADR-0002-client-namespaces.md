# ADR-0002: Resources as namespaces on one client

**Status:** Accepted (refines "flat client fields")

## Context

With about forty resources, the client could expose each one directly (`qeetId.users`), group them
under area objects (`qeetId.identity.users`), or offer separate clients per area.

## Decision

One client, `QeetID`, with every resource a direct property named after the resource in camelCase
(`users`, `apiKeys`, `samlConnections`). Where the API itself nests a collection under a resource, the
SDK nests too: `webhooks.deliveries`, `oauth.grants`, `oauth.devices`, `oauth.signingKeys`,
`applications.resources`, `auditLogs.anomalies`, `gdpr.erasures`, `gdpr.exports`. No other nesting.

Resource classes are named after the namespace without a suffix (`Users`, `ApiKeys`), methods are verbs
that don't repeat the resource's name (`users.create`, not `users.createUser`), and acronyms are
written as words (`Saml`, `Ldap`, `Api`). The brand keeps its own spelling: `QeetID`.

Verification that needs no API key is standalone and tree-shakeable: `constructWebhookEvent`,
`TokenVerifier`, `discover`.

## Why

- One property access to any resource, as in the Stripe and WorkOS SDKs.
- Nesting mirrors the API where the API nests, so paths and namespaces read alike.
- Standalone verifiers serve webhook receivers and resource servers that hold no API key.
