import type { RequestOptions } from "../../core/options.js";
import type { ListResult } from "../../core/pagination.js";
import { ApiResource, path } from "../../core/resource.js";

/** What a link's holder may set up. */
export type AdminPortalCapability = "saml" | "scim" | "domain_verification";

/** A time-limited link that lets a customer's IT administrator set up SSO, SCIM or domains without a Qeet ID account. */
export interface AdminPortalLink {
  id: string;
  tenant_id: string;
  capabilities: AdminPortalCapability[];
  created_by: string | null;
  expires_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
  created_at: string;
}

export interface AdminPortalLinkCreateParams {
  capabilities: AdminPortalCapability[];
  /** Clamped to 15 minutes to 24 hours; 1 hour by default. */
  ttl_seconds?: number;
}

/** A new link. `token` and `url` are shown only here. */
export interface AdminPortalLinkCreated {
  link: AdminPortalLink;
  token: string;
  url: string;
}

/** Manages admin portal links. */
export class AdminPortalLinks extends ApiResource {
  async create(tenantId: string, params: AdminPortalLinkCreateParams, options?: RequestOptions): Promise<AdminPortalLinkCreated> {
    return this._send("POST", path`/v1/tenants/${tenantId}/admin-portal/links`, params, options);
  }

  async list(tenantId: string, options?: RequestOptions): Promise<ListResult<AdminPortalLink>> {
    return this._list(path`/v1/tenants/${tenantId}/admin-portal/links`, undefined, options);
  }

  async revoke(tenantId: string, linkId: string, options?: RequestOptions): Promise<void> {
    return this._delete(path`/v1/tenants/${tenantId}/admin-portal/links/${linkId}`, options);
  }
}
