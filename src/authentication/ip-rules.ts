import type { RequestOpts } from "../client/options.js";
import { resolveEnvelope, type Envelope } from "../types/common.js";
import type { Transport } from "../transport/http.js";

export interface IPRule {
  id: string;
  tenant_id: string;
  cidr: string;
  label?: string;
  /** allow | deny */
  action: string;
  created_at: string;
}

export interface CreateIPRuleInput {
  cidr: string;
  label?: string;
  action: string;
}

/**
 * The outcome of testing an address against a tenant's rule set. `enabled`
 * reports whether enforcement is on at all — `allowed` is only meaningful
 * when it is.
 */
export interface IPRuleCheckResult {
  enabled: boolean;
  allowed: boolean;
  reason?: string;
}

/** Manages tenant IP allow/deny rules. */
export class IPRulesService {
  constructor(private readonly t: Transport) {}

  create(tenantId: string, input: CreateIPRuleInput, opts?: RequestOpts): Promise<IPRule> {
    return this.t.post<IPRule>(`/v1/tenants/${encodeURIComponent(tenantId)}/ip-rules`, input, opts);
  }

  delete(tenantId: string, id: string, opts?: RequestOpts): Promise<void> {
    return this.t.delete(`/v1/tenants/${encodeURIComponent(tenantId)}/ip-rules/${encodeURIComponent(id)}`, opts);
  }

  async list(tenantId: string, opts?: RequestOpts): Promise<IPRule[]> {
    const env = await this.t.get<Envelope<IPRule>>(`/v1/tenants/${encodeURIComponent(tenantId)}/ip-rules`, opts);
    return resolveEnvelope(env);
  }

  /**
   * Tests whether `ip` would be allowed under the tenant's current rule set
   * and enforcement setting — useful to dry-run a rule change before
   * enabling enforcement.
   */
  check(tenantId: string, ip: string, opts?: RequestOpts): Promise<IPRuleCheckResult> {
    return this.t.post<IPRuleCheckResult>(`/v1/tenants/${encodeURIComponent(tenantId)}/ip-rules/check`, { ip }, opts);
  }

  /**
   * Turns IP-rule enforcement on or off for the tenant. Existing rules are
   * unaffected either way — this only toggles whether they're evaluated on
   * login.
   */
  setEnforcement(tenantId: string, enabled: boolean, opts?: RequestOpts): Promise<void> {
    return this.t.put(`/v1/tenants/${encodeURIComponent(tenantId)}/ip-rules/config`, { enabled }, opts);
  }
}
