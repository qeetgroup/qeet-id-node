import type { IdempotentRequestOptions, RequestOptions } from "../../core/options.js";
import type { ListResult } from "../../core/pagination.js";
import { ApiResource, path } from "../../core/resource.js";

/** An API key's record. The key itself is shown only when it is created or rotated. */
export interface ApiKey {
  id: string;
  tenant_id: string;
  /** The user a personal key acts for; null for an organisation key. */
  user_id: string | null;
  name: string;
  /** The key's first characters, to recognise it by. */
  prefix: string;
  scopes: string[];
  expires_at: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
  created_by?: string | null;
  /** The key this one replaced in a rotation. */
  rotated_from?: string | null;
}

export interface ApiKeyCreateParams {
  tenant_id: string;
  name: string;
  /** Makes a personal key that acts for this user. */
  user_id?: string | null;
  scopes?: string[];
  /** An RFC 3339 time; null or omitted for a key that doesn't expire. */
  expires_at?: string | null;
}

/** A new key. `secret` is shown only here: store it in a secrets manager. */
export interface ApiKeyCreated {
  api_key: ApiKey;
  secret: string;
  warning?: string;
}

/** Manages API keys. */
export class ApiKeys extends ApiResource {
  async create(params: ApiKeyCreateParams, options?: IdempotentRequestOptions): Promise<ApiKeyCreated> {
    return this._request({ method: "POST", path: "/v1/api-keys", body: params, idempotent: true }, options);
  }

  async list(tenantId: string, options?: RequestOptions): Promise<ListResult<ApiKey>> {
    return this._list(path`/v1/tenants/${tenantId}/api-keys`, undefined, options);
  }

  /**
   * Replaces a key with a new one, shown once. The old one keeps working for
   * `overlap_hours`, so deployments can switch over without downtime.
   */
  async rotate(
    tenantId: string,
    apiKeyId: string,
    params: { overlap_hours?: number } = {},
    options?: RequestOptions,
  ): Promise<ApiKeyCreated> {
    return this._send("POST", path`/v1/tenants/${tenantId}/api-keys/${apiKeyId}/rotate`, params, options);
  }

  /** Revokes a key at once. */
  async revoke(apiKeyId: string, options?: RequestOptions): Promise<void> {
    return this._delete(path`/v1/api-keys/${apiKeyId}`, options);
  }
}
