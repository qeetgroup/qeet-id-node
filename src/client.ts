import { DEFAULT_BASE_URL, DEFAULT_MAX_RETRIES, DEFAULT_TIMEOUT_MS, buildUserAgent, normalizeBaseUrl } from "./core/config.js";
import { HttpClient } from "./core/http.js";
import type { AppInfo, Logger } from "./core/options.js";
import { AuthPolicies } from "./resources/access/auth-policy.js";
import { Decisions } from "./resources/access/decisions.js";
import { IpRules } from "./resources/access/ip-rules.js";
import { Permissions } from "./resources/access/permissions.js";
import { Relationships } from "./resources/access/relationships.js";
import { Roles } from "./resources/access/roles.js";
import { SecurityPolicies } from "./resources/access/security-policy.js";
import { ThreatDetection } from "./resources/access/threat-detection.js";
import { Agents } from "./resources/developer/agents.js";
import { ApiKeys } from "./resources/developer/api-keys.js";
import { AuthHooks } from "./resources/developer/auth-hooks.js";
import { Secrets } from "./resources/developer/secrets.js";
import { TokenVault } from "./resources/developer/token-vault.js";
import { VerifiableCredentials } from "./resources/developer/verifiable-credentials.js";
import { Webhooks } from "./resources/developer/webhooks.js";
import { AdminPortalLinks } from "./resources/federation/admin-portal-links.js";
import { Applications } from "./resources/federation/applications.js";
import { LdapConnections } from "./resources/federation/ldap.js";
import { OAuth } from "./resources/federation/oauth.js";
import { SamlConnections, SamlServiceProviders } from "./resources/federation/saml.js";
import { Scim } from "./resources/federation/scim.js";
import { ServicePrincipals } from "./resources/federation/service-principals.js";
import { SocialProviders } from "./resources/federation/social-providers.js";
import { Branding } from "./resources/identity/branding.js";
import { Domains } from "./resources/identity/domains.js";
import { Groups } from "./resources/identity/groups.js";
import { Invitations } from "./resources/identity/invitations.js";
import { Tenants } from "./resources/identity/tenants.js";
import { Users } from "./resources/identity/users.js";
import { Analytics } from "./resources/operations/analytics.js";
import { AuditLogs } from "./resources/operations/audit-logs.js";
import { Billing } from "./resources/operations/billing.js";
import { EmailTemplates } from "./resources/operations/email-templates.js";
import { Gdpr } from "./resources/operations/gdpr.js";
import { LogSinks } from "./resources/operations/log-sinks.js";
import { RateLimits } from "./resources/operations/rate-limits.js";
import { Retention } from "./resources/operations/retention.js";

/** Configures a `QeetID` client. */
export interface QeetIDOptions {
  /**
   * A server-side API key (`qk_…`), sent as `Authorization: ApiKey <key>`.
   * Keep it out of browsers, source control and logs. Optional for the calls
   * that authenticate otherwise (the OAuth endpoints, directory sign-in,
   * credential verification); every management call needs it.
   */
  apiKey?: string;
  /** The API's base URL. Default `https://api.id.qeet.in`. Must be https, except for localhost. */
  baseUrl?: string;
  /** How long each attempt may take, in milliseconds, response body included. Default 30 000. */
  timeoutMs?: number;
  /** How many times a retry-safe request is retried after a transient failure. Default 2; 0 disables retries. */
  maxRetries?: number;
  /** Headers sent with every request, such as tracing headers. They can't replace the SDK's own. */
  headers?: Record<string, string>;
  /** Identifies your application in the `User-Agent`. */
  appInfo?: AppInfo;
  /** Receives diagnostic messages. Never given credentials or bodies. */
  logger?: Logger;
  /** Replaces the global `fetch`: for a proxy, custom TLS, or tests. */
  fetch?: typeof fetch;
}

/**
 * The Qeet ID API client. Create one per process and reuse it: it is safe
 * for concurrent use and holds no per-request state.
 *
 * ```ts
 * import { QeetID } from "@qeet-id/node";
 *
 * const qeetId = new QeetID({ apiKey: process.env.QEET_ID_API_KEY });
 * const user = await qeetId.users.get("4b1c…");
 * ```
 */
export class QeetID {
  /** The base URL requests go to. */
  readonly baseUrl: string;

  // Identity: the organisation, its people and groups.
  readonly tenants: Tenants;
  readonly domains: Domains;
  readonly users: Users;
  readonly groups: Groups;
  readonly invitations: Invitations;
  readonly branding: Branding;

  // Access: who may do what, and how people sign in.
  readonly roles: Roles;
  readonly permissions: Permissions;
  readonly relationships: Relationships;
  readonly decisions: Decisions;
  readonly authPolicies: AuthPolicies;
  readonly securityPolicies: SecurityPolicies;
  readonly ipRules: IpRules;
  readonly threatDetection: ThreatDetection;

  // Federation: OAuth/OpenID Connect, SAML, directories, SCIM, social sign-in.
  readonly oauth: OAuth;
  readonly applications: Applications;
  readonly servicePrincipals: ServicePrincipals;
  readonly samlConnections: SamlConnections;
  readonly samlServiceProviders: SamlServiceProviders;
  readonly ldapConnections: LdapConnections;
  readonly scim: Scim;
  readonly socialProviders: SocialProviders;
  readonly adminPortalLinks: AdminPortalLinks;

  // Developer: API keys, agents, credentials, hooks, webhooks, secrets.
  readonly apiKeys: ApiKeys;
  readonly agents: Agents;
  readonly verifiableCredentials: VerifiableCredentials;
  readonly authHooks: AuthHooks;
  readonly webhooks: Webhooks;
  readonly secrets: Secrets;
  readonly tokenVault: TokenVault;

  // Operations: audit, analytics, billing, compliance and limits.
  readonly auditLogs: AuditLogs;
  readonly analytics: Analytics;
  readonly billing: Billing;
  readonly gdpr: Gdpr;
  readonly emailTemplates: EmailTemplates;
  readonly retention: Retention;
  readonly logSinks: LogSinks;
  readonly rateLimits: RateLimits;

  constructor(options: QeetIDOptions = {}) {
    if (options.apiKey !== undefined && (typeof options.apiKey !== "string" || options.apiKey.trim() === "")) {
      throw new TypeError("apiKey must be a non-empty string when given.");
    }
    this.baseUrl = normalizeBaseUrl(options.baseUrl ?? DEFAULT_BASE_URL);
    const fetchImpl = options.fetch ?? globalThis.fetch;
    if (typeof fetchImpl !== "function") throw new TypeError("No fetch implementation: pass `fetch`, or run on Node.js 22 or later.");
    const http = new HttpClient({
      apiKey: options.apiKey?.trim(),
      baseUrl: this.baseUrl,
      timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      maxRetries: options.maxRetries ?? DEFAULT_MAX_RETRIES,
      fetch: fetchImpl,
      headers: options.headers ?? {},
      userAgent: buildUserAgent(options.appInfo),
      logger: options.logger,
    });

    this.tenants = new Tenants(http);
    this.domains = new Domains(http);
    this.users = new Users(http);
    this.groups = new Groups(http);
    this.invitations = new Invitations(http);
    this.branding = new Branding(http);

    this.roles = new Roles(http);
    this.permissions = new Permissions(http);
    this.relationships = new Relationships(http);
    this.decisions = new Decisions(http);
    this.authPolicies = new AuthPolicies(http);
    this.securityPolicies = new SecurityPolicies(http);
    this.ipRules = new IpRules(http);
    this.threatDetection = new ThreatDetection(http);

    this.oauth = new OAuth(http);
    this.applications = new Applications(http);
    this.servicePrincipals = new ServicePrincipals(http);
    this.samlConnections = new SamlConnections(http);
    this.samlServiceProviders = new SamlServiceProviders(http);
    this.ldapConnections = new LdapConnections(http);
    this.scim = new Scim(http);
    this.socialProviders = new SocialProviders(http);
    this.adminPortalLinks = new AdminPortalLinks(http);

    this.apiKeys = new ApiKeys(http);
    this.agents = new Agents(http);
    this.verifiableCredentials = new VerifiableCredentials(http);
    this.authHooks = new AuthHooks(http);
    this.webhooks = new Webhooks(http);
    this.secrets = new Secrets(http);
    this.tokenVault = new TokenVault(http);

    this.auditLogs = new AuditLogs(http);
    this.analytics = new Analytics(http);
    this.billing = new Billing(http);
    this.gdpr = new Gdpr(http);
    this.emailTemplates = new EmailTemplates(http);
    this.retention = new Retention(http);
    this.logSinks = new LogSinks(http);
    this.rateLimits = new RateLimits(http);
  }
}
