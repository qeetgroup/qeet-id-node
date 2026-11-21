import type { RequestOptions } from "../../core/options.js";
import { ApiResource, path } from "../../core/resource.js";

/** An allow or deny rule for an address range. Deny wins over allow. */
export interface IpRule {
  id: string;
  organization_id: string;
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

/** The organization's address rules, and whether they are enforced. */
export interface IpRuleList {
  enabled: boolean;
  data: IpRule[];
  /** True when the API capped the list and more rules exist than `data` holds. */
  truncated: boolean;
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
  rules?: {
    allowed: boolean;
    reason: string;
    reason_code: Exclude<IpRuleReasonCode, "ip.enforcement_disabled"> | (string & {});
    reason_params?: Record<string, unknown>;
  };
}

/** Manages the organization's address rules: which networks may sign in. */
export class IpRules extends ApiResource {
  async list(organizationId: string, options?: RequestOptions): Promise<IpRuleList> {
    const response = await this._get<{ enabled?: boolean; items?: IpRule[]; truncated?: boolean }>(
      path`/v1/organizations/${organizationId}/ip-rules`,
      undefined,
      options,
    );
    return { enabled: response?.enabled === true, data: response?.items ?? [], truncated: response?.truncated === true };
  }

  async create(organizationId: string, params: IpRuleCreateParams, options?: RequestOptions): Promise<IpRule> {
    return this._send("POST", path`/v1/organizations/${organizationId}/ip-rules`, params, options);
  }

  async delete(organizationId: string, ruleId: string, options?: RequestOptions): Promise<void> {
    return this._delete(path`/v1/organizations/${organizationId}/ip-rules/${ruleId}`, options);
  }

  /** What the rules make of `ip`: the same decision a sign-in gets. Changes nothing. */
  async check(organizationId: string, ip: string, options?: RequestOptions): Promise<IpRuleCheck> {
    return this._request(
      { method: "POST", path: path`/v1/organizations/${organizationId}/ip-rules/check`, body: { ip }, retrySafe: true },
      options,
    );
  }

  /** Turns enforcement of the rules on or off. */
  async setEnforcement(organizationId: string, enabled: boolean, options?: RequestOptions): Promise<{ enabled: boolean }> {
    return this._send("PUT", path`/v1/organizations/${organizationId}/ip-rules/config`, { enabled }, options);
  }
}
