import type { RequestOptions } from "../../core/options.js";
import { ApiResource, path } from "../../core/resource.js";

/** When soft-deleted users are purged for good. */
export interface RetentionPolicy {
  deleted_users_enabled: boolean;
  /** 1 to 3650; clamped. */
  deleted_users_days: number;
  updated_at?: string;
  updated_by?: string;
  updated_by_email?: string;
}

/** Manages the organisation's data-retention policy. */
export class Retention extends ApiResource {
  async get(tenantId: string, options?: RequestOptions): Promise<RetentionPolicy> {
    return this._get(path`/v1/tenants/${tenantId}/retention`, undefined, options);
  }

  async update(
    tenantId: string,
    policy: Pick<RetentionPolicy, "deleted_users_enabled" | "deleted_users_days">,
    options?: RequestOptions,
  ): Promise<RetentionPolicy> {
    return this._send("PUT", path`/v1/tenants/${tenantId}/retention`, policy, options);
  }

  /** Counts what the policy would purge now. Deletes nothing. */
  async preview(tenantId: string, options?: RequestOptions): Promise<{ ripe_deleted_users: number; deleted_users_days: number }> {
    return this._request({ method: "POST", path: path`/v1/tenants/${tenantId}/retention/preview`, retrySafe: true }, options);
  }

  /** Purges what is due now, ahead of the scheduled run. */
  async run(tenantId: string, options?: RequestOptions): Promise<{ purged: number }> {
    return this._send("POST", path`/v1/tenants/${tenantId}/retention/run`, undefined, options);
  }
}
