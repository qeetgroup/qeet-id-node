import type { RequestOptions } from "../../core/options.js";
import { ApiResource, path } from "../../core/resource.js";

/** A token bucket: `rate` tokens a second, bursting to `capacity`. */
export interface RateLimitBucket {
  rate: number;
  capacity: number;
}

/** The organization's rate limits per scope, with the defaults and ceilings they sit within. */
export interface OrganizationRateLimits {
  organization?: RateLimitBucket;
  user?: RateLimitBucket;
  api_key?: RateLimitBucket;
  /** Read-only. */
  defaults?: { organization: RateLimitBucket; user: RateLimitBucket; api_key: RateLimitBucket };
  ceiling?: { organization: RateLimitBucket; user: RateLimitBucket; api_key: RateLimitBucket };
  min_rate?: number;
  /** Read-only: the platform's fixed limits, such as sign-in attempts per address. */
  built_in?: { name: string; per: "ip" | "user" | "address"; applies: string; rate: number; capacity: number }[];
}

export interface RateLimitsUpdateParams {
  organization?: RateLimitBucket;
  user?: RateLimitBucket;
  api_key?: RateLimitBucket;
}

/** Manages the organization's rate limits. */
export class RateLimits extends ApiResource {
  async get(organizationId: string, options?: RequestOptions): Promise<OrganizationRateLimits> {
    return this._get(path`/v1/organizations/${organizationId}/rate-limits`, undefined, options);
  }

  /** Sets the buckets given; the others keep their values. */
  async update(organizationId: string, params: RateLimitsUpdateParams, options?: RequestOptions): Promise<OrganizationRateLimits> {
    return this._send("PUT", path`/v1/organizations/${organizationId}/rate-limits`, params, options);
  }

  /** Goes back to the platform defaults. */
  async reset(organizationId: string, options?: RequestOptions): Promise<void> {
    return this._delete(path`/v1/organizations/${organizationId}/rate-limits`, options);
  }
}
