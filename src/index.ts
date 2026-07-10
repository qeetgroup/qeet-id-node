/**
 * The official server-side Node.js/TypeScript SDK for Qeet ID — the
 * passkeys-first identity platform: manage users, organizations, roles, and
 * every other management resource; run authorization checks; and verify
 * sessions/JWTs and webhook signatures.
 *
 * Authenticate with a secret API key (`qk_…`); never embed it in
 * browser/client-side code. The package has zero third-party runtime
 * dependencies — only the Node.js runtime (`fetch`, `node:crypto`).
 *
 *   import { QeetID } from "@qeet-id/node";
 *
 *   const client = new QeetID({ apiKey: process.env.QEETID_API_KEY! });
 *   const claims = await client.sessions.verify(token);
 *   const allowed = await client.permissions.check({
 *     user: claims.userId!, tenant: claims.tenantId!, permission: "billing:write",
 *   });
 *
 * Every resource sits directly on the client as a property — there is no
 * nesting, so every resource is one property access away: `client.users`,
 * `client.sessions`, `client.webhooks`.
 */
export { QeetID } from "./client/index.js";
export type { QeetIDConfig, RequestOpts, DiscoveryDocument } from "./client/index.js";
export { discover, createFromDiscovery } from "./client/index.js";

export { SDK_VERSION as VERSION } from "./version.js";

export { ApiError, NetworkError, ValidationError, AuthError } from "./errors/index.js";

export type { Logger, ListParams, Page, Envelope } from "./types/index.js";
export { resolveEnvelope } from "./types/index.js";

export { verifyWebhookSignature, constructEvent, WEBHOOK_SIGNATURE_HEADER, WEBHOOK_EVENT_HEADER } from "./utils/webhook.js";
export type { WebhookEvent } from "./utils/webhook.js";

export * from "./identity/index.js";
export * from "./authentication/index.js";
export * from "./authorization/index.js";
export * from "./administration/index.js";
