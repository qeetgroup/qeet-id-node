import type { RequestOptions } from "../../core/options.js";
import type { CursorPageParams, ListResult, PagePromise } from "../../core/pagination.js";
import { ApiResource, path } from "../../core/resource.js";

/** The organization's SCIM provisioning state. Tokens themselves are never returned after they are issued. */
export interface ScimConfig {
  token_set: boolean;
  token_count: number;
  token_prefix?: string;
  created_at: string | null;
  last_used_at: string | null;
  provisioned_count: number;
  /** The identity provider's latest request, when there was one. */
  last_request: {
    at: string;
    operation: "post" | "put" | "patch" | "delete";
    resource: "user" | "group";
    http_status: number;
    status: "success" | "warning" | "failed";
    error_code?: string;
    reason?: string;
  } | null;
}

/** A SCIM bearer token's record. */
export interface ScimToken {
  id: string;
  name: string;
  token_prefix: string;
  status: "active" | "rotated" | "expired" | "revoked";
  created_at: string;
  expires_at: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  replaced_by: string | null;
}

/** A new SCIM token. `token` is shown only here: give it to the identity provider. */
export interface ScimTokenCreated {
  scim_token: ScimToken;
  token: string;
}

/** A user the identity provider provisioned over SCIM. */
export interface ScimUser {
  id: string;
  email: string;
  display_name: string | null;
  external_id: string | null;
  status: string;
  created_at: string;
}

/** A group the identity provider provisioned over SCIM. */
export interface ScimGroup {
  id: string;
  name: string;
  external_id: string | null;
  members: number;
  created_at: string;
  updated_at: string;
}

/**
 * Administers SCIM provisioning: tokens, and what was provisioned. The
 * `/scim/v2` protocol itself is called by the identity provider, not by
 * this SDK.
 */
export class Scim extends ApiResource {
  async getConfig(organizationId: string, options?: RequestOptions): Promise<ScimConfig> {
    return this._get(path`/v1/organizations/${organizationId}/scim`, undefined, options);
  }

  async listTokens(organizationId: string, options?: RequestOptions): Promise<ListResult<ScimToken>> {
    return this._list(path`/v1/organizations/${organizationId}/scim/tokens`, undefined, options);
  }

  /** Issues an additional token, shown once. */
  async createToken(
    organizationId: string,
    params: { name: string; expires_at?: string | null },
    options?: RequestOptions,
  ): Promise<ScimTokenCreated> {
    return this._send("POST", path`/v1/organizations/${organizationId}/scim/tokens`, params, options);
  }

  /** Replaces a token with a new one, shown once; the old one keeps working for `overlap_hours`. */
  async rotateToken(
    organizationId: string,
    tokenId: string,
    params: { overlap_hours?: number; expires_at?: string | null } = {},
    options?: RequestOptions,
  ): Promise<ScimTokenCreated & { replaced: ScimToken }> {
    return this._send("POST", path`/v1/organizations/${organizationId}/scim/tokens/${tokenId}/rotate`, params, options);
  }

  /** Revokes one token. */
  async revokeToken(organizationId: string, tokenId: string, options?: RequestOptions): Promise<void> {
    return this._delete(path`/v1/organizations/${organizationId}/scim/tokens/${tokenId}`, options);
  }

  /** Revokes every working token, which stops provisioning. */
  async revokeAllTokens(organizationId: string, options?: RequestOptions): Promise<void> {
    return this._delete(path`/v1/organizations/${organizationId}/scim/token`, options);
  }

  listUsers(organizationId: string, params: CursorPageParams = {}, options?: RequestOptions): PagePromise<ScimUser> {
    return this._page(() => path`/v1/organizations/${organizationId}/scim/users`, { ...params }, options);
  }

  listGroups(organizationId: string, params: CursorPageParams = {}, options?: RequestOptions): PagePromise<ScimGroup> {
    return this._page(() => path`/v1/organizations/${organizationId}/scim/groups`, { ...params }, options);
  }
}
