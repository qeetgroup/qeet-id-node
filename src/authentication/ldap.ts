import type { RequestOpts } from "../client/options.js";
import { resolveEnvelope, type Envelope } from "../types/common.js";
import type { Transport } from "../transport/http.js";

/** A tenant's LDAP/AD bind config. `bind_password` is write-only — never returned. */
export interface LDAPConnection {
  id: string;
  tenant_id: string;
  name: string;
  server_url: string;
  start_tls: boolean;
  skip_tls_verify: boolean;
  bind_dn: string;
  base_dn: string;
  user_filter: string;
  email_attribute: string;
  name_attribute: string;
  /** draft | active | disabled */
  status: string;
  created_at: string;
  updated_at?: string;
  last_login_at?: string;
}

/**
 * `name`, `server_url`, `bind_dn`, `bind_password`, `base_dn` are required.
 * `server_url` must start `ldap://` or `ldaps://`. Unset optional fields get
 * server-side defaults: `user_filter` `"(uid=%s)"`, `email_attribute`
 * `"mail"`, `name_attribute` `"cn"`, `status` `"draft"`.
 */
export interface CreateLDAPConnectionInput {
  name: string;
  server_url: string;
  start_tls?: boolean;
  skip_tls_verify?: boolean;
  bind_dn: string;
  bind_password: string;
  base_dn: string;
  user_filter?: string;
  email_attribute?: string;
  name_attribute?: string;
  status?: string;
}

export interface UpdateLDAPConnectionInput {
  name?: string;
  server_url?: string;
  start_tls?: boolean;
  skip_tls_verify?: boolean;
  bind_dn?: string;
  bind_password?: string;
  base_dn?: string;
  user_filter?: string;
  email_attribute?: string;
  name_attribute?: string;
  /** draft | active | disabled */
  status?: string;
}

/**
 * The outcome of a bind test — `{ ok: true }` on success; a failure surfaces
 * as an error instead (dial failed, bind failed, etc.).
 */
export interface LDAPTestResult {
  ok: boolean;
}

/** Manages LDAP/AD connections. */
export class LDAPService {
  constructor(private readonly t: Transport) {}

  create(tenantId: string, input: CreateLDAPConnectionInput, opts?: RequestOpts): Promise<LDAPConnection> {
    return this.t.post<LDAPConnection>(`/v1/tenants/${encodeURIComponent(tenantId)}/ldap`, input, opts);
  }

  get(tenantId: string, id: string, opts?: RequestOpts): Promise<LDAPConnection> {
    return this.t.get<LDAPConnection>(`/v1/tenants/${encodeURIComponent(tenantId)}/ldap/${encodeURIComponent(id)}`, opts);
  }

  update(tenantId: string, id: string, input: UpdateLDAPConnectionInput, opts?: RequestOpts): Promise<LDAPConnection> {
    return this.t.patch<LDAPConnection>(`/v1/tenants/${encodeURIComponent(tenantId)}/ldap/${encodeURIComponent(id)}`, input, opts);
  }

  delete(tenantId: string, id: string, opts?: RequestOpts): Promise<void> {
    return this.t.delete(`/v1/tenants/${encodeURIComponent(tenantId)}/ldap/${encodeURIComponent(id)}`, opts);
  }

  async list(tenantId: string, opts?: RequestOpts): Promise<LDAPConnection[]> {
    const env = await this.t.get<Envelope<LDAPConnection>>(`/v1/tenants/${encodeURIComponent(tenantId)}/ldap`, opts);
    return resolveEnvelope(env);
  }

  test(tenantId: string, id: string, opts?: RequestOpts): Promise<LDAPTestResult> {
    return this.t.post<LDAPTestResult>(`/v1/tenants/${encodeURIComponent(tenantId)}/ldap/${encodeURIComponent(id)}/test`, {}, opts);
  }

  /**
   * A public, unversioned passthrough (no `/v1` prefix, no auth) for legacy
   * apps doing direct LDAP-bind authentication against a configured
   * connection.
   */
  authenticate(connectionId: string, username: string, password: string, opts?: RequestOpts): Promise<void> {
    return this.t.post(`/ldap/${encodeURIComponent(connectionId)}/authenticate`, { username, password }, opts);
  }
}
