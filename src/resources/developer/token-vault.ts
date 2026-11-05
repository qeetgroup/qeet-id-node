import type { RequestOptions } from "../../core/options.js";
import type { ListResult } from "../../core/pagination.js";
import { ApiResource, path } from "../../core/resource.js";

/** A third-party OAuth provider people can connect accounts from. Its client secret is never returned. */
export interface TokenVaultProvider {
  id: string;
  provider: string;
  client_id: string;
  authorize_url: string;
  token_url: string;
  /** Space-separated scopes to ask for. */
  scopes: string;
  created_at: string;
  updated_at: string;
}

export interface TokenVaultProviderCreateParams {
  provider: string;
  client_id: string;
  client_secret: string;
  authorize_url: string;
  token_url: string;
  scopes?: string;
}

let rawTokenWarned = false;

/**
 * Third-party OAuth tokens held for your users (Slack, GitHub, Google, or any
 * OAuth 2.0 provider an administrator registers). People connect their
 * accounts in the browser; this SDK manages the providers and fetches live
 * access tokens.
 */
export class TokenVault extends ApiResource {
  /** Registers a provider, or replaces one's settings. */
  async createProvider(tenantId: string, params: TokenVaultProviderCreateParams, options?: RequestOptions): Promise<TokenVaultProvider> {
    return this._send("POST", path`/v1/tenants/${tenantId}/vault/tokens/providers`, params, options);
  }

  async listProviders(tenantId: string, options?: RequestOptions): Promise<ListResult<TokenVaultProvider>> {
    return this._list(path`/v1/tenants/${tenantId}/vault/tokens/providers`, undefined, options);
  }

  async deleteProvider(tenantId: string, provider: string, options?: RequestOptions): Promise<void> {
    return this._delete(path`/v1/tenants/${tenantId}/vault/tokens/providers/${provider}`, options);
  }

  /**
   * Returns a live access token for `provider`, refreshed first when it has
   * expired. Needs the `vault:read` scope.
   *
   * @deprecated This hands your code the raw third-party token, which then
   * tends to be stored, logged or put in a model's prompt, outside the vault's
   * controls; an AI agent must never receive it. Keep it in memory for one
   * request only. It will be replaced by a brokered call, where Qeet ID makes
   * the provider request for you, once the API offers one. Each process gets
   * one `QEETID_RAW_VAULT_TOKEN` warning the first time this is called.
   */
  async getAccessToken(provider: string, options?: RequestOptions): Promise<{ access_token: string }> {
    if (!rawTokenWarned) {
      rawTokenWarned = true;
      process.emitWarning("tokenVault.getAccessToken() returns a raw third-party token: keep it out of storage, logs and prompts.", {
        type: "DeprecationWarning",
        code: "QEETID_RAW_VAULT_TOKEN",
      });
    }
    return this._get(path`/v1/vault/tokens/${provider}/access-token`, undefined, options);
  }
}
