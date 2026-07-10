import type { RequestOpts } from "../client/options.js";
import { resolveEnvelope, type Envelope } from "../types/common.js";
import type { Transport } from "../transport/http.js";
import { required } from "../utils/validation.js";

/**
 * Provider is a tenant's registered OAuth2 endpoint config for one
 * third-party service. `client_secret` is never returned by the API.
 */
export interface Provider {
  id: string;
  provider: string;
  client_id: string;
  authorize_url: string;
  token_url: string;
  scopes: string;
  created_at: string;
  updated_at: string;
}

export interface RegisterProviderInput {
  provider: string;
  client_id: string;
  client_secret: string;
  authorize_url: string;
  token_url: string;
  scopes?: string;
}

/** GrantMeta is the non-secret view of a connected account. */
export interface GrantMeta {
  provider: string;
  external_account_id?: string;
  scope?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

/** Wire shape of the live-access-token response. */
export interface AccessTokenResult {
  access_token: string;
}

/**
 * TokenVaultService is a per-tenant encrypted store for third-party OAuth
 * tokens (Slack, GitHub, Google, or any custom OAuth2 provider an admin
 * registers) — distinct from `VaultService`, which is a generic
 * encrypted-secrets store. A user connects their account once via a
 * standard authorization-code ceremony; from then on, a caller (typically
 * an AI agent or backend integration acting on that user's behalf) asks for
 * a live access token via `getAccessToken` and never sees — or needs to
 * handle — the underlying refresh token.
 *
 * The browser-redirect OAuth-dance endpoints (`GET
 * /v1/vault/tokens/{provider}/connect`, which starts the ceremony, and the
 * `GET /v1/vault/tokens/callback` return leg) are end-user browser flows
 * and are intentionally not wrapped here — the same exclusion reasoning
 * used throughout this SDK for login/signup/consent-redirect endpoints.
 */
export class TokenVaultService {
  constructor(private readonly t: Transport) {}

  /** Registers (or, on conflict, updates) a third-party OAuth provider config for the tenant. */
  registerProvider(tenantId: string, input: RegisterProviderInput, opts?: RequestOpts): Promise<Provider> {
    return this.t.post<Provider>(`/v1/tenants/${encodeURIComponent(tenantId)}/vault/tokens/providers`, input, opts);
  }

  async listProviders(tenantId: string, opts?: RequestOpts): Promise<Provider[]> {
    const env = await this.t.get<Envelope<Provider>>(`/v1/tenants/${encodeURIComponent(tenantId)}/vault/tokens/providers`, opts);
    return resolveEnvelope(env);
  }

  deleteProvider(tenantId: string, provider: string, opts?: RequestOpts): Promise<void> {
    return this.t.delete(`/v1/tenants/${encodeURIComponent(tenantId)}/vault/tokens/providers/${encodeURIComponent(provider)}`, opts);
  }

  /**
   * Lists the caller's own connected-account grants. Tenant and user are
   * resolved from the authenticated principal (never from a path segment or
   * body), matching the implicit-scoping pattern used elsewhere (e.g. the
   * Go SDK's `WebhooksService.Create`/`Get`/`Delete`).
   */
  async listGrants(opts?: RequestOpts): Promise<GrantMeta[]> {
    const env = await this.t.get<Envelope<GrantMeta>>("/v1/vault/tokens", opts);
    return resolveEnvelope(env);
  }

  /**
   * Returns a live access token for `provider`, scoped to the authenticated
   * caller's own tenant/user context, transparently refreshing it first if
   * it's expired (or about to be) and a refresh token is on file. The raw
   * refresh token itself is never returned.
   */
  getAccessToken(provider: string, opts?: RequestOpts): Promise<AccessTokenResult> {
    required("provider", provider);
    return this.t.get<AccessTokenResult>(`/v1/vault/tokens/${encodeURIComponent(provider)}/access-token`, opts);
  }

  /** Disconnects the authenticated caller's own connected account for `provider`. */
  disconnect(provider: string, opts?: RequestOpts): Promise<void> {
    required("provider", provider);
    return this.t.delete(`/v1/vault/tokens/${encodeURIComponent(provider)}`, opts);
  }
}
