import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as sdk from "../src/index.js";

describe("the package", () => {
  it("reports the version in package.json", () => {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };
    expect(sdk.VERSION).toBe(pkg.version);
  });

  it("has no default export, only named ones", () => {
    expect("default" in sdk).toBe(false);
    expect(Object.keys(sdk).sort()).toEqual(
      [
        "ApiError",
        "AuthenticationError",
        "BadRequestError",
        "ConflictError",
        "DEFAULT_BASE_URL",
        "DEFAULT_MAX_RETRIES",
        "DEFAULT_TIMEOUT_MS",
        "DEFAULT_WEBHOOK_TOLERANCE_SECONDS",
        "InternalServerError",
        "NetworkError",
        "NotFoundError",
        "OAuthError",
        "PermissionDeniedError",
        "QeetID",
        "QeetIDError",
        "RateLimitError",
        "ServiceUnavailableError",
        "SessionRevokedError",
        "TEST_WEBHOOK_EVENT",
        "TimeoutError",
        "TokenVerificationError",
        "TokenVerifier",
        "VERSION",
        "ValidationError",
        "WEBHOOK_EVENT_TYPES",
        "WEBHOOK_HEADERS",
        "WebhookVerificationError",
        "constructWebhookEvent",
        "createTokenVerifierFromDiscovery",
        "discover",
        "signWebhookPayload",
        "verifyWebhookSignature",
      ].sort(),
    );
  });

  it("puts every resource on the client", () => {
    const client = new sdk.QeetID();
    for (const name of [
      "tenants",
      "domains",
      "users",
      "groups",
      "invitations",
      "branding",
      "roles",
      "permissions",
      "relationships",
      "decisions",
      "authPolicies",
      "securityPolicies",
      "ipRules",
      "threatDetection",
      "oauth",
      "applications",
      "servicePrincipals",
      "samlConnections",
      "samlServiceProviders",
      "ldapConnections",
      "scim",
      "socialProviders",
      "adminPortalLinks",
      "apiKeys",
      "agents",
      "verifiableCredentials",
      "authHooks",
      "webhooks",
      "secrets",
      "tokenVault",
      "auditLogs",
      "analytics",
      "billing",
      "gdpr",
      "emailTemplates",
      "retention",
      "logSinks",
      "rateLimits",
    ] as const) {
      expect(typeof client[name], name).toBe("object");
    }
  });
});
