import type { RequestOptions } from "../../core/options.js";
import { ApiResource, path } from "../../core/resource.js";

/** Sign-in lockout settings. */
export interface LockoutSettings {
  threshold?: number;
  window_minutes?: number;
  duration_minutes?: number;
}

/** How people may sign in to the organisation. */
export interface AuthPolicy {
  password_enabled?: boolean;
  /** 8 to 128; clamped. */
  password_min_length?: number;
  password_require_uppercase?: boolean;
  password_require_number?: boolean;
  password_require_symbol?: boolean;
  magic_link_enabled?: boolean;
  /** 5 to 1440; clamped. */
  magic_link_ttl_minutes?: number;
  passkey_enabled?: boolean;
  otp_email_enabled?: boolean;
  otp_sms_enabled?: boolean;
  self_registration_enabled?: boolean;
  remember_device_enabled?: boolean;
  remember_device_days?: number;
  /** null: the platform default. */
  lockout_threshold?: number | null;
  lockout_window_minutes?: number | null;
  lockout_duration_minutes?: number | null;
  /** Read-only: the platform defaults and bounds of the lockout settings. */
  lockout_limits?: { defaults?: LockoutSettings; min?: LockoutSettings; max?: LockoutSettings };
}

/** How many live accounts sign in each way, and how many have no other way in. */
export interface AuthPolicyUsage {
  people: number;
  password: { people: number; only: number };
  passkey: { people: number; only: number };
  social: { provider: string; linked: number; only: number }[];
  magic_link_enabled: boolean;
}

/** Manages the organisation's sign-in policy: methods, password rules and lockout. */
export class AuthPolicies extends ApiResource {
  async get(tenantId: string, options?: RequestOptions): Promise<AuthPolicy> {
    return this._get(path`/v1/tenants/${tenantId}/auth-policy`, undefined, options);
  }

  /** Replaces the policy. Read it first and send it back whole. */
  async update(tenantId: string, policy: Omit<AuthPolicy, "lockout_limits">, options?: RequestOptions): Promise<AuthPolicy> {
    return this._send("PUT", path`/v1/tenants/${tenantId}/auth-policy`, policy, options);
  }

  /** How the organisation's people sign in: who would be locked out by turning a method off. */
  async getUsage(tenantId: string, options?: RequestOptions): Promise<AuthPolicyUsage> {
    return this._get(path`/v1/tenants/${tenantId}/auth-policy/usage`, undefined, options);
  }
}
