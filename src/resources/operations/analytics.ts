import type { RequestOptions } from "../../core/options.js";
import { ApiResource, path } from "../../core/resource.js";

export interface AnalyticsMetric {
  value: number;
  delta_pct: number;
}

export interface AnalyticsTrendPoint {
  date: string;
  value: number;
}

/** One day's sign-ins by method. A method with none is 0, not missing. */
export interface AnalyticsActivityPoint {
  date: string;
  password: number;
  passkey: number;
  social: number;
  saml: number;
  oidc: number;
  ldap: number;
  magic_link: number;
}

/** The sign-in dashboard: key figures and trends. */
export interface AnalyticsOverview {
  generated_at: string;
  kpis: {
    mau: AnalyticsMetric;
    dau: AnalyticsMetric;
    logins_today: AnalyticsMetric;
    failed_logins_24h: AnalyticsMetric;
    mfa_adoption_pct: AnalyticsMetric;
    total_users: AnalyticsMetric;
    avg_sessions_per_user: AnalyticsMetric;
    stickiness_pct: AnalyticsMetric;
  };
  weekly_activity_8w: { week: string; wau: number; dau: number }[];
  user_trend_14d: AnalyticsTrendPoint[];
  login_trend_14d: AnalyticsTrendPoint[];
  mfa_trend_14d: AnalyticsTrendPoint[];
  failed_trend_14d: AnalyticsTrendPoint[];
  login_activity_14d: AnalyticsActivityPoint[];
  login_methods_mix: { method: string; value: number }[];
  mfa_methods_adoption: { method: string; users: number }[];
  failed_logins_hourly_24h: { hour: string; attempts: number }[];
  /** Present when a range was asked for. */
  range?: { from?: string; to?: string; method?: string; days?: { date: string; sign_ins: number; people: number; failed: number }[] };
}

export interface AnalyticsOverviewParams {
  /** RFC 3339 times bounding the range. */
  from?: string;
  to?: string;
  /** A range of this many days back. */
  days?: number;
  /** Only this sign-in method. */
  method?: string;
}

/** Sign-in analytics. */
export class Analytics extends ApiResource {
  async getOverview(tenantId: string, params: AnalyticsOverviewParams = {}, options?: RequestOptions): Promise<AnalyticsOverview> {
    return this._get(path`/v1/tenants/${tenantId}/analytics/overview`, { ...params }, options);
  }
}
