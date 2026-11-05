import type { RequestOptions } from "../../core/options.js";
import type { CursorPageParams, PagePromise } from "../../core/pagination.js";
import { ApiResource, path } from "../../core/resource.js";

/** One bot-detection verdict on a sign-in attempt. */
export interface BotEvent {
  id: string;
  ip?: string;
  user_agent: string;
  score: number;
  verdict: "allowed" | "challenged" | "blocked" | (string & {});
  outcome: "signed_in" | "failed" | "unknown";
  user_id?: string;
  user_email?: string;
  created_at: string;
}

/** Recent bot-detection verdicts, a page at a time, with totals. */
export interface BotActivity {
  recent: BotEvent[];
  next_cursor?: string;
  total: number;
  stats: { blocked_24h: number; challenged_24h: number; threshold: number };
}

export interface BotActivityParams extends CursorPageParams {
  verdict?: "allowed" | "challenged" | "blocked";
}

/** Bot-detection settings. Replaced whole on update. */
export interface BotSettings {
  ua_check: boolean;
  honeypot: boolean;
  captcha: boolean;
  signature: boolean;
  score_threshold: number;
}

/** Adaptive-MFA risk settings. Replaced whole on update. */
export interface RiskSettings {
  medium_threshold: number;
  high_threshold: number;
  /** The risk level at which a second factor is required even on a trusted device. */
  force_mfa_at_level: "medium" | "high";
  /** Flags a sign-in from a new country sooner than `min_travel_hours` after the last one. */
  impossible_travel_enabled: boolean;
  min_travel_hours: number;
  /** Flags a sign-in from a browser and OS never seen for the user. */
  device_reputation_enabled: boolean;
  /** Read-only: whether the deployment receives a country header. */
  country_header_configured?: boolean;
  country_last_seen_at?: string | null;
}

/** A detected sign-in anomaly. */
export interface Anomaly {
  id: string;
  type: string;
  severity: string;
  detail: string;
  status: "open" | "resolved" | (string & {});
  user_id?: string;
  user_email?: string;
  ip?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  resolved_at?: string;
  resolved_by?: string;
  resolved_by_email?: string;
}

export interface AnomalyListParams extends CursorPageParams {
  status?: "open" | "resolved";
}

export interface AnomalySummary {
  open: number;
  resolved_24h: number;
  affected_accounts: number;
  high_severity_24h: number;
}

/** Bot detection, adaptive-risk settings and sign-in anomalies. */
export class ThreatDetection extends ApiResource {
  /** Recent bot-detection verdicts and statistics. */
  async getBotActivity(tenantId: string, params: BotActivityParams = {}, options?: RequestOptions): Promise<BotActivity> {
    return this._get(path`/v1/tenants/${tenantId}/security/bots`, { ...params }, options);
  }

  async getBotSettings(tenantId: string, options?: RequestOptions): Promise<BotSettings> {
    return this._get(path`/v1/tenants/${tenantId}/security/bots/settings`, undefined, options);
  }

  /** Replaces the bot-detection settings. */
  async updateBotSettings(tenantId: string, settings: BotSettings, options?: RequestOptions): Promise<BotSettings> {
    return this._send("PUT", path`/v1/tenants/${tenantId}/security/bots/settings`, settings, options);
  }

  async getRiskSettings(tenantId: string, options?: RequestOptions): Promise<RiskSettings> {
    return this._get(path`/v1/tenants/${tenantId}/security/risk-settings`, undefined, options);
  }

  /** Replaces the risk settings. */
  async updateRiskSettings(
    tenantId: string,
    settings: Omit<RiskSettings, "country_header_configured" | "country_last_seen_at">,
    options?: RequestOptions,
  ): Promise<RiskSettings> {
    return this._send("PUT", path`/v1/tenants/${tenantId}/security/risk-settings`, settings, options);
  }

  /** Lists sign-in anomalies, newest first. */
  listAnomalies(tenantId: string, params: AnomalyListParams = {}, options?: RequestOptions): PagePromise<Anomaly> {
    return this._page(() => path`/v1/tenants/${tenantId}/security/anomalies`, { ...params }, options);
  }

  async getAnomalySummary(tenantId: string, options?: RequestOptions): Promise<AnomalySummary> {
    return this._get(path`/v1/tenants/${tenantId}/security/anomalies/summary`, undefined, options);
  }

  /** Marks an anomaly reviewed. It blocks or revokes nothing by itself. */
  async resolveAnomaly(tenantId: string, anomalyId: string, options?: RequestOptions): Promise<void> {
    await this._send("POST", path`/v1/tenants/${tenantId}/security/anomalies/${anomalyId}/resolve`, undefined, options);
  }
}
