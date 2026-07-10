import { Transport } from "../transport/http.js";
import type { QeetIDConfig } from "./config.js";

import { UsersService, OrganizationsService, DomainsService, ServicePrincipalsService, AgentsService } from "../identity/index.js";

import {
  SessionsService,
  OAuthService,
  OIDCService,
  SAMLService,
  SAMLServiceProvidersService,
  SCIMService,
  LDAPService,
  SocialService,
  MFAService,
  CredentialsService,
  AuthHooksService,
  AuthPolicyService,
  PolicyService,
  IPRulesService,
  BotDetectionService,
  RiskSettingsService,
} from "../authentication/index.js";

import { RolesService, PermissionsService, GroupsService, RelationTuplesService, AuthZENService } from "../authorization/index.js";

import {
  BrandingService,
  InvitationsService,
  EmailTemplatesService,
  WebhooksService,
  AuditLogsService,
  APIKeysService,
  VaultService,
  TokenVaultService,
  AnalyticsService,
  GDPRService,
  RetentionService,
  BillingService,
  RateLimitsService,
  LogSinksService,
  AdminLinksService,
} from "../administration/index.js";

/**
 * The Qeet ID API client. Construct once with `new QeetID(config)` and
 * reuse it; it is safe for concurrent use. Every resource sits directly on
 * the instance as a property — there is no nesting, so every resource is
 * one property access away: `client.users`, `client.sessions`,
 * `client.webhooks`.
 */
export class QeetID {
  private readonly transport: Transport;

  // Identity — who exists: human users, organizations, and machine identities.
  readonly users: UsersService;
  readonly organizations: OrganizationsService;
  readonly servicePrincipals: ServicePrincipalsService;
  readonly agents: AgentsService;
  readonly domains: DomainsService;

  // Authentication — proving who's calling: sessions, federation protocols,
  // and their supporting policy.
  readonly sessions: SessionsService;
  readonly oauth: OAuthService;
  readonly oidc: OIDCService;
  readonly saml: SAMLService;
  readonly samlProviders: SAMLServiceProvidersService;
  readonly scim: SCIMService;
  readonly ldap: LDAPService;
  readonly social: SocialService;
  readonly mfa: MFAService;
  readonly credentials: CredentialsService;
  readonly authHooks: AuthHooksService;
  readonly authPolicy: AuthPolicyService;
  readonly policy: PolicyService;
  readonly ipRules: IPRulesService;
  readonly botDetection: BotDetectionService;
  readonly riskSettings: RiskSettingsService;

  // Authorization — what an authenticated caller is allowed to do.
  readonly roles: RolesService;
  readonly permissions: PermissionsService;
  readonly groups: GroupsService;
  readonly relationships: RelationTuplesService;
  readonly decisions: AuthZENService;

  // Administration — tenant operations: branding, developer tooling,
  // compliance, and billing for the Qeet ID platform itself.
  readonly branding: BrandingService;
  readonly invitations: InvitationsService;
  readonly emailTemplates: EmailTemplatesService;
  readonly apiKeys: APIKeysService;
  readonly vault: VaultService;
  readonly tokenVault: TokenVaultService;
  readonly webhooks: WebhooksService;
  readonly auditLogs: AuditLogsService;
  readonly analytics: AnalyticsService;
  readonly gdpr: GDPRService;
  readonly billing: BillingService;
  readonly retention: RetentionService;
  readonly rateLimits: RateLimitsService;
  readonly logSinks: LogSinksService;
  readonly adminLinks: AdminLinksService;

  constructor(config: QeetIDConfig) {
    const t = new Transport({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      timeoutMs: config.timeoutMs,
      maxRetries: config.maxRetries,
      headers: config.headers,
      userAgent: config.userAgent,
      logger: config.logger,
      fetch: config.fetch,
    });
    this.transport = t;

    this.users = new UsersService(t);
    this.organizations = new OrganizationsService(t);
    this.servicePrincipals = new ServicePrincipalsService(t);
    this.agents = new AgentsService(t);
    this.domains = new DomainsService(t);

    this.sessions = new SessionsService(t.getBaseUrl(), config.fetch ?? t.getFetch());
    this.oauth = new OAuthService(t);
    this.oidc = new OIDCService(t);
    this.saml = new SAMLService(t);
    this.samlProviders = new SAMLServiceProvidersService(t);
    this.scim = new SCIMService(t);
    this.ldap = new LDAPService(t);
    this.social = new SocialService(t);
    this.mfa = new MFAService(t);
    this.credentials = new CredentialsService(t);
    this.authHooks = new AuthHooksService(t);
    this.authPolicy = new AuthPolicyService(t);
    this.policy = new PolicyService(t);
    this.ipRules = new IPRulesService(t);
    this.botDetection = new BotDetectionService(t);
    this.riskSettings = new RiskSettingsService(t);

    this.roles = new RolesService(t);
    this.permissions = new PermissionsService(t);
    this.groups = new GroupsService(t);
    this.relationships = new RelationTuplesService(t);
    this.decisions = new AuthZENService(t);

    this.branding = new BrandingService(t);
    this.invitations = new InvitationsService(t);
    this.emailTemplates = new EmailTemplatesService(t);
    this.apiKeys = new APIKeysService(t);
    this.vault = new VaultService(t);
    this.tokenVault = new TokenVaultService(t);
    this.webhooks = new WebhooksService(t);
    this.auditLogs = new AuditLogsService(t);
    this.analytics = new AnalyticsService(t);
    this.gdpr = new GDPRService(t);
    this.billing = new BillingService(t);
    this.retention = new RetentionService(t);
    this.rateLimits = new RateLimitsService(t);
    this.logSinks = new LogSinksService(t);
    this.adminLinks = new AdminLinksService(t);
  }

  /** The configured base URL — used internally by `discover`/`createFromDiscovery`. */
  getBaseUrl(): string {
    return this.transport.getBaseUrl();
  }

  /** The configured fetch implementation — used internally by `discover`/`createFromDiscovery`. */
  getFetch(): typeof fetch {
    return this.transport.getFetch();
  }

  /** Repoints `sessions` verification at a new JWKS endpoint (used by `createFromDiscovery`). */
  setSessionsJwksUrl(url: string): void {
    this.sessions.setJwksUrl(url);
  }
}
