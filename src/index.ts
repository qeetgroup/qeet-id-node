/**
 * The server-side Node.js SDK for Qeet ID.
 *
 * ```ts
 * import { QeetID } from "@qeet-id/node";
 *
 * const qeetId = new QeetID({ apiKey: process.env.QEET_ID_API_KEY });
 * for await (const user of qeetId.users.list({ status: "active" })) {
 *   console.log(user.email);
 * }
 * ```
 *
 * @packageDocumentation
 */

export { QeetID, type QeetIDOptions } from "./client.js";
export { VERSION } from "./version.js";
export { DEFAULT_BASE_URL, DEFAULT_MAX_RETRIES, DEFAULT_TIMEOUT_MS } from "./core/config.js";
export type { AppInfo, IdempotentRequestOptions, Logger, RequestOptions } from "./core/options.js";
export type { CursorPage, CursorPageParams, ListResult, PagePromise } from "./core/pagination.js";

export {
  ApiError,
  AuthenticationError,
  BadRequestError,
  ConflictError,
  InternalServerError,
  NetworkError,
  NotFoundError,
  OAuthError,
  PermissionDeniedError,
  QeetIDError,
  RateLimitError,
  ServiceUnavailableError,
  SessionRevokedError,
  TimeoutError,
  TokenVerificationError,
  ValidationError,
  WebhookVerificationError,
} from "./core/errors.js";
export type {
  ApiErrorInit,
  FieldError,
  OAuthErrorCode,
  TokenVerificationErrorCode,
  WebhookVerificationErrorCode,
} from "./core/errors.js";

export {
  DEFAULT_WEBHOOK_TOLERANCE_SECONDS,
  WEBHOOK_HEADERS,
  constructWebhookEvent,
  signWebhookPayload,
  verifyWebhookSignature,
  type WebhookHeaders,
  type WebhookVerifyOptions,
} from "./webhooks/verify.js";
export { TEST_WEBHOOK_EVENT, WEBHOOK_EVENT_TYPES, type TestPingData, type WebhookEvent, type WebhookEventType } from "./webhooks/events.js";

export { TokenVerifier, type AccessTokenClaims, type TokenVerifierOptions } from "./tokens/verifier.js";
export { createTokenVerifierFromDiscovery, discover, type DiscoverOptions, type DiscoveryDocument } from "./discovery.js";

// Resource types. The resource classes are reached through a `QeetID` client.
export type * from "./resources/identity/tenants.js";
export type * from "./resources/identity/domains.js";
export type * from "./resources/identity/users.js";
export type * from "./resources/identity/groups.js";
export type * from "./resources/identity/invitations.js";
export type * from "./resources/identity/branding.js";
export type * from "./resources/access/roles.js";
export type * from "./resources/access/permissions.js";
export type * from "./resources/access/relationships.js";
export type * from "./resources/access/decisions.js";
export type * from "./resources/access/auth-policy.js";
export type * from "./resources/access/security-policy.js";
export type * from "./resources/access/ip-rules.js";
export type * from "./resources/access/threat-detection.js";
export type * from "./resources/federation/oauth.js";
export type * from "./resources/federation/applications.js";
export type * from "./resources/federation/service-principals.js";
export type * from "./resources/federation/saml.js";
export type * from "./resources/federation/ldap.js";
export type * from "./resources/federation/scim.js";
export type * from "./resources/federation/social-providers.js";
export type * from "./resources/federation/admin-portal-links.js";
export type * from "./resources/developer/api-keys.js";
export type * from "./resources/developer/agents.js";
export type * from "./resources/developer/verifiable-credentials.js";
export type * from "./resources/developer/auth-hooks.js";
export type * from "./resources/developer/webhooks.js";
export type * from "./resources/developer/secrets.js";
export type * from "./resources/developer/token-vault.js";
export type * from "./resources/operations/audit-logs.js";
export type * from "./resources/operations/analytics.js";
export type * from "./resources/operations/billing.js";
export type * from "./resources/operations/gdpr.js";
export type * from "./resources/operations/email-templates.js";
export type * from "./resources/operations/retention.js";
export type * from "./resources/operations/log-sinks.js";
export type * from "./resources/operations/rate-limits.js";
