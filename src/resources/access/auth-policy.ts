import type { RequestOptions } from "../../core/options.js";
import { ApiResource, path } from "../../core/resource.js";

/** Sign-in lockout settings. */
export interface LockoutSettings {
  threshold?: number;
  window_minutes?: number;
  duration_minutes?: number;
}

/** How people may sign in to the organization. */
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

/** Manages the organization's sign-in policy: methods, password rules and lockout. */
export class AuthPolicies extends ApiResource {
  async get(organizationId: string, options?: RequestOptions): Promise<AuthPolicy> {
    return this._get(path`/v1/organizations/${organizationId}/auth-policy`, undefined, options);
  }

  /** Replaces the policy. Read it first and send it back whole. */
  async update(organizationId: string, policy: Omit<AuthPolicy, "lockout_limits">, options?: RequestOptions): Promise<AuthPolicy> {
    return this._send("PUT", path`/v1/organizations/${organizationId}/auth-policy`, policy, options);
  }

  /** How the organization's people sign in: who would be locked out by turning a method off. */
  async getUsage(organizationId: string, options?: RequestOptions): Promise<AuthPolicyUsage> {
    return this._get(path`/v1/organizations/${organizationId}/auth-policy/usage`, undefined, options);
  }
}
