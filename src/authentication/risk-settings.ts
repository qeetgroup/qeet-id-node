import type { RequestOpts } from "../client/options.js";
import type { Transport } from "../transport/http.js";

/** A tenant's adaptive-MFA risk-assessment thresholds. */
export interface RiskSettings {
  medium_threshold: number;
  high_threshold: number;
  /** medium | high */
  force_mfa_at_level: string;
  /**
   * Flags a login from a different country than the user's last-seen one,
   * sooner than `min_travel_hours` could plausibly allow. Off by default: it
   * needs a country signal from the caller, and — like any new heuristic —
   * shouldn't start affecting logins until a tenant opts in.
   */
  impossible_travel_enabled: boolean;
  min_travel_hours: number;
  /** Flags a login from a browser+OS combination never seen before for this user. */
  device_reputation_enabled: boolean;
}

/**
 * Full replace, not a partial patch: the backend decodes this directly into
 * its settings record (no pointer/optional fields on its side), so any
 * omitted field is written back as its zero value — which the backend then
 * clamps or defaults (e.g. an omitted `min_travel_hours` becomes the
 * server's default, not "leave unchanged").
 */
export interface UpdateRiskSettingsInput {
  medium_threshold: number;
  high_threshold: number;
  force_mfa_at_level: string;
  impossible_travel_enabled: boolean;
  min_travel_hours: number;
  device_reputation_enabled: boolean;
}

/**
 * Tenant-scoped risk-assessment settings — one of the threat-detection
 * surfaces alongside `BotDetectionService`. These thresholds drive adaptive
 * MFA: a request scored above `force_mfa_at_level` is forced through a
 * second factor even if the device is otherwise trusted. No pagination, no
 * list: this is a singleton get/put record, the same shape as
 * `AuthPolicyService`/`PolicyService`.
 */
export class RiskSettingsService {
  constructor(private readonly t: Transport) {}

  get(tenantId: string, opts?: RequestOpts): Promise<RiskSettings> {
    return this.t.get<RiskSettings>(`/v1/tenants/${encodeURIComponent(tenantId)}/security/risk-settings`, opts);
  }

  put(tenantId: string, input: UpdateRiskSettingsInput, opts?: RequestOpts): Promise<RiskSettings> {
    return this.t.put<RiskSettings>(`/v1/tenants/${encodeURIComponent(tenantId)}/security/risk-settings`, input, opts);
  }
}
