import type { RequestOpts } from "../client/options.js";
import type { Transport } from "../transport/http.js";

/** RetentionPolicy controls automatic purging of soft-deleted users. */
export interface RetentionPolicy {
  deleted_users_enabled: boolean;
  /** clamped server-side to [1, 3650] */
  deleted_users_days: number;
}

/** RetentionPreviewResult is a dry-run count — nothing is deleted. */
export interface RetentionPreviewResult {
  ripe_deleted_users: number;
  deleted_users_days: number;
}

/** RetentionRunResult reports how many records `run` actually purged. */
export interface RetentionRunResult {
  purged: number;
}

/** RetentionService manages the tenant's data-retention policy. */
export class RetentionService {
  constructor(private readonly t: Transport) {}

  get(tenantId: string, opts?: RequestOpts): Promise<RetentionPolicy> {
    return this.t.get<RetentionPolicy>(`/v1/tenants/${encodeURIComponent(tenantId)}/retention`, opts);
  }

  put(tenantId: string, input: RetentionPolicy, opts?: RequestOpts): Promise<RetentionPolicy> {
    return this.t.put<RetentionPolicy>(`/v1/tenants/${encodeURIComponent(tenantId)}/retention`, input, opts);
  }

  /** Reports how many records are currently ripe for purge, without deleting anything. */
  preview(tenantId: string, opts?: RequestOpts): Promise<RetentionPreviewResult> {
    return this.t.post<RetentionPreviewResult>(`/v1/tenants/${encodeURIComponent(tenantId)}/retention/preview`, undefined, opts);
  }

  /** Purges ripe records immediately, ahead of the scheduled sweep. */
  run(tenantId: string, opts?: RequestOpts): Promise<RetentionRunResult> {
    return this.t.post<RetentionRunResult>(`/v1/tenants/${encodeURIComponent(tenantId)}/retention/run`, undefined, opts);
  }
}
