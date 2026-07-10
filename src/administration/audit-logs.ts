import type { RequestOpts } from "../client/options.js";
import { resolveEnvelope, type Envelope } from "../types/common.js";
import { paginate } from "../transport/pagination.js";
import type { Transport } from "../transport/http.js";

/**
 * One row from the hash-chained audit log. Metadata and the hash-chain
 * fields (`prev_hash`/`row_hash`) aren't part of the list response — only
 * `verify` walks the chain.
 */
export interface AuditLog {
  id: string;
  tenant_id: string;
  actor_user_id?: string;
  actor_type?: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  ip?: string;
  user_agent?: string;
  request_id?: string;
  created_at: string;
}

/**
 * Narrows a `list` call. `search` applies a free-text `websearch_to_tsquery`
 * filter (sent as `?q=`) over action/resource_type/actor_type/user_agent/
 * metadata — supports "quoted phrases", -exclusions, and OR.
 */
export interface AuditLogListParams {
  action?: string;
  resource_type?: string;
  actor_user_id?: string;
  search?: string;
  limit?: number;
  cursor?: string;
}

export interface AuditLogPage {
  data: AuditLog[];
  nextCursor?: string;
}

/**
 * The result of walking a tenant's hash chain from the seed
 * (`GET /audit/verify`) — a broken chain names the first bad row.
 */
export interface AuditChainVerification {
  ok: boolean;
  rows_checked: number;
  last_verified_id?: string;
  broken_at_id?: string;
  broken_reason?: string;
}

/**
 * A flagged security anomaly (a behavioral-deviation detection, e.g. a
 * credential-stuffing lockout). Ported from the real backend's
 * `threat.Anomaly` projection — NOT from the Go SDK's `AuditAnomaly`, whose
 * backing endpoints don't exist; see `AuditLogsService`'s doc comment.
 */
export interface Anomaly {
  id: string;
  type: string;
  severity: string;
  detail: string;
  status: string;
  user_id?: string;
  user_email?: string;
  ip?: string;
  created_at: string;
  resolved_at?: string;
}

/** Narrows an anomalies `list` call. */
export interface AnomalyListParams {
  /** Filters to "open" or "resolved". Omit to return both. */
  status?: "open" | "resolved";
  limit?: number;
}

/** The counts view feeding the four KPI cards above the anomaly table. */
export interface AnomalySummary {
  open: number;
  resolved_24h: number;
  affected_accounts: number;
  high_severity_24h: number;
}

/**
 * Manages a tenant's flagged security anomalies. This sub-resource is
 * backed by the real, verified backend routes under
 * `/v1/tenants/{id}/security/anomalies*` (the threat-detection package),
 * not the Go SDK's `AuditLogsService.Anomalies*` methods — see
 * `AuditLogsService`'s doc comment for why those aren't ported here.
 * There is no anomaly-settings get/put endpoint anywhere in the real
 * backend, so no such method exists on this service either.
 */
export class AuditAnomaliesService {
  constructor(private readonly t: Transport) {}

  async list(tenantId: string, params: AnomalyListParams = {}, opts?: RequestOpts): Promise<Anomaly[]> {
    const env = await this.t.get<Envelope<Anomaly>>(`/v1/tenants/${encodeURIComponent(tenantId)}/security/anomalies`, {
      ...opts,
      query: { status: params.status, limit: params.limit },
    });
    return resolveEnvelope(env);
  }

  summary(tenantId: string, opts?: RequestOpts): Promise<AnomalySummary> {
    return this.t.get<AnomalySummary>(`/v1/tenants/${encodeURIComponent(tenantId)}/security/anomalies/summary`, opts);
  }

  /** Marks an open anomaly resolved. */
  resolve(tenantId: string, id: string, opts?: RequestOpts): Promise<void> {
    return this.t.post(`/v1/tenants/${encodeURIComponent(tenantId)}/security/anomalies/${encodeURIComponent(id)}/resolve`, undefined, opts);
  }
}

/**
 * Reads the hash-chained audit log.
 *
 * Deviation from the Go SDK: Go's `AuditLogsService` also exposes
 * `Anomalies`/`AnomalySummary`/`ResolveAnomaly`/`GetAnomalySettings`/
 * `PutAnomalySettings` methods pointed at `/v1/tenants/{id}/audit/
 * anomalies*` — those paths do not exist in the real backend (a known bug
 * in the Go SDK, not yet fixed there). This port omits them and instead
 * exposes the real, verified backend routes as the `anomalies`
 * sub-resource below. `list`/`all`/`verify` are unaffected — their paths
 * (`/v1/tenants/{id}/audit` and `/v1/tenants/{id}/audit/verify`) are
 * correct and ported as-is.
 */
export class AuditLogsService {
  readonly anomalies: AuditAnomaliesService;

  constructor(private readonly t: Transport) {
    this.anomalies = new AuditAnomaliesService(t);
  }

  async list(tenantId: string, params: AuditLogListParams = {}, opts?: RequestOpts): Promise<AuditLogPage> {
    const env = await this.t.get<Envelope<AuditLog> & { next_cursor?: string }>(`/v1/tenants/${encodeURIComponent(tenantId)}/audit`, {
      ...opts,
      query: {
        action: params.action,
        resource_type: params.resource_type,
        actor_user_id: params.actor_user_id,
        q: params.search,
        limit: params.limit,
        cursor: params.cursor,
      },
    });
    return { data: resolveEnvelope(env), nextCursor: env.next_cursor };
  }

  /** Iterates every audit-log entry across pages. */
  all(tenantId: string, params: AuditLogListParams = {}, opts?: RequestOpts): AsyncGenerator<AuditLog, void, void> {
    return paginate((cursor) => this.list(tenantId, { ...params, cursor }, opts));
  }

  /**
   * Walks the tenant's hash chain from the seed and recomputes each row's
   * hash, returning the first broken link (if any). No side effects. Not
   * per-entry — the backend has no such endpoint; it verifies the whole
   * chain in one pass.
   */
  verify(tenantId: string, opts?: RequestOpts): Promise<AuditChainVerification> {
    return this.t.get<AuditChainVerification>(`/v1/tenants/${encodeURIComponent(tenantId)}/audit/verify`, opts);
  }
}
