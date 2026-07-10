import type { RequestOpts } from "../client/options.js";
import type { Transport } from "../transport/http.js";

export interface AnalyticsMetric {
  value: number;
  delta_pct: number;
}

export interface AnalyticsTrendPoint {
  date: string;
  value: number;
}

/**
 * AnalyticsActivityPoint is a daily bucket grouped by login method. Missing
 * methods come back as 0, not omitted, so a stacked-area chart never gaps.
 */
export interface AnalyticsActivityPoint {
  date: string;
  password: number;
  passkey: number;
  social: number;
  saml: number;
  oidc: number;
}

export interface AnalyticsMethodSlice {
  method: string;
  value: number;
}

export interface AnalyticsMethodCount {
  method: string;
  users: number;
}

export interface AnalyticsHourlyPoint {
  hour: string;
  attempts: number;
}

/** AnalyticsWeeklyActivityPoint is one ISO week's WAU/average-DAU bucket. */
export interface AnalyticsWeeklyActivityPoint {
  /** "Wnn" */
  week: string;
  wau: number;
  dau: number;
}

export interface AnalyticsKPIs {
  mau: AnalyticsMetric;
  logins_today: AnalyticsMetric;
  mfa_adoption_pct: AnalyticsMetric;
  failed_logins_24h: AnalyticsMetric;
  dau: AnalyticsMetric;
  total_users: AnalyticsMetric;
  avg_sessions_per_user: AnalyticsMetric;
  stickiness_pct: AnalyticsMetric;
}

/**
 * AnalyticsOverview is the single payload behind the admin dashboard's KPI
 * cards and charts. Where the underlying data isn't recorded yet, fields
 * come back as empty buckets rather than being omitted.
 */
export interface AnalyticsOverview {
  generated_at: string;
  kpis: AnalyticsKPIs;
  weekly_activity_8w: AnalyticsWeeklyActivityPoint[];
  user_trend_14d: AnalyticsTrendPoint[];
  login_trend_14d: AnalyticsTrendPoint[];
  mfa_trend_14d: AnalyticsTrendPoint[];
  failed_trend_14d: AnalyticsTrendPoint[];
  login_activity_14d: AnalyticsActivityPoint[];
  login_methods_mix: AnalyticsMethodSlice[];
  mfa_methods_adoption: AnalyticsMethodCount[];
  failed_logins_hourly_24h: AnalyticsHourlyPoint[];
}

/** AnalyticsService reads the admin dashboard's aggregated KPIs. */
export class AnalyticsService {
  constructor(private readonly t: Transport) {}

  overview(tenantId: string, opts?: RequestOpts): Promise<AnalyticsOverview> {
    return this.t.get<AnalyticsOverview>(`/v1/tenants/${encodeURIComponent(tenantId)}/analytics/overview`, opts);
  }
}
