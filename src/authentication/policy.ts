import type { RequestOpts } from "../client/options.js";
import type { Transport } from "../transport/http.js";

/**
 * A tenant's combined security policy: IP allow/deny lists, password rules,
 * session lifetime, and MFA enforcement in one record. It's a distinct,
 * older resource from `AuthPolicyService`/`IPRulesService` — those are more
 * granular views over overlapping concerns; this is the original combined
 * record, still live at its own path.
 */
export interface SecurityPolicy {
  tenant_id: string;
  ip_allowlist?: string[];
  ip_denylist?: string[];
  password_min_length?: number;
  password_complexity?: string;
  /** Nanoseconds. */
  session_max_age?: number;
  mfa_enforcement?: string;
  settings?: Record<string, unknown>;
}

/** Manages the combined per-tenant security policy record. */
export class PolicyService {
  constructor(private readonly t: Transport) {}

  get(tenantId: string, opts?: RequestOpts): Promise<SecurityPolicy> {
    return this.t.get<SecurityPolicy>(`/v1/tenants/${encodeURIComponent(tenantId)}/policy`, opts);
  }

  /** Replaces the entire policy record — this is a full overwrite, not a partial patch. */
  put(tenantId: string, input: SecurityPolicy, opts?: RequestOpts): Promise<SecurityPolicy> {
    return this.t.put<SecurityPolicy>(`/v1/tenants/${encodeURIComponent(tenantId)}/policy`, input, opts);
  }
}
