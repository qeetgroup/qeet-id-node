import type { IdempotentRequestOptions, RequestOptions } from "../../core/options.js";
import type { ListResult } from "../../core/pagination.js";
import { ApiResource, path } from "../../core/resource.js";

/** A machine identity that gets tokens with the `client_credentials` grant (see `client.oauth.clientCredentialsGrant`). */
export interface ServicePrincipal {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  scopes: string[];
  /** Set while the principal is disabled. */
  disabled_at: string | null;
  last_used_at: string | null;
  /** While a rotated-out secret still gets tokens. */
  previous_secret_expires_at?: string;
  created_at: string;
}

export interface ServicePrincipalCreateParams {
  tenant_id: string;
  name: string;
  description?: string;
  scopes?: string[];
}

/** A new principal and its credentials. The secret is shown once and can't be read again. */
export interface ServicePrincipalCreated {
  service_principal: ServicePrincipal;
  client_id: string;
  client_secret: string;
  warning: string;
}

/** A new secret, shown once, and when the old one stops working. */
export interface ServicePrincipalSecret {
  client_id: string;
  client_secret: string;
  previous_secret_expires_at: string;
  warning: string;
}

/** Manages service principals: machine identities for machine-to-machine access. */
export class ServicePrincipals extends ApiResource {
  async create(params: ServicePrincipalCreateParams, options?: IdempotentRequestOptions): Promise<ServicePrincipalCreated> {
    return this._request({ method: "POST", path: "/v1/service-principals", body: params, idempotent: true }, options);
  }

  async list(tenantId: string, options?: RequestOptions): Promise<ListResult<ServicePrincipal>> {
    return this._list(path`/v1/tenants/${tenantId}/service-principals`, undefined, options);
  }

  /** Disables the principal: its secret gets no more tokens and the tokens it holds are refused at once. Undo with `enable`. */
  async disable(servicePrincipalId: string, options?: RequestOptions): Promise<void> {
    return this._delete(path`/v1/service-principals/${servicePrincipalId}`, options);
  }

  /** Turns a disabled principal back on. */
  async enable(tenantId: string, servicePrincipalId: string, options?: RequestOptions): Promise<void> {
    await this._send("POST", path`/v1/tenants/${tenantId}/service-principals/${servicePrincipalId}/enable`, undefined, options);
  }

  /**
   * Issues a new secret, shown once. The old one keeps getting tokens for
   * `overlap_hours` (default 24, at most 168; 0 stops it at once).
   */
  async rotateSecret(
    tenantId: string,
    servicePrincipalId: string,
    params: { overlap_hours?: number } = {},
    options?: RequestOptions,
  ): Promise<ServicePrincipalSecret> {
    return this._send("POST", path`/v1/tenants/${tenantId}/service-principals/${servicePrincipalId}/rotate-secret`, params, options);
  }
}
