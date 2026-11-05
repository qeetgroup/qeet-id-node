import type { RequestOptions } from "../../core/options.js";
import type { ListResult } from "../../core/pagination.js";
import { ApiResource, path } from "../../core/resource.js";
import type { ConnectionStatus, SsoGroupMapping, SsoGroupMappingCreateParams } from "./saml.js";

/** A directory (LDAP or Active Directory) connection. The bind password is never returned. */
export interface LdapConnection {
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
  status: ConnectionStatus;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

/**
 * `server_url` starts `ldap://` or `ldaps://`. Unset optional fields get the
 * server's defaults (`user_filter` `(uid=%s)`, `email_attribute` `mail`,
 * `name_attribute` `cn`, `status` `draft`).
 */
export interface LdapConnectionCreateParams {
  name: string;
  server_url: string;
  bind_dn: string;
  bind_password: string;
  base_dn: string;
  start_tls?: boolean;
  /** Sign-in refuses a connection that skips certificate verification. */
  skip_tls_verify?: boolean;
  user_filter?: string;
  email_attribute?: string;
  name_attribute?: string;
  status?: "draft" | "active" | "disabled";
}

export type LdapConnectionUpdateParams = Partial<LdapConnectionCreateParams>;

/** A session's tokens. */
export interface TokenPair {
  access_token: string;
  token_type: string;
  expires_at: string;
  refresh_token: string;
  /** When the session ends however active it is. */
  session_expires_at: string;
  /** When the session ends unless renewed before then. */
  idle_expires_at: string;
  session_id: string;
  user_id: string;
  tenant_id?: string | null;
}

/** A second factor the person may complete a challenge with. */
export interface MfaFactor {
  type: "totp" | "recovery_code" | "email" | "sms" | "passkey" | "push";
  /** An email or SMS factor's id. */
  id?: string;
  /** An email or SMS factor's masked address or number. */
  destination?: string;
}

/** A sign-in stopped before its session: complete it at `POST /v1/auth/mfa` with `mfa_token`. */
export interface MfaChallenge {
  mfa_required: true;
  mfa_token: string;
  methods: MfaFactor["type"][];
  factors: MfaFactor[];
  /** The account must set up a second factor first. */
  enrollment_required?: boolean;
  /** On an enrolment challenge in a grace period: when it ends. */
  enrollment_due_at?: string;
}

/** A directory sign-in's outcome: tokens, or a second-factor challenge. Branch on `type`. */
export type LdapAuthenticationResult = { type: "tokens"; tokens: TokenPair } | { type: "mfa_challenge"; challenge: MfaChallenge };

/** Manages directory connections, and signs people in with their directory password. */
export class LdapConnections extends ApiResource {
  async create(tenantId: string, params: LdapConnectionCreateParams, options?: RequestOptions): Promise<LdapConnection> {
    return this._send("POST", path`/v1/tenants/${tenantId}/ldap`, params, options);
  }

  async get(tenantId: string, connectionId: string, options?: RequestOptions): Promise<LdapConnection> {
    return this._get(path`/v1/tenants/${tenantId}/ldap/${connectionId}`, undefined, options);
  }

  async list(tenantId: string, options?: RequestOptions): Promise<ListResult<LdapConnection>> {
    return this._list(path`/v1/tenants/${tenantId}/ldap`, undefined, options);
  }

  async update(
    tenantId: string,
    connectionId: string,
    params: LdapConnectionUpdateParams,
    options?: RequestOptions,
  ): Promise<LdapConnection> {
    return this._send("PATCH", path`/v1/tenants/${tenantId}/ldap/${connectionId}`, params, options);
  }

  async delete(tenantId: string, connectionId: string, options?: RequestOptions): Promise<void> {
    return this._delete(path`/v1/tenants/${tenantId}/ldap/${connectionId}`, options);
  }

  /** Binds to the directory with the stored credentials. A failure throws. */
  async test(tenantId: string, connectionId: string, options?: RequestOptions): Promise<{ ok: boolean }> {
    return this._request({ method: "POST", path: path`/v1/tenants/${tenantId}/ldap/${connectionId}/test`, retrySafe: true }, options);
  }

  async listGroupMappings(tenantId: string, connectionId: string, options?: RequestOptions): Promise<ListResult<SsoGroupMapping>> {
    return this._list(path`/v1/tenants/${tenantId}/ldap/${connectionId}/group-mappings`, undefined, options);
  }

  async createGroupMapping(
    tenantId: string,
    connectionId: string,
    params: SsoGroupMappingCreateParams,
    options?: RequestOptions,
  ): Promise<SsoGroupMapping> {
    return this._send("POST", path`/v1/tenants/${tenantId}/ldap/${connectionId}/group-mappings`, params, options);
  }

  async deleteGroupMapping(tenantId: string, connectionId: string, mappingId: string, options?: RequestOptions): Promise<void> {
    return this._delete(path`/v1/tenants/${tenantId}/ldap/${connectionId}/group-mappings/${mappingId}`, options);
  }

  /**
   * Signs a person in with their directory username and password, under
   * the organisation's lockout, network, risk and second-factor rules. The
   * result is tokens, or a challenge to complete at `POST /v1/auth/mfa`:
   *
   * ```ts
   * const result = await client.ldapConnections.authenticate(connectionId, { username, password });
   * if (result.type === "mfa_challenge") return askForSecondFactor(result.challenge.mfa_token);
   * useTokens(result.tokens);
   * ```
   *
   * Sends no API key: the endpoint is public. Never retried, as each failed
   * attempt counts towards the lockout.
   */
  async authenticate(
    connectionId: string,
    credentials: { username: string; password: string },
    options?: RequestOptions,
  ): Promise<LdapAuthenticationResult> {
    const response = await this._request<TokenPair | MfaChallenge>(
      { method: "POST", path: path`/ldap/${connectionId}/authenticate`, body: credentials, authenticate: false },
      { ...options, maxRetries: 0 },
    );
    if (response && "mfa_required" in response && response.mfa_required === true) {
      return { type: "mfa_challenge", challenge: { ...response, methods: response.methods ?? [], factors: response.factors ?? [] } };
    }
    return { type: "tokens", tokens: response as TokenPair };
  }
}
