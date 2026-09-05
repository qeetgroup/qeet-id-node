import type { RequestOpts } from "../client/options.js";
import { resolveEnvelope, type Envelope } from "../types/common.js";
import type { Transport } from "../transport/http.js";

/**
 * AdminLink is a delegated-admin-portal link: a time-boxed token that lets a
 * tenant's own IT admin configure SAML/SCIM without a Qeet Group console
 * account.
 */
export interface AdminLink {
  id: string;
  tenant_id: string;
  /** "saml" and/or "scim" */
  capabilities: string[];
  created_by?: string;
  expires_at: string;
  revoked_at?: string;
  last_used_at?: string;
  created_at: string;
}

/** CreateAdminLinkInput — `ttl_seconds` is clamped server-side to [15min, 24h], defaulting to 1h when zero. */
export interface CreateAdminLinkInput {
  capabilities: string[];
  ttl_seconds?: number;
}

/** CreateAdminLinkResult carries the plaintext token and shareable URL, both shown only once at creation. */
export interface CreateAdminLinkResult {
  link: AdminLink;
  token: string;
  url: string;
}

/**
 * AdminLinksService manages delegated admin-portal links (renamed from the
 * earlier "AdminPortal" naming — this manages links/tokens, not a portal
 * itself). The external IT admin's browser exchanges the generated URL's
 * fragment token once for a short-lived, HttpOnly portal session; that browser
 * flow isn't wrapped here.
 */
export class AdminLinksService {
  constructor(private readonly t: Transport) {}

  create(tenantId: string, input: CreateAdminLinkInput, opts?: RequestOpts): Promise<CreateAdminLinkResult> {
    return this.t.post<CreateAdminLinkResult>(`/v1/tenants/${encodeURIComponent(tenantId)}/admin-portal/links`, input, opts);
  }

  async list(tenantId: string, opts?: RequestOpts): Promise<AdminLink[]> {
    const env = await this.t.get<Envelope<AdminLink>>(`/v1/tenants/${encodeURIComponent(tenantId)}/admin-portal/links`, opts);
    return resolveEnvelope(env);
  }

  revoke(tenantId: string, id: string, opts?: RequestOpts): Promise<void> {
    return this.t.delete(`/v1/tenants/${encodeURIComponent(tenantId)}/admin-portal/links/${encodeURIComponent(id)}`, opts);
  }
}
