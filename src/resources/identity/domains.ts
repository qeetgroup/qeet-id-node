import type { RequestOptions } from "../../core/options.js";
import type { ListResult } from "../../core/pagination.js";
import { ApiResource, path } from "../../core/resource.js";

/** A domain the organisation claimed, with the DNS record that proves it. */
export interface Domain {
  id: string;
  domain: string;
  /** The verification state, for example `pending` or `verified`. */
  status: string;
  verification_token: string;
  /** Publish this TXT record, then call `verify`. */
  dns_record_name: string;
  dns_record_type: string;
  dns_record_value: string;
  /** Set once DNS verification succeeds. */
  verified_at?: string;
  last_checked_at?: string;
  last_error?: string;
  /** People on the domain sign in only through the organisation's SSO connection. */
  sso_enabled: boolean;
  /** Accounts are created on first SSO sign-in (just-in-time provisioning). */
  jit_enabled: boolean;
  created_at: string;
}

export interface DomainUpdateParams {
  sso_enabled?: boolean;
  jit_enabled?: boolean;
}

/** Manages the organisation's domains: claim, verify by DNS, and route sign-in. */
export class Domains extends ApiResource {
  /** Claims a domain and returns the TXT record to publish. */
  async create(tenantId: string, params: { domain: string }, options?: RequestOptions): Promise<Domain> {
    return this._send("POST", path`/v1/tenants/${tenantId}/domains`, params, options);
  }

  async list(tenantId: string, options?: RequestOptions): Promise<ListResult<Domain>> {
    return this._list(path`/v1/tenants/${tenantId}/domains`, undefined, options);
  }

  /** Looks the TXT record up now and, on a match, marks the domain verified. */
  async verify(tenantId: string, domainId: string, options?: RequestOptions): Promise<Domain> {
    return this._send("POST", path`/v1/tenants/${tenantId}/domains/${domainId}/verify`, undefined, options);
  }

  /** Turns SSO routing and just-in-time provisioning on or off. */
  async update(tenantId: string, domainId: string, params: DomainUpdateParams, options?: RequestOptions): Promise<Domain> {
    return this._send("PATCH", path`/v1/tenants/${tenantId}/domains/${domainId}`, params, options);
  }

  async delete(tenantId: string, domainId: string, options?: RequestOptions): Promise<void> {
    return this._delete(path`/v1/tenants/${tenantId}/domains/${domainId}`, options);
  }
}
