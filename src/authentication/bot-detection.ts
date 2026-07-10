import type { RequestOpts } from "../client/options.js";
import type { Transport } from "../transport/http.js";

/** A single recorded bot-scoring verdict (offline User-Agent heuristic). */
export interface BotEvent {
  id: string;
  ip?: string;
  user_agent: string;
  score: number;
  /** allowed | challenged | blocked */
  verdict: string;
  created_at: string;
}

/** Blocked/challenged counts over the last 24h, plus the tenant's current score threshold. */
export interface BotDetectionStats {
  blocked_24h: number;
  challenged_24h: number;
  threshold: number;
}

/** The bot-detection overview: the most recent recorded verdicts plus aggregate stats. */
export interface BotDetectionOverview {
  recent: BotEvent[];
  stats: BotDetectionStats;
}

export interface BotDetectionSettings {
  ua_check: boolean;
  honeypot: boolean;
  captcha: boolean;
  signature: boolean;
  score_threshold: number;
}

/**
 * Full replace, not a partial patch: the backend decodes this directly into
 * its settings record (no pointer/optional fields on its side), so any
 * omitted field is written back as its zero value rather than left
 * unchanged.
 */
export interface UpdateBotDetectionSettingsInput {
  ua_check: boolean;
  honeypot: boolean;
  captcha: boolean;
  signature: boolean;
  score_threshold: number;
}

/**
 * Tenant-scoped bot-detection settings and stats — one of the
 * threat-detection surfaces alongside `RiskSettingsService`. Detection is
 * detect-only: a "blocked" verdict means "would block," so this never
 * affects the auth path itself, only what's surfaced here. There is no
 * pagination or list: `overview` is a single aggregate read, and settings
 * are a singleton get/put record, the same shape as `AuthPolicyService`/
 * `PolicyService`.
 */
export class BotDetectionService {
  constructor(private readonly t: Transport) {}

  overview(tenantId: string, opts?: RequestOpts): Promise<BotDetectionOverview> {
    return this.t.get<BotDetectionOverview>(`/v1/tenants/${encodeURIComponent(tenantId)}/security/bots`, opts);
  }

  getSettings(tenantId: string, opts?: RequestOpts): Promise<BotDetectionSettings> {
    return this.t.get<BotDetectionSettings>(`/v1/tenants/${encodeURIComponent(tenantId)}/security/bots/settings`, opts);
  }

  putSettings(tenantId: string, input: UpdateBotDetectionSettingsInput, opts?: RequestOpts): Promise<BotDetectionSettings> {
    return this.t.put<BotDetectionSettings>(`/v1/tenants/${encodeURIComponent(tenantId)}/security/bots/settings`, input, opts);
  }
}
