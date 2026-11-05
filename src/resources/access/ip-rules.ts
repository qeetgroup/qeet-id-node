import type { RequestOptions } from "../../core/options.js";
import { ApiResource, path } from "../../core/resource.js";

/** An allow or deny rule for an address range. Deny wins over allow. */
export interface IpRule {
  id: string;
  tenant_id: string;
  action: "allow" | "deny" | (string & {});
  cidr: string;
  label: string;
  created_at: string;
}

export interface IpRuleCreateParams {
  action: "allow" | "deny";
  /** An address range, such as `203.0.113.0/24`. */
  cidr: string;
  label: string;
}

/** The organisation's address rules, and whether they are enforced. */
export interface IpRuleList {
  enabled: boolean;
  data: IpRule[];
}

export type IpRuleReasonCode = "ip.allowed" | "ip.deny_rule" | "ip.not_in_allow_rules" | "ip.address_unknown" | "ip.enforcement_disabled";

/** What the rules make of an address. */
export interface IpRuleCheck {
  enabled: boolean;
  allowed: boolean;
  reason: string;
  reason_code: IpRuleReasonCode | (string & {});
  reason_params?: Record<string, unknown>;
  /** What the rules alone decide, whether or not they are enforced. */
  rules?: { allowed: boolean; reason: string; reason_code: IpRuleReasonCode | (string & {}); reason_params?: Record<string, unknown> };
}

/** Manages the organisation's address rules: which networks may sign in. */
export class IpRules extends ApiResource {
  async list(tenantId: string, options?: RequestOptions): Promise<IpRuleList> {
    const response = await this._get<{ enabled?: boolean; items?: IpRule[] }>(path`/v1/tenants/${tenantId}/ip-rules`, undefined, options);
    return { enabled: response?.enabled === true, data: response?.items ?? [] };
  }

  async create(tenantId: string, params: IpRuleCreateParams, options?: RequestOptions): Promise<IpRule> {
    return this._send("POST", path`/v1/tenants/${tenantId}/ip-rules`, params, options);
  }

  async delete(tenantId: string, ruleId: string, options?: RequestOptions): Promise<void> {
    return this._delete(path`/v1/tenants/${tenantId}/ip-rules/${ruleId}`, options);
  }

  /** What the rules make of `ip`: the same decision a sign-in gets. Changes nothing. */
  async check(tenantId: string, ip: string, options?: RequestOptions): Promise<IpRuleCheck> {
    return this._request({ method: "POST", path: path`/v1/tenants/${tenantId}/ip-rules/check`, body: { ip }, retrySafe: true }, options);
  }

  /** Turns enforcement of the rules on or off. */
  async setEnforcement(tenantId: string, enabled: boolean, options?: RequestOptions): Promise<{ enabled: boolean }> {
    return this._send("PUT", path`/v1/tenants/${tenantId}/ip-rules/config`, { enabled }, options);
  }
}
