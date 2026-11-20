import type { RequestOptions } from "../../core/options.js";
import { ApiResource, path } from "../../core/resource.js";

/** An organization. Every API key belongs to one. */
export interface Organization {
  id: string;
  slug: string;
  name: string;
  status: "active" | "suspended";
  plan: "free" | "starter" | "pro" | "enterprise" | (string & {});
  /** Where the organization's data is held: the same for every organization of a deployment. */
  region: string;
  /** A hosted URL or a small inline data URL; empty when none is set. */
  logo_url: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  /** When a scheduled deletion takes effect; null when none is scheduled. */
  deletion_due_at: string | null;
  member_count?: number;
  mfa_enabled_count?: number;
}

/** The fields an update may change. Changing `status` is an owner's; the region and the plan can't change here. */
export interface OrganizationUpdateParams {
  name?: string;
  status?: "active" | "suspended";
  /** A hosted URL or a small inline data URL; empty removes the logo. */
  logo_url?: string;
  metadata?: Record<string, unknown>;
}

/** A scheduled deletion. */
export interface OrganizationDeletion {
  organization_id: string;
  deletion_due_at: string;
}

/**
 * Reads and manages the API key's organization. Listing and creating
 * organizations are a signed-in person's actions and aren't open to API keys.
 */
export class Organizations extends ApiResource {
  async get(organizationId: string, options?: RequestOptions): Promise<Organization> {
    return this._get(path`/v1/organizations/${organizationId}`, undefined, options);
  }

  /** Changes only the fields given. */
  async update(organizationId: string, params: OrganizationUpdateParams, options?: RequestOptions): Promise<Organization> {
    return this._send("PATCH", path`/v1/organizations/${organizationId}`, params, options);
  }

  /** Schedules the organization's deletion seven days from now. An owner may call it off with `cancelDeletion`. */
  async delete(organizationId: string, options?: RequestOptions): Promise<OrganizationDeletion> {
    return this._send("DELETE", path`/v1/organizations/${organizationId}`, undefined, options);
  }

  /** Calls off a scheduled deletion. */
  async cancelDeletion(organizationId: string, options?: RequestOptions): Promise<Organization> {
    return this._send("POST", path`/v1/organizations/${organizationId}/deletion/cancel`, undefined, options);
  }
}
