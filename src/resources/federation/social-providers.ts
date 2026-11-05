import type { RequestOptions } from "../../core/options.js";
import type { ListResult } from "../../core/pagination.js";
import { ApiResource, path } from "../../core/resource.js";

/** A social sign-in provider. Its client secret is never returned. */
export interface SocialProvider {
  id: string;
  tenant_id: string;
  /** Its name: `github`, `facebook`, `x`, `discord`, `apple`, or any name for an OpenID Connect provider. */
  provider: string;
  /** How it signs people in: its own OAuth flow, or `oidc` by discovery. */
  kind: "oidc" | "github" | "facebook" | "x" | "discord" | "apple";
  client_id: string;
  discovery_url: string | null;
  enabled: boolean;
  apple_team_id?: string;
  apple_key_id?: string;
  created_at: string;
}

/**
 * Adds a provider, or replaces one's settings. An empty `client_secret`
 * keeps the stored one. For Apple, `client_id` is the Services ID and
 * `client_secret` the `.p8` key, with `apple_team_id` and `apple_key_id`.
 */
export interface SocialProviderUpsertParams {
  provider: string;
  client_id: string;
  client_secret?: string;
  /** Required for an OpenID Connect provider. */
  discovery_url?: string;
  apple_team_id?: string;
  apple_key_id?: string;
}

export interface SocialProviderUpdateParams {
  enabled?: boolean;
  client_id?: string;
  client_secret?: string;
  discovery_url?: string;
  apple_team_id?: string;
  apple_key_id?: string;
}

/** Manages the API key's organisation's social sign-in providers, and linked social accounts. */
export class SocialProviders extends ApiResource {
  async list(tenantId: string, options?: RequestOptions): Promise<ListResult<SocialProvider>> {
    return this._list(path`/v1/tenants/${tenantId}/social/providers`, undefined, options);
  }

  /** Adds a provider, or replaces the settings of one the organisation has. */
  async upsert(params: SocialProviderUpsertParams, options?: RequestOptions): Promise<SocialProvider> {
    return this._send("POST", "/v1/social/providers", params, options);
  }

  /** Changes only the fields given; `enabled` switches the provider on or off. */
  async update(provider: string, params: SocialProviderUpdateParams, options?: RequestOptions): Promise<SocialProvider> {
    return this._send("PATCH", path`/v1/social/providers/${provider}`, params, options);
  }

  /** Removes a provider. Refused with 409 `social.provider_in_use` while anyone can sign in only through it. */
  async delete(provider: string, options?: RequestOptions): Promise<void> {
    return this._delete(path`/v1/social/providers/${provider}`, options);
  }

  /** Unlinks a social account from the person it belongs to. */
  async unlinkIdentity(identityId: string, options?: RequestOptions): Promise<void> {
    return this._delete(path`/v1/social/identities/${identityId}`, options);
  }
}
