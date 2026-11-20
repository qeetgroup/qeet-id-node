import type { RequestOptions } from "../../core/options.js";
import { ApiResource, path } from "../../core/resource.js";

/** Session bounds, MFA enforcement and step-up rules for the organization. Durations are Go-style strings such as `"720h"`. */
export interface SecurityPolicy {
  organization_id?: string;
  password_min_length?: number;
  password_complexity?: string;
  session_max_age?: string;
  session_idle_timeout?: string;
  /** null: no limit. */
  max_sessions?: number | null;
  session_limit_action?: "evict_oldest" | "refuse";
  mfa_enforcement?: "optional" | "required" | "admin_only";
  mfa_grace_days?: number;
  mfa_enforced_since?: string | null;
  step_up_window?: string;
  step_up_methods?: ("totp" | "recovery_code" | "otp" | "webauthn" | "push")[];
  settings?: Record<string, unknown>;
}

/** Manages the organization's security policy. Which addresses may sign in is `client.ipRules`. */
export class SecurityPolicies extends ApiResource {
  /** The policy, or the platform defaults when none is saved. */
  async get(organizationId: string, options?: RequestOptions): Promise<SecurityPolicy> {
    return this._get(path`/v1/organizations/${organizationId}/policy`, undefined, options);
  }

  /** Changes only the fields given. */
  async update(organizationId: string, params: Omit<SecurityPolicy, "organization_id">, options?: RequestOptions): Promise<SecurityPolicy> {
    return this._send("PATCH", path`/v1/organizations/${organizationId}/policy`, params, options);
  }

  /** Replaces the whole policy. */
  async replace(
    organizationId: string,
    policy: Omit<SecurityPolicy, "organization_id">,
    options?: RequestOptions,
  ): Promise<SecurityPolicy> {
    return this._send("PUT", path`/v1/organizations/${organizationId}/policy`, policy, options);
  }
}
