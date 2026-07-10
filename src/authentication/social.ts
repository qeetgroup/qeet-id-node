import type { RequestOpts } from "../client/options.js";
import { resolveEnvelope, type Envelope } from "../types/common.js";
import type { Transport } from "../transport/http.js";

/**
 * A configured social-login provider (Google, GitHub, etc.). `client_secret`
 * is write-only — never returned.
 */
export interface SocialProvider {
  id: string;
  tenant_id: string;
  provider: string;
  client_id: string;
  discovery_url?: string;
  enabled: boolean;
  created_at: string;
}

export interface UpsertSocialProviderInput {
  tenant_id: string;
  provider: string;
  client_id: string;
  client_secret: string;
  discovery_url: string;
}

/** Links a user to an upstream social/OIDC provider account. */
export interface ExternalIdentity {
  id: string;
  user_id: string;
  tenant_id: string;
  provider: string;
  subject: string;
  email?: string;
  linked_at: string;
}

/**
 * Manages social-login provider configuration and the identities users have
 * linked. The browser-redirect endpoints (start/callback/exchange) belong to
 * the client-side SDK, not here.
 */
export class SocialService {
  constructor(private readonly t: Transport) {}

  async listProviders(tenantId: string, opts?: RequestOpts): Promise<SocialProvider[]> {
    const env = await this.t.get<Envelope<SocialProvider>>(`/v1/tenants/${encodeURIComponent(tenantId)}/social/providers`, opts);
    return resolveEnvelope(env);
  }

  /** Creates or updates a tenant's provider config. */
  upsertProvider(input: UpsertSocialProviderInput, opts?: RequestOpts): Promise<SocialProvider> {
    return this.t.post<SocialProvider>("/v1/social/providers", input, opts);
  }

  async listUserIdentities(userId: string, opts?: RequestOpts): Promise<ExternalIdentity[]> {
    const env = await this.t.get<Envelope<ExternalIdentity>>(`/v1/users/${encodeURIComponent(userId)}/social/identities`, opts);
    return resolveEnvelope(env);
  }

  unlinkIdentity(id: string, opts?: RequestOpts): Promise<void> {
    return this.t.delete(`/v1/social/identities/${encodeURIComponent(id)}`, opts);
  }
}
