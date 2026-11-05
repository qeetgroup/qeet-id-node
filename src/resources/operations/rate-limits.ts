import type { RequestOptions } from "../../core/options.js";
import { ApiResource, path } from "../../core/resource.js";

/** A token bucket: `rate` tokens a second, bursting to `capacity`. */
export interface RateLimitBucket {
  rate: number;
  capacity: number;
}

/** The organisation's rate limits per scope, with the defaults and ceilings they sit within. */
export interface TenantRateLimits {
  tenant?: RateLimitBucket;
  user?: RateLimitBucket;
  api_key?: RateLimitBucket;
  /** Read-only. */
  defaults?: { tenant: RateLimitBucket; user: RateLimitBucket; api_key: RateLimitBucket };
  ceiling?: { tenant: RateLimitBucket; user: RateLimitBucket; api_key: RateLimitBucket };
  min_rate?: number;
  /** Read-only: the platform's fixed limits, such as sign-in attempts per address. */
  built_in?: { name: string; per: "ip" | "user" | "address"; applies: string; rate: number; capacity: number }[];
}

export interface RateLimitsUpdateParams {
  tenant?: RateLimitBucket;
  user?: RateLimitBucket;
  api_key?: RateLimitBucket;
}

/** Manages the organisation's rate limits. */
export class RateLimits extends ApiResource {
  async get(tenantId: string, options?: RequestOptions): Promise<TenantRateLimits> {
    return this._get(path`/v1/tenants/${tenantId}/rate-limits`, undefined, options);
  }

  /** Sets the buckets given; the others keep their values. */
  async update(tenantId: string, params: RateLimitsUpdateParams, options?: RequestOptions): Promise<TenantRateLimits> {
    return this._send("PUT", path`/v1/tenants/${tenantId}/rate-limits`, params, options);
  }

  /** Goes back to the platform defaults. */
  async reset(tenantId: string, options?: RequestOptions): Promise<void> {
    return this._delete(path`/v1/tenants/${tenantId}/rate-limits`, options);
  }
}
