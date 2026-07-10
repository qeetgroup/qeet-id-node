import { describe, expect, it } from "vitest";
import { QeetID } from "../../src/index.js";

/**
 * The Node analogue of the Go SDK's `TestNew_WiresEveryService`: fails
 * loudly if `new QeetID(...)` ever leaves a service property undefined —
 * the failure mode of adding a new resource to the class but forgetting to
 * construct it, which would otherwise surface as a runtime crash deep in a
 * caller's code instead of here.
 */
describe("QeetID", () => {
  it("wires every service", () => {
    const client = new QeetID({ apiKey: "qk_x.y" });

    const expectedServices = [
      // Identity
      "users",
      "organizations",
      "servicePrincipals",
      "agents",
      "domains",
      // Authentication
      "sessions",
      "oauth",
      "oidc",
      "saml",
      "samlProviders",
      "scim",
      "ldap",
      "social",
      "mfa",
      "credentials",
      "authHooks",
      "authPolicy",
      "policy",
      "ipRules",
      "botDetection",
      "riskSettings",
      // Authorization
      "roles",
      "permissions",
      "groups",
      "relationships",
      "decisions",
      // Administration
      "branding",
      "invitations",
      "emailTemplates",
      "apiKeys",
      "vault",
      "tokenVault",
      "webhooks",
      "auditLogs",
      "analytics",
      "gdpr",
      "billing",
      "retention",
      "rateLimits",
      "logSinks",
      "adminLinks",
    ] as const;

    for (const name of expectedServices) {
      expect(client[name], `client.${name} should be defined`).toBeDefined();
      expect(client[name], `client.${name} should not be null`).not.toBeNull();
    }

    // OAuth's sub-resources must also be wired.
    expect(client.oauth.signingKeys).toBeDefined();
    expect(client.oauth.grants).toBeDefined();
    expect(client.oauth.devices).toBeDefined();

    // audit-logs' anomalies sub-resource must also be wired.
    expect(client.auditLogs.anomalies).toBeDefined();
  });

  it("requires an apiKey but doesn't validate it eagerly (mirrors the Go SDK's New())", () => {
    // Constructing with an empty key never throws — the failure surfaces as
    // an authentication error on the first real request, matching every
    // other config mistake.
    expect(() => new QeetID({ apiKey: "" })).not.toThrow();
  });

  it("defaults baseUrl to the production API", () => {
    const client = new QeetID({ apiKey: "qk_test" });
    expect(client.getBaseUrl()).toBe("https://api.id.qeet.in");
  });

  it("trims a trailing slash from a custom baseUrl", () => {
    const client = new QeetID({ apiKey: "qk_test", baseUrl: "https://self-hosted.example.com/" });
    expect(client.getBaseUrl()).toBe("https://self-hosted.example.com");
  });
});
