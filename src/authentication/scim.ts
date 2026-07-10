import type { RequestOpts } from "../client/options.js";
import { resolveEnvelope, type Envelope } from "../types/common.js";
import type { Transport } from "../transport/http.js";

/**
 * Describes a tenant's SCIM provisioning setup. `token_set`/`token_prefix`
 * let the console show "a token exists, starts with X" without ever
 * re-exposing the secret.
 */
export interface SCIMConfig {
  token_set: boolean;
  token_prefix?: string;
  created_at?: string;
  last_used_at?: string;
  provisioned_count: number;
}

/** Carries the new plaintext bearer token, shown once. */
export interface RotateSCIMTokenResult {
  token: string;
  config: SCIMConfig;
}

/**
 * A user provisioned into Qeet ID by the tenant's IdP via SCIM — distinct
 * from the full `User` type; this is the admin-facing summary.
 */
export interface ProvisionedUser {
  id: string;
  email: string;
  display_name?: string;
  status: string;
  external_id?: string;
  created_at: string;
}

/**
 * The tenant-admin config surface for SCIM provisioning — not the
 * `/scim/v2/*` protocol endpoints themselves, which the customer's IdP
 * (Okta, Azure AD, etc.) calls directly and this SDK has no reason to wrap.
 */
export class SCIMService {
  constructor(private readonly t: Transport) {}

  getConfig(tenantId: string, opts?: RequestOpts): Promise<SCIMConfig> {
    return this.t.get<SCIMConfig>(`/v1/tenants/${encodeURIComponent(tenantId)}/scim`, opts);
  }

  rotateToken(tenantId: string, opts?: RequestOpts): Promise<RotateSCIMTokenResult> {
    return this.t.post<RotateSCIMTokenResult>(`/v1/tenants/${encodeURIComponent(tenantId)}/scim/token`, {}, opts);
  }

  revokeToken(tenantId: string, opts?: RequestOpts): Promise<void> {
    return this.t.delete(`/v1/tenants/${encodeURIComponent(tenantId)}/scim/token`, opts);
  }

  async listProvisionedUsers(tenantId: string, opts?: RequestOpts): Promise<ProvisionedUser[]> {
    const env = await this.t.get<Envelope<ProvisionedUser>>(`/v1/tenants/${encodeURIComponent(tenantId)}/scim/users`, opts);
    return resolveEnvelope(env);
  }
}
