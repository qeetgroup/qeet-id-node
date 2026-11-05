import type { RequestOptions } from "../../core/options.js";
import { ApiResource, path } from "../../core/resource.js";

/** An organisation (a tenant). Every API key belongs to one. */
export interface Tenant {
  id: string;
  slug: string;
  name: string;
  status: "active" | "suspended";
  plan: "free" | "pro" | "enterprise" | (string & {});
  region: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  /** When a scheduled deletion takes effect; null when none is scheduled. */
  deletion_due_at?: string | null;
  member_count?: number;
  mfa_enabled_count?: number;
}

/** The fields an update may change. Changing `status` is an owner's; the region can't change. */
export interface TenantUpdateParams {
  name?: string;
  status?: "active" | "suspended";
  plan?: "free" | "pro" | "enterprise";
  metadata?: Record<string, unknown>;
}

/** A scheduled deletion. */
export interface TenantDeletion {
  tenant_id: string;
  deletion_due_at: string;
}

/**
 * Reads and manages the API key's organisation. Listing and creating
 * organisations are a signed-in person's actions and aren't open to API keys.
 */
export class Tenants extends ApiResource {
  async get(tenantId: string, options?: RequestOptions): Promise<Tenant> {
    return this._get(path`/v1/tenants/${tenantId}`, undefined, options);
  }

  /** Changes only the fields given. */
  async update(tenantId: string, params: TenantUpdateParams, options?: RequestOptions): Promise<Tenant> {
    return this._send("PATCH", path`/v1/tenants/${tenantId}`, params, options);
  }

  /** Schedules the organisation's deletion seven days from now. An owner may call it off with `cancelDeletion`. */
  async delete(tenantId: string, options?: RequestOptions): Promise<TenantDeletion> {
    return this._send("DELETE", path`/v1/tenants/${tenantId}`, undefined, options);
  }

  /** Calls off a scheduled deletion. */
  async cancelDeletion(tenantId: string, options?: RequestOptions): Promise<Tenant> {
    return this._send("POST", path`/v1/tenants/${tenantId}/deletion/cancel`, undefined, options);
  }
}
