import type { RequestOpts } from "../client/options.js";
import type { Transport } from "../transport/http.js";

/** RateLimitBucket is a token-bucket config: rate is tokens/sec, capacity is the burst size. */
export interface RateLimitBucket {
  rate: number;
  capacity: number;
}

/**
 * TenantRateLimits is the effective (defaults merged with overrides) rate
 * limit config for a tenant, per bucket scope.
 */
export interface TenantRateLimits {
  tenant: RateLimitBucket;
  user: RateLimitBucket;
  api_key: RateLimitBucket;
}

/**
 * PutRateLimitsInput upserts whichever buckets are supplied — omitted
 * buckets keep their current value.
 */
export interface PutRateLimitsInput {
  tenant?: RateLimitBucket;
  user?: RateLimitBucket;
  api_key?: RateLimitBucket;
}

/** RateLimitsService manages per-tenant rate-limit overrides. */
export class RateLimitsService {
  constructor(private readonly t: Transport) {}

  get(tenantId: string, opts?: RequestOpts): Promise<TenantRateLimits> {
    return this.t.get<TenantRateLimits>(`/v1/tenants/${encodeURIComponent(tenantId)}/rate-limits`, opts);
  }

  put(tenantId: string, input: PutRateLimitsInput, opts?: RequestOpts): Promise<TenantRateLimits> {
    return this.t.put<TenantRateLimits>(`/v1/tenants/${encodeURIComponent(tenantId)}/rate-limits`, input, opts);
  }

  /** Clears all overrides, reverting the tenant to platform defaults. */
  reset(tenantId: string, opts?: RequestOpts): Promise<void> {
    return this.t.delete(`/v1/tenants/${encodeURIComponent(tenantId)}/rate-limits`, opts);
  }
}
