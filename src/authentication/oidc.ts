import type { RequestOpts } from "../client/options.js";
import { resolveEnvelope, type Envelope } from "../types/common.js";
import type { Transport } from "../transport/http.js";

export interface OIDCClient {
  id: string;
  tenant_id?: string;
  name: string;
  client_id: string;
  redirect_uris: string[];
  grant_types: string[];
  scopes: string[];
  token_endpoint_auth_method?: string;
  created_at: string;
  updated_at?: string;
}

export interface CreateOIDCClientInput {
  name: string;
  redirect_uris: string[];
  grant_types?: string[];
  scopes?: string[];
  token_endpoint_auth_method?: string;
}

export interface UpdateOIDCClientInput {
  name?: string;
  redirect_uris?: string[];
  grant_types?: string[];
  scopes?: string[];
  token_endpoint_auth_method?: string;
}

export interface OIDCRotateSecretResult {
  client_id: string;
  client_secret: string;
}

/**
 * An OIDC client with live grants that isn't registered as a managed
 * agent/service principal — a candidate for Shadow-AI review.
 */
export interface ShadowAIClient {
  client_id: string;
  name: string;
  grant_count?: number;
  last_used_at?: string;
  first_seen_at?: string;
}

/**
 * Manages OIDC clients. All CRUD is tenant-scoped — the previous SDK
 * version targeted a top-level `/v1/oidc/clients` path that only supports
 * register (POST) and delete in the current API; get/list/update/
 * rotateSecret live exclusively under `/v1/tenants/{tenantId}/oidc/clients`
 * and would have 404ed.
 */
export class OIDCService {
  constructor(private readonly t: Transport) {}

  create(tenantId: string, input: CreateOIDCClientInput, opts?: RequestOpts): Promise<OIDCClient> {
    return this.t.post<OIDCClient>(`/v1/tenants/${encodeURIComponent(tenantId)}/oidc/clients`, input, opts);
  }

  get(tenantId: string, id: string, opts?: RequestOpts): Promise<OIDCClient> {
    return this.t.get<OIDCClient>(`/v1/tenants/${encodeURIComponent(tenantId)}/oidc/clients/${encodeURIComponent(id)}`, opts);
  }

  update(tenantId: string, id: string, input: UpdateOIDCClientInput, opts?: RequestOpts): Promise<OIDCClient> {
    return this.t.patch<OIDCClient>(`/v1/tenants/${encodeURIComponent(tenantId)}/oidc/clients/${encodeURIComponent(id)}`, input, opts);
  }

  delete(tenantId: string, id: string, opts?: RequestOpts): Promise<void> {
    return this.t.delete(`/v1/tenants/${encodeURIComponent(tenantId)}/oidc/clients/${encodeURIComponent(id)}`, opts);
  }

  rotateSecret(tenantId: string, id: string, opts?: RequestOpts): Promise<OIDCRotateSecretResult> {
    return this.t.post<OIDCRotateSecretResult>(
      `/v1/tenants/${encodeURIComponent(tenantId)}/oidc/clients/${encodeURIComponent(id)}/rotate-secret`,
      {},
      opts,
    );
  }

  async list(tenantId: string, opts?: RequestOpts): Promise<OIDCClient[]> {
    const env = await this.t.get<Envelope<OIDCClient>>(`/v1/tenants/${encodeURIComponent(tenantId)}/oidc/clients`, opts);
    return resolveEnvelope(env);
  }

  /**
   * Lists OIDC clients with live grants that aren't registered as managed
   * agents/service principals — flagging unmanaged AI/automation access.
   */
  async listShadowAI(tenantId: string, opts?: RequestOpts): Promise<ShadowAIClient[]> {
    const env = await this.t.get<Envelope<ShadowAIClient>>(`/v1/tenants/${encodeURIComponent(tenantId)}/oidc/clients/shadow-ai`, opts);
    return resolveEnvelope(env);
  }

  /** Marks a shadow-AI client as reviewed. */
  review(tenantId: string, id: string, opts?: RequestOpts): Promise<void> {
    return this.t.post(`/v1/tenants/${encodeURIComponent(tenantId)}/oidc/clients/${encodeURIComponent(id)}/review`, {}, opts);
  }
}
