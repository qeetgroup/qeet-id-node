import type { RequestOpts } from "../client/options.js";
import { resolveEnvelope, type Envelope } from "../types/common.js";
import type { Transport } from "../transport/http.js";

/**
 * An external service provider registered to consume this tenant's SAML
 * assertions — Qeet ID acting as the IdP. This is the mirror image of
 * `SAMLConnection` (saml.ts), where Qeet ID is the SP connecting out to an
 * external IdP; the two are genuinely separate resources sharing only a URL
 * prefix.
 */
export interface SAMLServiceProvider {
  id: string;
  tenant_id: string;
  name: string;
  entity_id: string;
  acs_url: string;
  name_id_format?: string;
  name_id_attribute?: string;
  certificate?: string;
  /** draft | active | disabled */
  status: string;
  created_at: string;
  updated_at?: string;
  last_login_at?: string;
}

export interface CreateSAMLServiceProviderInput {
  name: string;
  entity_id: string;
  acs_url: string;
  name_id_format?: string;
  name_id_attribute?: string;
  certificate?: string;
  status?: string;
}

export interface UpdateSAMLServiceProviderInput {
  name?: string;
  entity_id?: string;
  acs_url?: string;
  name_id_format?: string;
  name_id_attribute?: string;
  certificate?: string;
  /** draft | active | disabled */
  status?: string;
}

/** Manages external SPs registered against this tenant's SAML IdP. */
export class SAMLServiceProvidersService {
  constructor(private readonly t: Transport) {}

  create(tenantId: string, input: CreateSAMLServiceProviderInput, opts?: RequestOpts): Promise<SAMLServiceProvider> {
    return this.t.post<SAMLServiceProvider>(`/v1/tenants/${encodeURIComponent(tenantId)}/saml-providers`, input, opts);
  }

  get(tenantId: string, id: string, opts?: RequestOpts): Promise<SAMLServiceProvider> {
    return this.t.get<SAMLServiceProvider>(`/v1/tenants/${encodeURIComponent(tenantId)}/saml-providers/${encodeURIComponent(id)}`, opts);
  }

  update(tenantId: string, id: string, input: UpdateSAMLServiceProviderInput, opts?: RequestOpts): Promise<SAMLServiceProvider> {
    return this.t.patch<SAMLServiceProvider>(
      `/v1/tenants/${encodeURIComponent(tenantId)}/saml-providers/${encodeURIComponent(id)}`,
      input,
      opts,
    );
  }

  delete(tenantId: string, id: string, opts?: RequestOpts): Promise<void> {
    return this.t.delete(`/v1/tenants/${encodeURIComponent(tenantId)}/saml-providers/${encodeURIComponent(id)}`, opts);
  }

  async list(tenantId: string, opts?: RequestOpts): Promise<SAMLServiceProvider[]> {
    const env = await this.t.get<Envelope<SAMLServiceProvider>>(`/v1/tenants/${encodeURIComponent(tenantId)}/saml-providers`, opts);
    return resolveEnvelope(env);
  }
}
