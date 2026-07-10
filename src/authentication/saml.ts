import type { RequestOpts } from "../client/options.js";
import { resolveEnvelope, type Envelope } from "../types/common.js";
import type { Transport } from "../transport/http.js";

export interface SAMLConnection {
  id: string;
  tenant_id: string;
  name: string;
  enabled: boolean;
  idp_entity_id?: string;
  idp_sso_url?: string;
  idp_certificate?: string;
  sp_entity_id?: string;
  sp_acs_url?: string;
  attribute_mapping?: Record<string, string>;
  created_at: string;
  updated_at?: string;
}

export interface CreateSAMLConnectionInput {
  name: string;
  idp_entity_id?: string;
  idp_sso_url?: string;
  idp_certificate?: string;
  attribute_mapping?: Record<string, string>;
  enabled?: boolean;
}

export interface UpdateSAMLConnectionInput {
  name?: string;
  idp_entity_id?: string;
  idp_sso_url?: string;
  idp_certificate?: string;
  attribute_mapping?: Record<string, string>;
  enabled?: boolean;
}

export interface SAMLTestResult {
  success: boolean;
  error?: string;
}

/** Manages SAML SSO connections. */
export class SAMLService {
  constructor(private readonly t: Transport) {}

  create(tenantId: string, input: CreateSAMLConnectionInput, opts?: RequestOpts): Promise<SAMLConnection> {
    return this.t.post<SAMLConnection>(`/v1/tenants/${encodeURIComponent(tenantId)}/saml`, input, opts);
  }

  get(tenantId: string, id: string, opts?: RequestOpts): Promise<SAMLConnection> {
    return this.t.get<SAMLConnection>(`/v1/tenants/${encodeURIComponent(tenantId)}/saml/${encodeURIComponent(id)}`, opts);
  }

  update(tenantId: string, id: string, input: UpdateSAMLConnectionInput, opts?: RequestOpts): Promise<SAMLConnection> {
    return this.t.patch<SAMLConnection>(`/v1/tenants/${encodeURIComponent(tenantId)}/saml/${encodeURIComponent(id)}`, input, opts);
  }

  delete(tenantId: string, id: string, opts?: RequestOpts): Promise<void> {
    return this.t.delete(`/v1/tenants/${encodeURIComponent(tenantId)}/saml/${encodeURIComponent(id)}`, opts);
  }

  test(tenantId: string, id: string, opts?: RequestOpts): Promise<SAMLTestResult> {
    return this.t.post<SAMLTestResult>(`/v1/tenants/${encodeURIComponent(tenantId)}/saml/${encodeURIComponent(id)}/test`, {}, opts);
  }

  async list(tenantId: string, opts?: RequestOpts): Promise<SAMLConnection[]> {
    const env = await this.t.get<Envelope<SAMLConnection>>(`/v1/tenants/${encodeURIComponent(tenantId)}/saml`, opts);
    return resolveEnvelope(env);
  }
}
