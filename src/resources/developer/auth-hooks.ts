import type { RequestOptions } from "../../core/options.js";
import type { ListResult } from "../../core/pagination.js";
import { ApiResource, path } from "../../core/resource.js";

/** A signed call to your endpoint during sign-in, which may allow, deny or add claims. Its secret is never returned. */
export interface AuthHook {
  id: string;
  trigger: string;
  url: string;
  enabled: boolean;
  /** Whether a failing hook lets sign-in proceed. */
  fail_open: boolean;
  created_at: string;
  last_called_at?: string | null;
  last_outcome?: "allowed" | "denied" | "skipped" | null;
  last_status_code?: number | null;
  calls?: number;
  skips?: number;
  denies?: number;
}

export interface AuthHookCreateParams {
  url: string;
  /** Signs every call; generated when omitted. */
  secret?: string;
  /** Default true: an unreachable hook doesn't block sign-in. */
  fail_open?: boolean;
}

export interface AuthHookUpdateParams {
  url?: string;
  secret?: string;
  enabled?: boolean;
  fail_open?: boolean;
}

/** A test call's outcome. */
export interface AuthHookTestResult {
  status_code?: number;
  duration_ms?: number;
  decision?: "allow" | "deny" | "none";
  message?: string;
  claims?: Record<string, unknown>;
  error?: string;
}

/** Manages authentication hooks. */
export class AuthHooks extends ApiResource {
  async list(tenantId: string, options?: RequestOptions): Promise<ListResult<AuthHook>> {
    return this._list(path`/v1/tenants/${tenantId}/auth-hooks`, undefined, options);
  }

  async create(tenantId: string, params: AuthHookCreateParams, options?: RequestOptions): Promise<AuthHook> {
    return this._send("POST", path`/v1/tenants/${tenantId}/auth-hooks`, params, options);
  }

  /** Changes only the fields given. */
  async update(
    tenantId: string,
    hookId: string,
    params: AuthHookUpdateParams,
    options?: RequestOptions,
  ): Promise<{ enabled: boolean; fail_open: boolean }> {
    return this._send("PATCH", path`/v1/tenants/${tenantId}/auth-hooks/${hookId}`, params, options);
  }

  async delete(tenantId: string, hookId: string, options?: RequestOptions): Promise<void> {
    return this._delete(path`/v1/tenants/${tenantId}/auth-hooks/${hookId}`, options);
  }

  /** Calls the hook with a sample payload and reports what it answered. */
  async test(tenantId: string, hookId: string, options?: RequestOptions): Promise<AuthHookTestResult> {
    return this._send("POST", path`/v1/tenants/${tenantId}/auth-hooks/${hookId}/test`, undefined, options);
  }
}
