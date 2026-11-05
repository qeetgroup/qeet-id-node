import type { RequestOptions } from "../../core/options.js";
import type { CursorPageParams, ListResult, PagePromise } from "../../core/pagination.js";
import { ApiResource, path } from "../../core/resource.js";

/** One entry of the hash-chained audit log. */
export interface AuditLogEntry {
  id: string;
  tenant_id: string | null;
  action: string;
  actor_type: string;
  actor_user_id: string | null;
  resource_type: string;
  resource_id: string | null;
  ip: string | null;
  user_agent: string | null;
  request_id: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
}

/** Filters for `list`. They combine. */
export interface AuditLogListParams extends CursorPageParams {
  /** Free text over action, resource type, actor type, user agent and metadata; supports "quoted phrases", -exclusions and OR. */
  q?: string;
  action?: string;
  resource_type?: string;
  resource_id?: string;
  actor_user_id?: string;
  ip?: string;
  /** RFC 3339 times bounding `created_at`. */
  from?: string;
  to?: string;
}

/** The result of walking the hash chain now. A broken chain names the first bad row. */
export interface AuditChainVerification {
  ok: boolean;
  rows_checked: number;
  last_verified_id?: string;
  broken_at_id?: string;
  broken_reason?: string;
  reason_code?: "audit.chain_prev_hash_mismatch" | "audit.chain_row_hash_mismatch";
}

/** The latest scheduled verification of the chain. */
export interface AuditVerificationStatus {
  verified: boolean;
  intact: boolean;
  last_verified_at: string | null;
  broken_at: string | null;
  last_verified_event_id: string | null;
  last_run_at: string | null;
  last_run_scope: string;
}

/** An audit event that departs from the actor's usual behaviour. */
export interface AuditAnomaly {
  id: string;
  tenant_id: string;
  event_id: string;
  actor_user_id: string | null;
  actor_email?: string | null;
  score: number;
  reasons: ("new_action_type" | "unusual_hour" | "new_ip")[];
  status: "open" | "resolved";
  resolved_at: string | null;
  resolved_by: string | null;
  action?: string;
  resource_type?: string;
  ip?: string | null;
  event_at?: string;
  created_at: string;
}

export interface AuditAnomalySettings {
  enabled: boolean;
  /** Events scoring at least this are flagged. */
  score_threshold: number;
  /** Events an actor needs before their behaviour is judged. */
  min_baseline_events: number;
}

/** Behavioural anomalies found in the audit log. */
export class AuditAnomalies extends ApiResource {
  async list(
    tenantId: string,
    params: { status?: "open" | "resolved"; limit?: number } = {},
    options?: RequestOptions,
  ): Promise<ListResult<AuditAnomaly>> {
    return this._list(path`/v1/tenants/${tenantId}/audit/anomalies`, { ...params }, options);
  }

  async getSummary(tenantId: string, options?: RequestOptions): Promise<{ open: number; high_score_open: number; resolved_7d: number }> {
    return this._get(path`/v1/tenants/${tenantId}/audit/anomalies/summary`, undefined, options);
  }

  async resolve(tenantId: string, anomalyId: string, options?: RequestOptions): Promise<void> {
    await this._send("POST", path`/v1/tenants/${tenantId}/audit/anomalies/${anomalyId}/resolve`, undefined, options);
  }

  async getSettings(tenantId: string, options?: RequestOptions): Promise<AuditAnomalySettings> {
    return this._get(path`/v1/tenants/${tenantId}/audit/anomaly-settings`, undefined, options);
  }

  async updateSettings(tenantId: string, settings: AuditAnomalySettings, options?: RequestOptions): Promise<AuditAnomalySettings> {
    return this._send("PUT", path`/v1/tenants/${tenantId}/audit/anomaly-settings`, settings, options);
  }
}

/** Reads the hash-chained audit log and verifies its integrity. */
export class AuditLogs extends ApiResource {
  /** Behavioural anomalies found in the log. */
  readonly anomalies: AuditAnomalies = new AuditAnomalies(this._http);

  /** Lists entries, newest first. */
  list(tenantId: string, params: AuditLogListParams = {}, options?: RequestOptions): PagePromise<AuditLogEntry> {
    return this._page(() => path`/v1/tenants/${tenantId}/audit`, { ...params }, options);
  }

  /** Walks the whole chain now and recomputes every row's hash. Changes nothing. */
  async verify(tenantId: string, options?: RequestOptions): Promise<AuditChainVerification> {
    return this._get(path`/v1/tenants/${tenantId}/audit/verify`, undefined, options);
  }

  /** The latest scheduled verification's outcome. */
  async getVerificationStatus(tenantId: string, options?: RequestOptions): Promise<AuditVerificationStatus> {
    return this._get(path`/v1/tenants/${tenantId}/audit/verification`, undefined, options);
  }
}
