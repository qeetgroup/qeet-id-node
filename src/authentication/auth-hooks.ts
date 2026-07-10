import type { RequestOpts } from "../client/options.js";
import { resolveEnvelope, type Envelope } from "../types/common.js";
import type { Transport } from "../transport/http.js";

/**
 * An HMAC-signed custom login-flow hook. `secret` is write-only — never
 * returned. A tenant may have multiple hooks; this is a genuine collection
 * (list/create/update-by-id/delete-by-id), not a singleton.
 */
export interface AuthHook {
  id: string;
  trigger: string;
  url: string;
  enabled: boolean;
  fail_open: boolean;
  created_at: string;
}

/**
 * `secret` signs the HMAC payload sent to `url` on every invocation; store
 * it to verify inbound calls. `fail_open` defaults to `true` server-side if
 * omitted (a hook outage doesn't block login).
 */
export interface CreateAuthHookInput {
  url: string;
  secret: string;
  fail_open?: boolean;
}

/**
 * Both fields are always sent (a full replace, not a partial patch, despite
 * the PATCH verb): the backend has no notion of "leave unset fields alone"
 * here.
 */
export interface UpdateAuthHookInput {
  enabled: boolean;
  fail_open: boolean;
}

/** Manages HMAC-signed pre/post-login webhooks. */
export class AuthHooksService {
  constructor(private readonly t: Transport) {}

  async list(tenantId: string, opts?: RequestOpts): Promise<AuthHook[]> {
    const env = await this.t.get<Envelope<AuthHook>>(`/v1/tenants/${encodeURIComponent(tenantId)}/auth-hooks`, opts);
    return resolveEnvelope(env);
  }

  create(tenantId: string, input: CreateAuthHookInput, opts?: RequestOpts): Promise<AuthHook> {
    return this.t.post<AuthHook>(`/v1/tenants/${encodeURIComponent(tenantId)}/auth-hooks`, input, opts);
  }

  update(tenantId: string, id: string, input: UpdateAuthHookInput, opts?: RequestOpts): Promise<void> {
    return this.t.patch(`/v1/tenants/${encodeURIComponent(tenantId)}/auth-hooks/${encodeURIComponent(id)}`, input, opts);
  }

  delete(tenantId: string, id: string, opts?: RequestOpts): Promise<void> {
    return this.t.delete(`/v1/tenants/${encodeURIComponent(tenantId)}/auth-hooks/${encodeURIComponent(id)}`, opts);
  }
}
