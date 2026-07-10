import type { RequestOpts } from "../client/options.js";
import { resolveEnvelope, type Envelope } from "../types/common.js";
import type { Transport } from "../transport/http.js";

/**
 * A machine identity for client-credentials (M2M) auth. `description` is
 * accepted on create but never returned on any response.
 */
export interface ServicePrincipal {
  id: string;
  tenant_id: string;
  name: string;
  scopes: string[];
  disabled_at?: string;
  created_at: string;
}

export interface CreateServicePrincipalInput {
  tenant_id: string;
  name: string;
  description?: string;
  scopes?: string[];
}

/** Carries the plaintext client secret, shown once at creation. */
export interface CreateServicePrincipalResult {
  service_principal: ServicePrincipal;
  client_id: string;
  client_secret: string;
  warning?: string;
}

/**
 * Manages machine identities. There is no get or update anywhere in the
 * backend — only create/disable/list.
 */
export class ServicePrincipalsService {
  constructor(private readonly t: Transport) {}

  create(input: CreateServicePrincipalInput, opts?: RequestOpts): Promise<CreateServicePrincipalResult> {
    return this.t.post<CreateServicePrincipalResult>("/v1/service-principals", input, opts);
  }

  /**
   * Revokes a service principal (called "disable" server-side; there is no
   * re-enable — create a new one instead).
   */
  disable(id: string, opts?: RequestOpts): Promise<void> {
    return this.t.delete(`/v1/service-principals/${encodeURIComponent(id)}`, opts);
  }

  async list(tenantId: string, opts?: RequestOpts): Promise<ServicePrincipal[]> {
    const env = await this.t.get<Envelope<ServicePrincipal>>(`/v1/tenants/${encodeURIComponent(tenantId)}/service-principals`, opts);
    return resolveEnvelope(env);
  }
}
