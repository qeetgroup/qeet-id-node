import type { RequestOpts } from "../client/options.js";
import type { Transport } from "../transport/http.js";

export interface AuthPolicySettings {
  tenant_id: string;
  password_min_length?: number;
  password_require_uppercase?: boolean;
  password_require_numbers?: boolean;
  password_require_symbols?: boolean;
  allowed_login_methods?: string[];
  mfa_required?: boolean;
  session_duration_seconds?: number;
  updated_at?: string;
}

export interface UpdateAuthPolicyInput {
  password_min_length?: number;
  password_require_uppercase?: boolean;
  password_require_numbers?: boolean;
  password_require_symbols?: boolean;
  allowed_login_methods?: string[];
  mfa_required?: boolean;
  session_duration_seconds?: number;
}

/**
 * Manages tenant-wide login policy (password rules, MFA requirement,
 * session duration).
 */
export class AuthPolicyService {
  constructor(private readonly t: Transport) {}

  get(tenantId: string, opts?: RequestOpts): Promise<AuthPolicySettings> {
    return this.t.get<AuthPolicySettings>(`/v1/tenants/${encodeURIComponent(tenantId)}/auth-policy`, opts);
  }

  update(tenantId: string, input: UpdateAuthPolicyInput, opts?: RequestOpts): Promise<AuthPolicySettings> {
    return this.t.put<AuthPolicySettings>(`/v1/tenants/${encodeURIComponent(tenantId)}/auth-policy`, input, opts);
  }
}
